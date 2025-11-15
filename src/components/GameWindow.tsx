'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

enum GameState {
  Idle = 'idle',
  Playing = 'playing',
  Guessing = 'guessing',
  Finished = 'finished',
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

export default function GameWindow() {
  const { data: session } = useSession();
  const [gameState, setGameState] = useState<GameState>(GameState.Idle);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [questionCount, setQuestionCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentGuess, setCurrentGuess] = useState<string | null>(null);

  const MAX_QUESTIONS = 20;

  const fetchQuestion = async (history: ChatMessage[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chatHistory: history }),
      });
      const data = await response.json();

      if (response.ok) {
        if (data.type === 'question') {
          setChatHistory((prev) => [...prev, { role: 'assistant', content: data.content }]);
          setGameState(GameState.Playing);
          setQuestionCount((prev) => prev + 1);
        } else if (data.type === 'guess') {
          setCurrentGuess(data.content);
          setGameState(GameState.Guessing);
        }
      } else {
        console.error('API Error:', data.message);
        setChatHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${data.message}` }]);
        setGameState(GameState.Idle);
      }
    } catch (error) {
      console.error('Network Error:', error);
      setChatHistory((prev) => [...prev, { role: 'assistant', content: 'Network error. Please try again.' }]);
      setGameState(GameState.Idle);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartGame = () => {
    setGameState(GameState.Playing);
    setChatHistory([]);
    setQuestionCount(0);
    setCurrentGuess(null);
    fetchQuestion([]); // Get the first question
  };

  const handleAnswer = (answer: string) => {
    if (questionCount >= MAX_QUESTIONS && gameState === GameState.Playing) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: "I've reached my question limit. I'll make a guess now." }]);
      // Force a guess if max questions reached
      fetchQuestion([...chatHistory, { role: 'user', content: answer }]);
      return;
    }

    const newHistory = [...chatHistory, { role: 'user', content: answer }];
    setChatHistory(newHistory);
    fetchQuestion(newHistory);
  };

  const handleGuessResponse = async (isCorrect: boolean) => {
    if (isCorrect) {
      setChatHistory((prev) => [...prev, { role: 'user', content: 'Yes, you got it!' }]);
      setGameState(GameState.Finished);
      // TODO: Save game to DB
      console.log('Game Won! Saving to DB...');
    } else {
      setChatHistory((prev) => [...prev, { role: 'user', content: 'No, that is not correct.' }]);
      setGameState(GameState.Playing);
      setCurrentGuess(null);
      fetchQuestion([...chatHistory, { role: 'user', content: 'No, that is not correct.' }]); // Continue playing
    }
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-600">
        <p className="text-lg mb-4">Please sign in to start a new game.</p>
        <button
          onClick={() => handleStartGame()} // This will trigger sign-in via NextAuth if not logged in
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Sign In to Play
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
      <div className="flex-grow p-4 overflow-y-auto bg-gray-50">
        {chatHistory.length === 0 && gameState === GameState.Idle && (
          <div className="text-center text-gray-500 mt-10">
            <p className="text-xl mb-4">Welcome to Akinator-LLM!</p>
            <p>Think of a character, object, or concept, and I will try to guess it.</p>
            <button
              onClick={handleStartGame}
              className="mt-6 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Start New Game
            </button>
          </div>
        )}

        {chatHistory.map((msg, index) => (
          <div
            key={index}
            className={`mb-3 p-3 rounded-lg ${
              msg.role === 'assistant' ? 'bg-blue-100 self-start' : 'bg-gray-200 self-end'
            }`}
          >
            <p className="font-semibold">{msg.role === 'assistant' ? 'Akinator' : 'You'}:</p>
            <p>{msg.content}</p>
          </div>
        ))}

        {isLoading && (
          <div className="text-center text-gray-500 mt-4">
            <p>Thinking...</p>
          </div>
        )}

        {gameState === GameState.Playing && questionCount < MAX_QUESTIONS && !isLoading && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            <button
              onClick={() => handleAnswer('Yes')}
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              Yes
            </button>
            <button
              onClick={() => handleAnswer('No')}
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              No
            </button>
            <button
              onClick={() => handleAnswer("I don't know")}
              className="bg-yellow-500 hover:bg-yellow-700 text-gray-800 font-bold py-2 px-4 rounded"
            >
              I don't know
            </button>
            <button
              onClick={() => handleAnswer('Probably')}
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Probably
            </button>
            <button
              onClick={() => handleAnswer('Probably Not')}
              className="bg-orange-500 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
            >
              Probably Not
            </button>
          </div>
        )}

        {gameState === GameState.Guessing && currentGuess && !isLoading && (
          <div className="text-center mt-4">
            <p className="text-xl font-semibold mb-4">My guess is... {currentGuess}! Am I right?</p>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => handleGuessResponse(true)}
                className="bg-green-600 hover:bg-green-800 text-white font-bold py-2 px-4 rounded"
              >
                Yes, you got it!
              </button>
              <button
                onClick={() => handleGuessResponse(false)}
                className="bg-red-600 hover:bg-red-800 text-white font-bold py-2 px-4 rounded"
              >
                No, keep guessing.
              </button>
            </div>
          </div>
        )}

        {gameState === GameState.Finished && (
          <div className="text-center mt-4">
            <p className="text-2xl font-bold text-green-600 mb-4">🎉 I guessed it! 🎉</p>
            <button
              onClick={handleStartGame}
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              Play Again
            </button>
          </div>
        )}

        {questionCount >= MAX_QUESTIONS && gameState === GameState.Playing && !isLoading && (
          <div className="text-center mt-4">
            <p className="text-xl font-semibold text-red-600 mb-4">
              I've reached my question limit ({MAX_QUESTIONS} questions). I need to make a final guess!
            </p>
            <button
              onClick={() => handleAnswer('Make a final guess')} // Trigger a guess
              className="bg-purple-500 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
            >
              Force Guess
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
