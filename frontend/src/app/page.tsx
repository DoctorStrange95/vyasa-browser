'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  // If already logged in, bounce to dashboard immediately
  useEffect(() => {
    if (typeof window !== 'undefined' && localStorage.getItem('access_token')) {
      window.location.replace('/dashboard');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            HS
          </div>
          <h1 className="text-4xl font-bold text-white">HealthScholar</h1>
        </div>

        <p className="text-slate-300 text-lg mb-10 leading-relaxed">
          A research platform for India's public health community.
          Search PubMed, Google Scholar, IDSP &amp; MoHFW — write papers, run statistics, mint DOIs.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/login"
            className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-lg transition text-center"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="px-8 py-3 border border-slate-400 hover:border-white text-slate-300 hover:text-white font-semibold rounded-lg transition text-center"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 text-slate-400 text-sm">
          {[
            { icon: '🔍', label: 'Literature Search' },
            { icon: '📊', label: 'Statistical Analysis' },
            { icon: '✍️',  label: 'Paper Editor' },
            { icon: '🏛️', label: 'DOI via Zenodo' },
          ].map((f) => (
            <div key={f.label} className="flex flex-col items-center gap-2">
              <span className="text-2xl">{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
