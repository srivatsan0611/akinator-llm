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

  // Define the type for the incoming chat history
  type ChatHistoryItem = {
    role: 'user' | 'assistant';
    content: string;
  };

  const { chatHistory }: { chatHistory: ChatHistoryItem[] } = await req.json();

  if (!chatHistory) {
    return NextResponse.json({ message: 'chatHistory is required' }, { status: 400 });
  }

  const systemPrompt = `You are 'Akinator-LLM', a master guessing game bot. Your only goal is to guess the character, object, or concept the user is thinking of.

**--- YOUR DIRECTIVES ---**
1.  **Analyze History:** Carefully analyze the user's answers in the provided history.
2.  **Think Step-by-Step:** First, think about your strategy. What have you learned? What is the most logical next question to narrow down the possibilities?
3.  **Formulate Action:** Based on your thought process, formulate your action. This will be either a single, simple, one-line question or a guess prefixed with "GUESS:".
4.  **Strict JSON Output:** You MUST format your response as a JSON object with two keys: "thought" and "action".

**--- JSON OUTPUT FORMAT ---**
{
  "thought": "Your detailed reasoning and step-by-step thinking process goes here. Explain why you are asking the next question.",
  "action": "Your single, one-line question OR your guess prefixed with 'GUESS:' goes here."
}

**--- RULES & EXAMPLES ---**
*   **Action Rules:**
    *   The "action" string MUST be a single line.
    *   It must NOT contain any conversational fillers (e.g., "Okay," "Great").
    *   If the history is empty, your first question should be broad (e.g., "Is it a real person or a fictional character?").
*   **Example 1:**
    *   **History:** []
    *   **Your JSON Response:**
        {
          "thought": "The history is empty. I need to start with a broad question to determine the main category. I'll ask if the user is thinking of a real person or a fictional character.",
          "action": "Is it a real person or a fictional character?"
        }
*   **Example 2:**
    *   **History:** [{ "role": "assistant", "content": "Is it a real person or a fictional character?" }, { "role": "user", "content": "Fictional" }]
    *   **Your JSON Response:**
        {
          "thought": "The user confirmed it's a fictional character. Now I need to know the medium. I'll ask if the character is from a movie.",
          "action": "Is the character from a movie?"
        }
*   **Example 3 (Guessing):**
    *   **History:** [ ... many questions and answers pointing to a specific character ... ]
    *   **Your JSON Response:**
        {
          "thought": "The user has confirmed the character is a villain from a movie who wears a mask and is associated with the color black. I am highly confident the answer is Darth Vader.",
          "action": "GUESS: Is it Darth Vader?"
        }
`;

  try {
    const messages: Groq.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages,
      model: 'qwen/qwen3-32b',
      temperature: 0.7,
      max_tokens: 300, // Increased max_tokens to accommodate JSON structure
      response_format: { type: 'json_object' }, // Enforce JSON output
    });

    const llmResponse = chatCompletion.choices[0]?.message?.content || '{}';

    try {
      const parsedResponse = JSON.parse(llmResponse);
      const action = parsedResponse.action || "I'm having trouble thinking of a question. Let's try again.";

      if (action.startsWith('GUESS:')) {
        const guessContent = action.replace('GUESS:', '').trim();
        return NextResponse.json({ type: 'guess', content: guessContent });
      } else {
        return NextResponse.json({ type: 'question', content: action.trim() });
      }
    } catch (parseError) {
      console.error('JSON Parsing Error:', parseError, 'Raw Response:', llmResponse);
      // Fallback for non-JSON response, though less likely with `response_format`
      return NextResponse.json({ type: 'question', content: "I got a bit confused. Could you repeat your last answer?" });
    }
  } catch (error) {
    console.error('Groq API error:', error);
    return NextResponse.json({ message: 'Error communicating with AI' }, { status: 500 });
  }
