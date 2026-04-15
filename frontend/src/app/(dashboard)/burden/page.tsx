'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BurdenRecord {
  id: number;
  disease: string;
  metric: string;
  country_code: string | null;
  state: string | null;
  year: number;
  value: number | null;
  lower_ci: number | null;
  upper_ci: number | null;
  unit: string | null;
  age_group: string | null;
  sex: string | null;
  source: string;
}

interface ResearchGap {
  disease: string;
  burden_records: number;
  latest_daly_rate: number | null;
  latest_deaths: number | null;
  pubmed_articles: number;
  scholar_articles: number;
  total_research: number;
  gap_score: number;
  gap_label: string;
}

// ---------------------------------------------------------------------------
// Source badge colours
// ---------------------------------------------------------------------------

const SOURCE_COLOURS: Record<string, string> = {
  who_gho:  'bg-blue-100 text-blue-800',
  ihme_gbd: 'bg-purple-100 text-purple-800',
  icmr:     'bg-orange-100 text-orange-800',
  nfhs:     'bg-green-100 text-green-800',
  idsp_sum: 'bg-red-100 text-red-800',
};

const GAP_COLOURS: Record<string, string> = {
  'Critical Gap':    'bg-red-100 text-red-800 border border-red-200',
  'Significant Gap': 'bg-orange-100 text-orange-800 border border-orange-200',
  'Moderate Gap':    'bg-yellow-100 text-yellow-800 border border-yellow-200',
  'Well Researched': 'bg-green-100 text-green-800 border border-green-200',
};

// ---------------------------------------------------------------------------
// Simple bar chart using CSS widths (no external chart lib dependency)
// ---------------------------------------------------------------------------

