'use client';

import { useState } from 'react';
import { searchApi, type Article, ApiError } from '@/lib/api';

type SavedMap = Record<number, boolean>;

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState('all');
  const [yearFrom, setYearFrom] = useState('');
  const [studyType, setStudyType] = useState('');

  const [results, setResults] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState<SavedMap>({});
  const [saving, setSaving] = useState<number | null>(null);

  async function fetchPage(p: number) {
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number | boolean> = {
        q: query, source, page: p, per_page: 20,
      };
      if (yearFrom) params.year_from = parseInt(yearFrom);
      if (studyType) params.study_type = studyType;

      const data = await searchApi.search(params);
      setResults(data.items);
      setTotal(data.total);
      setPage(data.page);
      setPages(data.pages);
    } catch (e) {
      setError(e instanceof ApiError ? `Search failed (${e.status})` : 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    fetchPage(1);
  }

  async function handleSave(article: Article) {
    setSaving(article.id);
    try {
      await searchApi.save(article.id);
      setSaved((prev) => ({ ...prev, [article.id]: true }));
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  }

  function handleCite(article: Article) {
    // Vancouver style
    const authors = (article.authors ?? []).slice(0, 3).join(', ') +
      ((article.authors?.length ?? 0) > 3 ? ' et al' : '');
    const parts = [
      authors,
      article.title,
      article.journal,
      article.year,
      article.doi ? `doi:${article.doi}` : article.url,
    ].filter(Boolean).join('. ');
    navigator.clipboard?.writeText(parts).catch(() => {});
  }

  return (
    <div className="p-8">
      <h2 className="text-3xl font-bold text-slate-900 mb-8">Literature Search</h2>

      {/* Search Form */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <form onSubmit={handleSearch} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Search Query</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., dengue vector control India"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="all">All Sources</option>
                <option value="pubmed">PubMed</option>
                <option value="scholar">Google Scholar</option>
                <option value="idsp">IDSP</option>
                <option value="mohfw">MoHFW</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Year from</label>
              <input
                type="number"
                value={yearFrom}
                onChange={(e) => setYearFrom(e.target.value)}
                placeholder="e.g. 2015"
                min="1900"
                max="2100"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Study type</label>
              <select
                value={studyType}
                onChange={(e) => setStudyType(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-sm"
              >
                <option value="">Any</option>
                <option value="RCT">RCT</option>
                <option value="Cohort Study">Cohort</option>
                <option value="Systematic Review">Systematic Review</option>
                <option value="Meta-Analysis">Meta-Analysis</option>
                <option value="Surveillance Report">Surveillance Report</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-lg transition disabled:opacity-50"
              >
                {loading ? 'Searching…' : 'Search'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Results header */}
      {total > 0 && (
        <p className="text-sm text-slate-500 mb-4">
          {total.toLocaleString()} result{total !== 1 ? 's' : ''} · page {page} of {pages}
        </p>
      )}

      {/* Empty state */}
      {!loading && results.length === 0 && query && !error && (
        <div className="text-center py-16 text-slate-400">No articles found for this query.</div>
      )}

      {/* Results */}
      <div className="space-y-4">
        {results.map((article) => (
          <div key={article.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
            <div className="flex items-start gap-4">
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
                  <p className="text-sm text-slate-600 line-clamp-3">{article.abstract}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs rounded font-medium uppercase">
                    {article.source}
                  </span>
                  {article.study_type && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded">
                      {article.study_type}
                    </span>
                  )}
                  {article.disease_category && (
                    <span className="px-2 py-0.5 bg-green-50 text-green-700 text-xs rounded">
                      {article.disease_category}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => handleSave(article)}
                  disabled={saving === article.id || saved[article.id]}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    saved[article.id]
                      ? 'bg-teal-100 text-teal-700 cursor-default'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  } disabled:opacity-50`}
                >
                  {saving === article.id ? '…' : saved[article.id] ? 'Saved ✓' : 'Save'}
                </button>
                <button
                  onClick={() => handleCite(article)}
                  className="px-3 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded text-sm font-medium transition"
                  title="Copy Vancouver citation to clipboard"
                >
                  Cite
                </button>
                {(article.doi || article.url) && (
                  <a
                    href={article.doi ? `https://doi.org/${article.doi}` : article.url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-center bg-slate-50 hover:bg-slate-100 text-slate-600 rounded text-sm transition"
                  >
                    View ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button
            onClick={() => fetchPage(page - 1)}
            disabled={page <= 1 || loading}
            className="px-4 py-2 rounded border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50"
          >
            ← Prev
          </button>
          <span className="px-4 py-2 text-sm text-slate-600">
            {page} / {pages}
          </span>
          <button
            onClick={() => fetchPage(page + 1)}
            disabled={page >= pages || loading}
            className="px-4 py-2 rounded border border-slate-300 text-sm disabled:opacity-40 hover:bg-slate-50"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
