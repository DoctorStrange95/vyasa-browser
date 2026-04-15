'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { papersApi, searchApi, analysisApi } from '@/lib/api';

interface Stats {
  papers: number;
  savedArticles: number;
  datasets: number;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({ papers: 0, savedArticles: 0, datasets: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      papersApi.list().catch(() => [] as unknown[]),
      searchApi.library().catch(() => [] as unknown[]),
      analysisApi.datasets().catch(() => [] as unknown[]),
    ]).then(([papers, library, datasets]) => {
      setStats({
        papers: (papers as unknown[]).length,
        savedArticles: (library as unknown[]).length,
        datasets: (datasets as unknown[]).length,
      });
    }).finally(() => setLoading(false));
  }, []);

  const statCards = [
    { title: 'My Papers', value: stats.papers, icon: '📄', href: '/papers' },
    { title: 'Saved Articles', value: stats.savedArticles, icon: '📚', href: '/library' },
    { title: 'Datasets', value: stats.datasets, icon: '📈', href: '/analysis' },
  ];

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Welcome to HealthScholar</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        {statCards.map((stat) => (
          <Link key={stat.title} href={stat.href} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
            <div className="text-3xl mb-2">{stat.icon}</div>
            <p className="text-slate-600 text-sm">{stat.title}</p>
            <p className="text-2xl font-bold text-slate-900">
              {loading ? (
                <span className="inline-block w-8 h-6 bg-slate-100 rounded animate-pulse" />
              ) : stat.value}
            </p>
          </Link>
        ))}
      </div>

      <h3 className="text-xl font-bold text-slate-900 mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/search"
          className="bg-teal-50 border-2 border-teal-200 rounded-lg p-6 hover:border-teal-400 transition"
        >
          <div className="text-3xl mb-2">🔍</div>
          <h4 className="font-bold text-slate-900">Search Literature</h4>
          <p className="text-sm text-slate-600">Find articles from PubMed, Scholar, IDSP &amp; MoHFW</p>
        </Link>

        <Link
          href="/papers"
          className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 hover:border-blue-400 transition"
        >
          <div className="text-3xl mb-2">✍️</div>
          <h4 className="font-bold text-slate-900">Write Paper</h4>
          <p className="text-sm text-slate-600">Create and edit your research manuscript</p>
        </Link>

        <Link
          href="/analysis"
          className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 hover:border-purple-400 transition"
        >
          <div className="text-3xl mb-2">📊</div>
          <h4 className="font-bold text-slate-900">Analyze Data</h4>
          <p className="text-sm text-slate-600">Upload datasets and run statistical tests</p>
        </Link>
      </div>
    </div>
  );
}
