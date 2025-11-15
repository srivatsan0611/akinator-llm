'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="bg-gray-900/50 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-50">
      <div className="container mx-auto flex justify-between items-center p-4 text-white">
        <Link href="/" className="text-2xl font-bold text-white hover:text-blue-400 transition-colors">
          Akinator-LLM
        </Link>
        <div>
          {session ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">Welcome, {session.user?.name || session.user?.email}!</span>
              <button
                onClick={() => signOut()}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => signIn()}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-transform transform hover:scale-105"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
