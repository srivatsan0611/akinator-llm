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
  const systemPrompt = `You are Akinator-LLM, a guessing game AI. Your goal is to guess what the user is thinking of by asking yes/no questions.

RULES:
1. You have a maximum of 20 questions
2. Ask ONE specific yes/no question per turn
3. When you're confident, make a guess by prefixing it with "GUESS: "
4. Be direct - no small talk, no apologies, no extra commentary
5. Questions should be answerable with: Yes, No, Probably, Probably Not, or I don't know

EXAMPLES:
- Question: "Is it a real person?"
- Question: "Does it live in water?"
- Guess: "GUESS: Is it SpongeBob SquarePants?"

If this is the first question (no history), ask a broad opening question like "Is it a real person?" or "Is it a fictional character?"

Respond with ONLY your question or guess, nothing else.`;

  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages,
      model: 'qwen/qwen3-32b',
      temperature: 0.3,
      max_tokens: 150,
    });

    let llmResponse = chatCompletion.choices[0]?.message?.content || '';

    // Clean up the response - remove thinking tags, markdown code blocks, etc.
    // First, remove complete <think>...</think> blocks
    llmResponse = llmResponse.replace(/<think>[\s\S]*?<\/think>/gi, '');

    // Also remove any unclosed <think> tags and everything after them
    llmResponse = llmResponse.replace(/<think>[\s\S]*/gi, '');

    // Remove any stray closing tags
    llmResponse = llmResponse.replace(/<\/think>/gi, '');

    // Remove markdown code blocks
    llmResponse = llmResponse
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .replace(/\\n/g, ' ') // Replace escaped newlines with spaces
      .replace(/\\/g, '') // Remove backslashes
      .trim();

    // Check if it's a guess
    if (llmResponse.toUpperCase().startsWith('GUESS:')) {
      const guessContent = llmResponse.replace(/^GUESS:\s*/i, '').trim();
      return NextResponse.json({
        type: 'guess',
        content: guessContent,
      });
    }

    // Otherwise it's a question
    return NextResponse.json({
      type: 'question',
      content: llmResponse,
    });

  } catch (error) {
    console.error('Groq API error:', error);
    return NextResponse.json({ message: 'Error communicating with AI' }, { status: 500 });
  }
}
