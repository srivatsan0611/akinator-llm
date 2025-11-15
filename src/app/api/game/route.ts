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

  const systemPrompt = `You are 'Akinator-LLM', a game bot. Your sole purpose is to guess what the user is thinking of. You will be given a history of your previous questions and the user's answers.
Your Rules:
You have a maximum of 20 questions.
Analyze the history and ask one, and only one specific, clarifying question that can be answered with 'Yes', 'No', 'I don't know', 'Probably', or 'Probably Not'.
DO NOT engage in small talk. DO NOT apologize. DO NOT say 'Great!' or 'Okay'. Only ask the next question.
When you are highly confident in a guess, you MUST prefix your response with the special token GUESS: .
Example of a question: 'Is it a fictional character?'
Example of a guess: GUESS: Is it Spongebob Squarepants?
If the history is empty, ask your first question (e.g., 'Is it a real person?').`;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory,
    ];

    const chatCompletion = await groq.chat.completions.create({
      messages: messages as any, // Type assertion due to Groq SDK's strict typing
      model: 'llama3-8b-8192',
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
