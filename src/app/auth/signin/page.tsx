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
  Google: <FaGoogle />,
  GitHub: <FaGithub />,
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
    <div className="w-full max-w-md mx-auto bg-gray-800/80 backdrop-blur-md shadow-2xl rounded-2xl p-8 text-center">
      <h1 className="text-3xl font-bold mb-2 text-white">Sign In</h1>
      <p className="text-gray-400 mb-8">Choose a provider to continue</p>
      <div className="space-y-4">
        {providers &&
          Object.values(providers).map((provider) => (
            <div key={provider.name}>
              <button
                onClick={() => signIn(provider.id, { callbackUrl: '/' })}
                className="w-full flex items-center justify-center gap-3 text-white font-bold py-3 px-6 rounded-lg transition-all transform hover:scale-105 shadow-lg bg-gray-700 hover:bg-gray-600 border border-transparent hover:border-blue-500"
              >
                {providerIcons[provider.name]}
                Sign in with {provider.name}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