function BurdenBar({ records, metric }: { records: BurdenRecord[]; metric: string }) {
  const filtered = records.filter(r => r.metric.toLowerCase().includes(metric.toLowerCase()) && r.state && r.value !== null);
  if (filtered.length === 0) return null;
  const max = Math.max(...filtered.map(r => r.value!));
  return (
    <div className="space-y-2">
      {filtered.slice(0, 12).map(r => (
        <div key={r.id} className="flex items-center gap-3">
          <span className="text-xs text-slate-600 w-36 truncate flex-shrink-0">{r.state}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-4 relative">
            <div
              className="bg-teal-500 h-4 rounded-full transition-all"
              style={{ width: `${(r.value! / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-slate-700 w-28 text-right flex-shrink-0">
            {r.value!.toLocaleString('en-IN')} {r.unit || ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trend sparkline (year-wise)
// ---------------------------------------------------------------------------

function TrendLine({ records, disease }: { records: BurdenRecord[]; disease: string }) {
  const byYear = records
    .filter(r => r.disease === disease && r.state === null && r.value !== null)
    .sort((a, b) => a.year - b.year);

  if (byYear.length < 2) return null;
  const max = Math.max(...byYear.map(r => r.value!));
  const min = Math.min(...byYear.map(r => r.value!));
  const range = max - min || 1;
  const W = 120, H = 40;
  const pts = byYear.map((r, i) => {
    const x = (i / (byYear.length - 1)) * W;
    const y = H - ((r.value! - min) / range) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#14b8a6" strokeWidth="2" strokeLinejoin="round" />
      {byYear.map((r, i) => {
        const x = (i / (byYear.length - 1)) * W;
        const y = H - ((r.value! - min) / range) * H;
        return <circle key={i} cx={x} cy={y} r={3} fill="#14b8a6" />;
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function BurdenPage() {
  const [tab, setTab] = useState<'dashboard' | 'gaps' | 'statewise'>('dashboard');
  const [diseases, setDiseases] = useState<string[]>([]);
  const [selectedDisease, setSelectedDisease] = useState('');
  const [records, setRecords] = useState<BurdenRecord[]>([]);
  const [gaps, setGaps] = useState<ResearchGap[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [stateFilter, setStateFilter] = useState('');

  // ── Load diseases list on mount ──────────────────────────────────────────
  useEffect(() => {
    api.get<string[]>('/api/burden/diseases')
      .then(data => {
        setDiseases(data);
        if (data.length > 0) setSelectedDisease(data[0]);
      })
      .catch(() => setError('Failed to load burden data. Run a refresh first.'));
  }, []);

  // ── Load records when disease changes ────────────────────────────────────
  const loadRecords = useCallback(async (disease: string) => {
    if (!disease) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get<BurdenRecord[]>(
        `/api/burden/search?disease=${encodeURIComponent(disease)}&limit=200`
      );
      setRecords(data);
    } catch {
      setError('Failed to load records for ' + disease);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedDisease) loadRecords(selectedDisease);
  }, [selectedDisease, loadRecords]);

  // ── Load research gaps ───────────────────────────────────────────────────
  const loadGaps = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ResearchGap[]>('/api/burden/research-gap?country_code=IND&year=2022');
      setGaps(data);
    } catch {
      setError('Failed to load research gaps');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'gaps') loadGaps();
  }, [tab, loadGaps]);

  // ── Refresh burden data ──────────────────────────────────────────────────
  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.post('/api/burden/refresh', {});
      setTimeout(() => {
        loadRecords(selectedDisease);
        setRefreshing(false);
      }, 3000);
    } catch {
      setRefreshing(false);
    }
  };

  // ── Filtered records for state-wise tab ──────────────────────────────────
  const stateRecords = records.filter(r =>
    r.state !== null &&
    (stateFilter === '' || r.state.toLowerCase().includes(stateFilter.toLowerCase()))
  );

  const nationalRecords = records.filter(r => r.state === null);

  // ── Search across all burden data ────────────────────────────────────────
  const [searchResults, setSearchResults] = useState<BurdenRecord[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const data = await api.get<BurdenRecord[]>(
        `/api/burden/search?disease=${encodeURIComponent(searchQuery)}&limit=100`
      );
      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── Source label mapping ─────────────────────────────────────────────────
  const SOURCE_LABELS: Record<string, string> = {
    who_gho: 'WHO GHO',
    ihme_gbd: 'IHME GBD',
    icmr: 'ICMR/NVBDCP',
    nfhs: 'NFHS-5',
    idsp_sum: 'IDSP',
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Disease Burden Dashboard</h1>
          <p className="text-slate-500 mt-1">
            WHO GHO · IHME GBD · ICMR · NFHS-5 — India focus
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 text-sm font-medium"
        >
          {refreshing ? 'Refreshing data...' : 'Refresh from Sources'}
        </button>
      </div>

      {/* Search bar */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder="Search any disease or metric..."
          className="flex-1 border border-slate-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-5 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-700 text-sm font-medium disabled:opacity-50"
        >
          {searching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="mb-6 bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Search Results ({searchResults.length})</h2>
            <button onClick={() => setSearchResults([])} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2 font-medium">Disease</th>
                  <th className="pb-2 font-medium">Metric</th>
                  <th className="pb-2 font-medium">Region</th>
                  <th className="pb-2 font-medium">Year</th>
                  <th className="pb-2 font-medium">Value</th>
                  <th className="pb-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {searchResults.slice(0, 30).map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-800">{r.disease}</td>
                    <td className="py-2 text-slate-600 max-w-xs truncate">{r.metric}</td>
                    <td className="py-2 text-slate-600">{r.state || r.country_code || 'India'}</td>
                    <td className="py-2 text-slate-600">{r.year}</td>
                    <td className="py-2 font-mono text-slate-800">
                      {r.value !== null ? r.value.toLocaleString('en-IN') : '—'} {r.unit || ''}
                    </td>
                    <td className="py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLOURS[r.source] || 'bg-slate-100 text-slate-700'}`}>
                        {SOURCE_LABELS[r.source] || r.source}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
          {error} — Click <strong>Refresh from Sources</strong> to pull data from WHO/IHME/ICMR.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-slate-100 rounded-xl p-1 w-fit">
        {(['dashboard', 'gaps', 'statewise'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition ${
              tab === t ? 'bg-white text-slate-900 shadow' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'dashboard' ? 'National Burden' : t === 'gaps' ? 'Research Gaps' : 'State-wise'}
          </button>
        ))}
      </div>

      {/* ── Tab: National Burden ── */}
      {tab === 'dashboard' && (
        <div className="grid grid-cols-4 gap-6">
          {/* Disease selector */}
          <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">Diseases</h2>
            <div className="space-y-1 max-h-[60vh] overflow-y-auto">
              {diseases.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDisease(d)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${
                    selectedDisease === d
                      ? 'bg-teal-600 text-white'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Records panel */}
          <div className="col-span-3 space-y-6">
            {loading ? (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
                Loading burden data...
              </div>
            ) : (
              <>
                {/* Stat cards */}
                <div className="grid grid-cols-3 gap-4">
                  {nationalRecords.slice(0, 6).map(r => (
                    <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5">
                      <div className="text-xs text-slate-500 mb-1">{r.metric}</div>
                      <div className="text-2xl font-bold text-slate-900">
                        {r.value !== null ? r.value.toLocaleString('en-IN') : '—'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{r.unit} · {r.year}</div>
                      {r.lower_ci !== null && r.upper_ci !== null && (
                        <div className="text-xs text-slate-400">
                          95% UI: {r.lower_ci.toFixed(1)} – {r.upper_ci.toFixed(1)}
                        </div>
                      )}
                      <div className="mt-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLOURS[r.source] || 'bg-slate-100 text-slate-600'}`}>
                          {SOURCE_LABELS[r.source] || r.source}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trend chart */}
                {selectedDisease && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">
                      Trend — {selectedDisease}
                    </h3>
                    <TrendLine records={nationalRecords} disease={selectedDisease} />
                    {nationalRecords.filter(r => r.disease === selectedDisease).length === 0 && (
                      <p className="text-slate-400 text-sm">No time-series data for this disease.</p>
                    )}
                  </div>
                )}

                {/* Full records table */}
                {nationalRecords.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4">All National Records</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-slate-500 border-b">
                            <th className="pb-2 font-medium">Metric</th>
                            <th className="pb-2 font-medium">Year</th>
                            <th className="pb-2 font-medium">Value</th>
                            <th className="pb-2 font-medium">Sex</th>
                            <th className="pb-2 font-medium">Source</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {nationalRecords.map(r => (
                            <tr key={r.id} className="hover:bg-slate-50">
                              <td className="py-2 text-slate-700 max-w-xs">{r.metric}</td>
                              <td className="py-2 text-slate-600">{r.year}</td>
                              <td className="py-2 font-mono font-medium text-slate-800">
                                {r.value !== null ? r.value.toLocaleString('en-IN') : '—'} {r.unit || ''}
                              </td>
                              <td className="py-2 text-slate-500 capitalize">{r.sex || '—'}</td>
                              <td className="py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLOURS[r.source] || 'bg-slate-100 text-slate-700'}`}>
                                  {SOURCE_LABELS[r.source] || r.source}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Research Gaps ── */}
      {tab === 'gaps' && (
        <div className="space-y-6">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
            <h2 className="font-semibold text-amber-900 mb-1">Research Gap Analysis</h2>
            <p className="text-amber-800 text-sm">
              Compares disease burden (DALYs, deaths) against the volume of research publications.
              Diseases with high burden but low research are flagged as Critical Gaps — key targets
              for promoting new research.
            </p>
          </div>

          {loading ? (
            <div className="text-center text-slate-500 py-12">Calculating research gaps...</div>
          ) : gaps.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              No data yet. Refresh burden data and ensure articles are indexed.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {gaps.map(g => (
                <div key={g.disease} className="bg-white rounded-xl border border-slate-200 p-5">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-slate-800">{g.disease}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${GAP_COLOURS[g.gap_label] || 'bg-slate-100 text-slate-700'}`}>
                      {g.gap_label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-slate-500 text-xs">DALY Rate</div>
                      <div className="font-mono font-medium text-slate-800">
                        {g.latest_daly_rate !== null ? g.latest_daly_rate.toFixed(1) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Deaths</div>
                      <div className="font-mono font-medium text-slate-800">
                        {g.latest_deaths !== null ? g.latest_deaths.toLocaleString('en-IN') : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Research Articles</div>
                      <div className="font-mono font-medium text-slate-800">{g.total_research.toLocaleString()}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 text-xs">Gap Score</div>
                      <div className="font-mono font-bold text-teal-700">{g.gap_score}</div>
                    </div>
                  </div>
                  {/* Mini bar: burden vs research */}
                  <div className="mt-4 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="w-16">PubMed</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (g.pubmed_articles / (Math.max(...gaps.map(x => x.pubmed_articles), 1))) * 100)}%` }}
                        />
                      </div>
                      <span>{g.pubmed_articles}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="w-16">Scholar</span>
                      <div className="flex-1 bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-violet-500 h-2 rounded-full"
                          style={{ width: `${Math.min(100, (g.scholar_articles / (Math.max(...gaps.map(x => x.scholar_articles), 1))) * 100)}%` }}
                        />
                      </div>
                      <span>{g.scholar_articles}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: State-wise ── */}
      {tab === 'statewise' && (
        <div className="space-y-6">
          <div className="flex gap-4 items-center">
            <select
              value={selectedDisease}
              onChange={e => setSelectedDisease(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {diseases.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input
              type="text"
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              placeholder="Filter by state..."
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {loading ? (
            <div className="text-center text-slate-500 py-12">Loading state data...</div>
          ) : stateRecords.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              No state-wise data for {selectedDisease}.
            </div>
          ) : (
            <>
              {/* Group by metric */}
              {Array.from(new Set(stateRecords.map(r => r.metric))).map(metric => {
                const metricRecs = stateRecords.filter(r => r.metric === metric);
                return (
                  <div key={metric} className="bg-white rounded-xl border border-slate-200 p-6">
                    <h3 className="font-semibold text-slate-800 mb-4">
                      {metric}
                      <span className="ml-2 text-xs text-slate-400 font-normal">
                        {metricRecs[0]?.unit || ''} · {metricRecs[0]?.year}
                      </span>
                    </h3>
                    <BurdenBar records={metricRecs} metric="" />
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}
