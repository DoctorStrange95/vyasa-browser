'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { papersApi, type Paper, ApiError } from '@/lib/api';

const STATUS_STYLES: Record<Paper['status'], string> = {
  draft: 'bg-slate-100 text-slate-600',
  review: 'bg-yellow-50 text-yellow-700',
  published: 'bg-green-50 text-green-700',
};

export default function PapersPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAbstract, setNewAbstract] = useState('');
  const [creating, setCreating] = useState(false);

  const [deleting, setDeleting] = useState<number | null>(null);

  useEffect(() => {
    papersApi.list()
      .then(setPapers)
      .catch((e) => setError(e instanceof ApiError ? `Error ${e.status}` : 'Failed to load papers'))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const paper = await papersApi.create(newTitle.trim(), newAbstract.trim() || undefined);
      setPapers((prev) => [paper, ...prev]);
      setShowCreate(false);
      setNewTitle('');
      setNewAbstract('');
    } catch {
      // user sees inline error
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await papersApi.delete(id);
      setPapers((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore — user can retry
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-3xl font-bold text-slate-900">My Papers</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition"
        >
          New Paper
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-8">
            <h3 className="text-xl font-bold text-slate-900 mb-6">New Paper</h3>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter paper title"
                  autoFocus
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Abstract <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={newAbstract}
                  onChange={(e) => setNewAbstract(e.target.value)}
                  placeholder="Brief summary of your research"
                  rows={3}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
                >
                  {creating ? 'Creating…' : 'Create Paper'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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

      {!loading && !error && papers.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-5xl mb-4">📄</div>
          <p className="text-slate-600 font-medium">No papers yet</p>
          <p className="text-slate-500 text-sm mt-1">Create your first research paper to get started</p>
        </div>
      )}

      <div className="space-y-4">
        {papers.map((paper) => (
          <div key={paper.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <Link
                  href={`/papers/${paper.id}`}
                  className="text-base font-bold text-slate-900 hover:text-teal-700 transition leading-snug"
                >
                  {paper.title}
                </Link>
                {paper.abstract && (
                  <p className="text-sm text-slate-500 mt-1 line-clamp-2">{paper.abstract}</p>
                )}
                <div className="flex items-center gap-3 mt-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${STATUS_STYLES[paper.status]}`}>
                    {paper.status}
                  </span>
                  {paper.doi && (
                    <a
                      href={`https://doi.org/${paper.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-teal-600 hover:underline"
                    >
                      {paper.doi}
                    </a>
                  )}
                  <span className="text-xs text-slate-400">
                    Updated {new Date(paper.updated_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Link
                  href={`/papers/${paper.id}`}
                  className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-sm font-medium transition"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(paper.id)}
                  disabled={deleting === paper.id}
                  className="px-3 py-1.5 text-red-400 hover:text-red-600 text-sm transition disabled:opacity-40"
                >
                  {deleting === paper.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
