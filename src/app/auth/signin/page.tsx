'use client';

import { getProviders, signIn } from 'next-auth/react';
import { useState, useEffect } from 'react';

type Provider = {
  id: string;
  name: string;
  type: string;
  signinUrl: string;
  callbackUrl: string;
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
                onClick={() => signIn(provider.id)}
                className="w-full text-white font-bold py-3 px-6 rounded-lg transition-transform transform hover:scale-105 shadow-lg bg-gray-700 hover:bg-gray-600"
              >
                Sign in with {provider.name}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}
