'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Persist dark mode preference
  useEffect(() => {
    const saved = localStorage.getItem('hs_dark_mode');
    if (saved === 'true') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  function toggleDark() {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('hs_dark_mode', 'true');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('hs_dark_mode', 'false');
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-slate-900 dark:bg-slate-800 text-white transition-all duration-300 flex flex-col`}
      >
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center font-bold shrink-0">
            HS
          </div>
          {sidebarOpen && <span className="font-bold text-lg">HealthScholar</span>}
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {[
            { href: '/dashboard', label: 'Dashboard', icon: '📊' },
            { href: '/search',    label: 'Search',    icon: '🔍' },
            { href: '/papers',    label: 'Papers',    icon: '📄' },
            { href: '/analysis',  label: 'Analysis',  icon: '📈' },
            { href: '/library',   label: 'Library',   icon: '📚' },
            { href: '/burden',    label: 'Burden Data', icon: '🌍' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-4 py-2 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-700 transition"
            >
              <span>{item.icon}</span>
              {sidebarOpen && <span className="text-sm">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-700">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-white transition"
          >
            {sidebarOpen ? '←' : '→'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">HealthScholar</h1>
          <div className="flex items-center gap-4">
            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 transition"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            <button className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition">
              Profile
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('access_token');
                localStorage.removeItem('refresh_token');
                window.location.replace('/login');
              }}
              className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto dark:bg-slate-950">
          {children}
        </div>
      </main>
    </div>
  );
}
