'use client';

import { useEffect, useState } from 'react';
import { searchApi, type LibraryEntry, ApiError } from '@/lib/api';

export default function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    searchApi.library()
      .then(setEntries)
      .catch((e) => setError(e instanceof ApiError ? `Error ${e.status}` : 'Failed to load library'))
      .finally(() => setLoading(false));
  }, []);

  async function handleRemove(articleId: number) {
    setRemoving(articleId);
    try {
      await searchApi.removeFromLibrary(articleId);
      setEntries((prev) => prev.filter((e) => e.article.id !== articleId));
    } catch {
      // Silently ignore — user can retry
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-slate-900">My Library</h2>
        <span className="text-slate-500 text-sm">{entries.length} saved article{entries.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-slate-600 font-medium">Your library is empty</p>
          <p className="text-slate-400 text-sm mt-1">
            Save articles from the{' '}
            <a href="/search" className="text-teal-600 hover:underline">
              Search page
            </a>{' '}
            to see them here.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {entries.map(({ article, notes, tags, added_at }) => (
          <div key={article.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-slate-900 leading-snug mb-1">
                  {article.title}
                </h3>
                <p className="text-sm text-slate-500 mb-2">
                  {article.authors?.slice(0, 3).join(', ')}
                  {(article.authors?.length ?? 0) > 3 ? ' et al.' : ''}
                  {article.year ? ` · ${article.year}` : ''}
                  {article.journal ? ` · ${article.journal}` : ''}
                </p>

                {article.abstract && (
                  <p className="text-sm text-slate-600 line-clamp-2">{article.abstract}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium uppercase">
                    {article.source}
                  </span>
                  {tags?.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-teal-50 text-teal-700 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                  {notes && (
                    <span className="text-xs text-slate-400 italic truncate max-w-xs">
                      Note: {notes}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 shrink-0">
                {article.doi && (
                  <a
                    href={`https://doi.org/${article.doi}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline"
                  >
                    DOI ↗
                  </a>
                )}
                {article.url && !article.doi && (
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-teal-600 hover:underline"
                  >
                    View ↗
                  </a>
                )}
                <button
                  onClick={() => handleRemove(article.id)}
                  disabled={removing === article.id}
                  className="text-xs text-red-400 hover:text-red-600 transition disabled:opacity-40"
                >
                  {removing === article.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-3">
              Saved {new Date(added_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
