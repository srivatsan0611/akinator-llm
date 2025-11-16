import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import dbConnect from '@/lib/mongodb';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function POST(req: NextRequest) {
  await dbConnect();
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  type ChatHistoryItem = {
    role: 'user' | 'assistant';
    content: string;
  };

  const { chatHistory }: { chatHistory: ChatHistoryItem[] } = await req.json();

  if (!chatHistory) {
    return NextResponse.json({ message: 'chatHistory is required' }, { status: 400 });
  }

  // System prompt for Akinator game
  const systemPrompt = `
  You are Akinator-LLM — an entity identification engine. Your ONLY actions are asking a deductive question or making a final guess. Output VALID JSON ONLY. Never output anything besides the JSON object.

  PERMITTED OUTPUT FORMATS:

  Ask a question:
  {"question": "Your yes/no question here"}

  Make a final guess:
  {"guess": "Exact Name"}

  No explanations, no commentary, no reasoning outside the JSON.

  ------------------------------------------
  CORE OPERATING RULES
  ------------------------------------------

  1. Follow the Deduction Hierarchy.
  You may ONLY move downward after confirming the parent category:

  1. Living vs Non-living
  2. If living → Human / Animal / Plant / Other
  3. If human → Real or Fictional
  4. If real → Alive or Dead
  5. For humans → Profession / Field (actor, athlete, politician, etc.)
  6. For confirmed categories → Nationality / Region
  7. Then → Era, achievements, traits
  8. When sufficiently narrowed → Make a guess

  You may NOT explore subcategories until their parent category is confirmed.

  ------------------------------------------

  2. "NO" Eliminates an Entire Branch.
  A "No" permanently kills that branch. Switch to a different branch at the same hierarchy level. Never return to a branch eliminated by a No.

  ------------------------------------------

  3. NEVER Ask Questions That:
  - Contradict previous answers
  - Repeat earlier questions
  - Assume categories not yet confirmed
  - Reset to earlier hierarchy levels
  - Are irrelevant to the confirmed category (e.g., asking about locations for a human)

  Examples of illegal behavior:
  - Asking "Is it an object?" after confirming it’s a human
  - Asking "Is it indoors?" after confirming it's a person
  - Asking "Is it American?" before profession is confirmed
  - Asking "Is it a mammal?" after learning it's non-living

  ------------------------------------------

  4. Every question must be binary, clear, and eliminative.
  Questions must remove large chunks of the possibility space and match the current hierarchy level.

  ------------------------------------------

  5. Maximum 20 questions. Use them efficiently.

  ------------------------------------------

  6. When fewer than 10 plausible candidates remain, begin making specific guesses.
  Don’t stall with overly specific trivia-level questions.

  ------------------------------------------
  STATE RULES (Llama-Safe)
  ------------------------------------------

  Before outputting a question, internally verify:
  - It does not contradict any previous info
  - It has not been asked already
  - It fits the correct hierarchy level
  - It makes no unconfirmed assumptions

  If not valid, choose a different question.

  ------------------------------------------
  STARTING BEHAVIOR
  ------------------------------------------

  Your first question can be ANY top-level category question. Examples:
  - "Is it a living thing?"
  - "Is it a person?"
  - "Is it an animal?"
  - "Is it a real thing?"

  Choose whichever top-level opener you want.

  ------------------------------------------
  RESPONSE RULES
  ------------------------------------------

  If the user answers:
  - "Yes" → Go deeper within the confirmed category
  - "No" → Switch to a different branch at the same level
  - "I don’t know" → Ask something that reduces uncertainty

  ------------------------------------------
  ENDGAME
  ------------------------------------------

  When confident, output a specific guess:

  {"guess": "Exact Name"}

  Never guess categories or broad groups. Only specific entities.
  `;


  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
    ];

    console.log('Chat history length:', chatHistory.length);
    console.log('Last 3 exchanges:', chatHistory.slice(-6));

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'llama-3.1-8b-instant',
      temperature: 0.7,
      max_tokens: 100,
      response_format: { type: 'json_object' },
    });

    const rawResponse = chatCompletion.choices[0]?.message?.content || '{}';
    console.log('Raw LLM Response:', rawResponse);

    let parsed;
    try {
      parsed = JSON.parse(rawResponse);
    } catch (err) {
      console.error('JSON Parse Error:', err);
      console.error('Raw response:', rawResponse);

      // Fallback question
      return NextResponse.json({
        type: 'question',
        content: 'Is this person still alive today?',
      });
    }

    console.log('Parsed JSON:', parsed);

    // Handle guess
    if (parsed.guess) {
      const guessContent = parsed.guess.trim();

      // Validate that the guess is specific, not vague
      const vaguePhrases = [
        'a fictional character',
        'a famous',
        'an actor',
        'a musician',
        'a type of',
        'something',
        'someone',
        'a person',
        'a place',
        'a thing',
      ];

      const isVague = vaguePhrases.some(phrase =>
        guessContent.toLowerCase().includes(phrase)
      );

      if (isVague) {
        console.warn('Vague guess detected:', guessContent);
        return NextResponse.json({
          type: 'question',
          content: 'What specific region or country is this person from?',
        });
      }

      return NextResponse.json({
        type: 'guess',
        content: guessContent,
      });
    }

    // Handle question
    if (parsed.question) {
      const questionContent = parsed.question.trim();

      // Check for duplicates
      const previousQuestions = chatHistory
        .filter(msg => msg.role === 'assistant')
        .map(msg => msg.content.toLowerCase().trim());

      const isDuplicate = previousQuestions.some(prevQ =>
        prevQ === questionContent.toLowerCase().trim()
      );

      if (isDuplicate) {
        console.warn('Duplicate question detected:', questionContent);

        // Smart fallbacks based on what we know
        const fallbackFollowUps = [
          'Is it a real person?',
          'Is it a fictional character?',
          'Is it a physical object you can touch?',
          'Is it a place or location?',
          'Is it an abstract concept or idea?',
        ];

        const randomIndex = Math.floor(Math.random() * fallbackFollowUps.length);

        return NextResponse.json({
          type: 'question',
          content: fallbackFollowUps[randomIndex],
        });
      }

      // Check if stuck in same category (getting multiple NOs in a row on similar topics)
      const recentHistory = chatHistory.slice(-6); // Last 3 exchanges
      const recentNos = recentHistory.filter(msg =>
        msg.role === 'user' && msg.content.toLowerCase() === 'no'
      ).length;

      if (recentNos >= 3) {
        console.warn('Multiple NOs detected - forcing category switch');

        // Force a category-switching question
        const categorySwitchQuestions = [
          'Is it something that exists in the real world (not fictional)?',
          'Is it a human being?',
          'Is it something you would find indoors?',
          'Is it related to technology or electronics?',
          'Is it something associated with entertainment or media?',
        ];

        const randomIndex = Math.floor(Math.random() * categorySwitchQuestions.length);

        return NextResponse.json({
          type: 'question',
          content: categorySwitchQuestions[randomIndex],
        });
      }

      return NextResponse.json({
        type: 'question',
        content: questionContent,
      });
    }

    // Invalid response - fallback
    console.error('Invalid JSON structure:', parsed);
    return NextResponse.json({
      type: 'question',
      content: 'Is this person from Europe?',
    });

  } catch (error) {
    console.error('Groq API error:', error);
    return NextResponse.json({ message: 'Error communicating with AI' }, { status: 500 });
  }
}
