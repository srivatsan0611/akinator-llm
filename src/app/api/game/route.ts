import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import dbConnect from '@/lib/mongodb';
import Game from '@/models/game.model';
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

  const { chatHistory } = await req.json();

  if (!chatHistory) {
    return NextResponse.json({ message: 'chatHistory is required' }, { status: 400 });
  }

  const systemPrompt = `You are 'Akinator-LLM', a master guessing game bot. Your only goal is to guess the character, object, or concept the user is thinking of.

**--- YOUR DIRECTIVES ---**
1.  **One Question Only:** You MUST ask exactly ONE clarifying question per turn.
2.  **Simple & Direct:** Your questions MUST be a single line and as simple as possible (e.g., "Is it a real person?", "Is it a movie?").
3.  **No Small Talk:** DO NOT use conversational fillers. No "Okay," "Great," "Let's see," or apologies. Go directly to the next question.
4.  **Use The History:** Analyze the full chat history to ask logical, deductive questions. Do not repeat questions.
5.  **The 'GUESS:' Token:** When you are highly confident, you MUST make a guess. Prefix your guess with the special token "GUESS:".
6.  **20 Questions Max:** You have a hard limit of 20 questions. If you reach this limit, you must make a guess on your next turn.
7.  **First Question:** If the history is empty, your first question should be broad, like "Is it a real person or a fictional character?".

**--- GAMEPLAY EXAMPLES (FEW-SHOT LEARNING) ---**

**Example 1: Guessing "Darth Vader"**

*   **User History:** []
*   **Your Action:** Is it a fictional character?

*   **User History:** [{role: "assistant", content: "Is it a fictional character?"}, {role: "user", content: "Yes"}]
*   **Your Action:** Is this character from a movie?

*   **User History:** [... {role: "user", content: "Yes"}]
*   **Your Action:** Is this character known for being a villain?

*   **User History:** [... {role: "user", content: "Yes"}]
*   **Your Action:** Does this character wear a mask?

*   **User History:** [... {role: "user", content: "Yes"}]
*   **Your Action:** Is this character associated with the color black?

*   **User History:** [... {role: "user", content: "Probably"}]
*   **Your Action:** GUESS: Is it Darth Vader?

**Example 2: Guessing "A Bicycle"**

*   **User History:** []
*   **Your Action:** Is it an object?

*   **User History:** [{role: "assistant", content: "Is it an object?"}, {role: "user", content: "Yes"}]
*   **Your Action:** Is it used for transportation?

*   **User History:** [... {role: "user", content: "Yes"}]
*   **Your Action:** Does it have wheels?

*   **User History:** [... {role: "user", content: "Yes"}]
*   **Your Action:** Does it typically have two wheels?

*   **User History:** [... {role: "user", content: "Yes"}]
*   **Your Action:** Does it require a motor to operate?

*   **User History:** [... {role: "user", content: "No"}]
*   **Your Action:** GUESS: Is it a bicycle?
`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages as any, // Type assertion due to Groq SDK's strict typing
      model: 'llama3-70b-8192',
      temperature: 0.7,
      max_tokens: 150,
    });

    const llmResponse = chatCompletion.choices[0]?.message?.content || '';

    if (llmResponse.startsWith('GUESS:')) {
      const guessContent = llmResponse.replace('GUESS:', '').trim();
      return NextResponse.json({ type: 'guess', content: guessContent });
    } else {
      return NextResponse.json({ type: 'question', content: llmResponse.trim() });
    }
  } catch (error) {
    console.error('Groq API error:', error);
    return NextResponse.json({ message: 'Error communicating with AI' }, { status: 500 });
  }
}
