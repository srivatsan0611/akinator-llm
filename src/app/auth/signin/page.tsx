'use client';

import { getProviders, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';
import { FaGoogle, FaGithub } from 'react-icons/fa';

type Provider = {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
};

const providerIcons: { [key: string]: JSX.Element } = {
  Google: <FaGoogle className="text-xl" />,
  GitHub: <FaGithub className="text-xl" />,
};

const providerStyles: { [key: string]: string } = {
  Google: 'bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 shadow-red-500/50',
  GitHub: 'bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-900 hover:to-gray-800 shadow-purple-500/50',
};

export default function SignInPage() {
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null);

  useEffect(() => {
    const fetchProviders = async () => {
      const res = await getProviders();
      setProviders(res);
    };
    fetchProviders();
  }, []);

  return (
    <div className="w-full max-w-md mx-auto animate-fade-in">
      <div className="bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-xl shadow-2xl rounded-3xl p-10 border border-gray-700/50 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

        <div className="text-center mb-8">
          <div className="inline-block mb-4">
            <div className="text-6xl animate-pulse">🎭</div>
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            Welcome Back
          </h1>
          <p className="text-gray-400 text-lg">Sign in to challenge the AI</p>
        </div>

        <div className="space-y-4">
          {providers &&
            Object.values(providers).map((provider) => (
              <div key={provider.name} className="animate-slide-up">
                <button
                  onClick={() => signIn(provider.id, { callbackUrl: '/' })}
                  className={`w-full flex items-center justify-center gap-3 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 shadow-lg hover:shadow-2xl ${providerStyles[provider.name] || 'bg-gray-700 hover:bg-gray-600'} border border-white/10 hover:border-white/20`}
                >
                  {providerIcons[provider.name]}
                  <span className="text-base">Continue with {provider.name}</span>
                </button>
              </div>
            ))}
        </div>

        <div className="mt-8 pt-6 border-t border-gray-700/50">
          <p className="text-center text-gray-500 text-sm">
            By signing in, you agree to play fair and have fun!
          </p>
        </div>
      </div>
    </div>
  );
}
