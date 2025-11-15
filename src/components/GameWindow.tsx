'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';

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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const MAX_QUESTIONS = 20;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isLoading]);

  const fetchQuestion = async (history: ChatMessage[]) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (!session) {
      signIn();
      return;
    }
    setGameState(GameState.Playing);
    setChatHistory([]);
    setQuestionCount(0);
    setCurrentGuess(null);
    fetchQuestion([]);
  };

  const handleAnswer = (answer: string) => {
    if (questionCount >= MAX_QUESTIONS && gameState === GameState.Playing) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: "I've reached my question limit. I'll make a guess now." }]);
      fetchQuestion([...chatHistory, { role: 'user', content: answer }]);
      return;
    }
    const newHistory = [...chatHistory, { role: 'user', content: answer }];
    setChatHistory(newHistory);
    fetchQuestion(newHistory);
  };

  const handleGuessResponse = async (isCorrect: boolean) => {
    const userResponse = isCorrect ? 'Yes, you got it!' : 'No, that is not correct.';
    const newHistory = [...chatHistory, { role: 'user', content: userResponse }];
    setChatHistory(newHistory);

    if (isCorrect) {
      setGameState(GameState.Finished);
      // TODO: Save game to DB
      console.log('Game Won! Saving to DB...');
    } else {
      setGameState(GameState.Playing);
      setCurrentGuess(null);
      fetchQuestion(newHistory);
    }
  };

  const renderAnswerButtons = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 animate-fade-in">
      <button onClick={() => handleAnswer('Yes')} className="text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-xl w-full bg-green-500 hover:bg-green-600">Yes</button>
      <button onClick={() => handleAnswer('No')} className="text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-xl w-full bg-red-500 hover:bg-red-600">No</button>
      <button onClick={() => handleAnswer("I don't know")} className="text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-xl w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900">I don't know</button>
      <button onClick={() => handleAnswer('Probably')} className="text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-xl w-full bg-blue-500 hover:bg-blue-600">Probably</button>
      <button onClick={() => handleAnswer('Probably Not')} className="text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-xl w-full bg-purple-500 hover:bg-purple-600">Probably Not</button>
    </div>
  );

  if (!session) {
    return (
      <div className="w-full max-w-2xl mx-auto bg-gray-800/80 backdrop-blur-md shadow-2xl rounded-2xl p-8 text-center">
        <h2 className="text-3xl font-bold mb-4">Welcome to Akinator-LLM</h2>
        <p className="text-gray-300 mb-6">Please sign in to challenge the AI and see if it can guess what you're thinking!</p>
        <button onClick={() => signIn()} className="text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg bg-blue-600 hover:bg-blue-700">
          Sign In to Play
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-[80vh] max-w-3xl mx-auto flex flex-col bg-gray-800/80 backdrop-blur-md shadow-2xl rounded-2xl overflow-hidden border border-gray-700/50">
      <div className="flex-grow p-6 overflow-y-auto space-y-6">
        {chatHistory.map((msg, index) => (
          <div key={index} className={`flex items-end gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0"></div>}
            <div className={`max-w-md p-3 rounded-2xl text-white ${msg.role === 'assistant' ? 'bg-gray-700' : 'bg-blue-600'}`}>
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex-shrink-0"></div>
            <div className="max-w-md p-3 rounded-2xl bg-gray-700 text-white">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse [animation-delay:-0.3s]"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse [animation-delay:-0.15s]"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-6 border-t border-gray-700/50">
        {gameState === GameState.Idle && (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Ready for a challenge?</h2>
            <p className="text-gray-400 mb-6">Think of anything, and I'll try to guess it in 20 questions or less.</p>
            <button onClick={handleStartGame} className="text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg bg-green-600 hover:bg-green-700">
              Start New Game
            </button>
          </div>
        )}

        {gameState === GameState.Playing && !isLoading && renderAnswerButtons()}

        {gameState === GameState.Guessing && currentGuess && !isLoading && (
          <div className="text-center animate-fade-in">
            <p className="text-xl font-semibold mb-4">My guess is... <span className="text-blue-400">{currentGuess}</span>! Am I right?</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => handleGuessResponse(true)} className="text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-xl w-full bg-green-500 hover:bg-green-600">Yes, you got it!</button>
              <button onClick={() => handleGuessResponse(false)} className="text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-105 hover:shadow-xl w-full bg-red-500 hover:bg-red-600">No, keep guessing</button>
            </div>
          </div>
        )}

        {gameState === GameState.Finished && (
          <div className="text-center animate-fade-in">
            <p className="text-2xl font-bold text-green-400 mb-4">🎉 I guessed it! Another round? 🎉</p>
            <button onClick={handleStartGame} className="text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg bg-blue-600 hover:bg-blue-700">
              Play Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

