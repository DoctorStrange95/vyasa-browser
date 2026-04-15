'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  papersApi, api, citationsApi, pdfsApi,
  type PaperDetail, type PdfDoc, ApiError,
} from '@/lib/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Section {
  heading: string;
  body: string;
}

interface PaperContent {
  sections: Section[];
  references: string[];
}

interface BurdenStat {
  id: number;
  disease: string;
  metric: string;
  year: number;
  value: number | null;
  unit: string | null;
  state: string | null;
  source: string;
}

interface ContextualBurden {
  disease: string;
  stats: BurdenStat[];
  summary: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const DEFAULT_SECTIONS: Section[] = [
  { heading: 'Introduction', body: '' },
  { heading: 'Methods', body: '' },
  { heading: 'Results', body: '' },
  { heading: 'Discussion', body: '' },
  { heading: 'Conclusion', body: '' },
];

const CITATION_STYLES = ['vancouver', 'apa', 'harvard', 'mla', 'chicago', 'ama', 'nature'];

const AI_EDIT_ACTIONS = [
  { key: 'improve',    label: 'Improve' },
  { key: 'simplify',  label: 'Simplify' },
  { key: 'formal',    label: 'Make Formal' },
  { key: 'paraphrase',label: 'Paraphrase' },
  { key: 'shorten',   label: 'Shorten' },
  { key: 'expand',    label: 'Expand' },
  { key: 'translate', label: 'Translate' },
];

function parseContent(raw: Record<string, unknown> | null): PaperContent {
  if (!raw) return { sections: DEFAULT_SECTIONS, references: [] };
  return {
    sections: Array.isArray(raw.sections)
      ? (raw.sections as Section[])
      : DEFAULT_SECTIONS,
    references: Array.isArray(raw.references) ? (raw.references as string[]) : [],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PaperEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const paperId = Number(params.id);

  const [paper, setPaper] = useState<PaperDetail | null>(null);
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [content, setContent] = useState<PaperContent>({ sections: DEFAULT_SECTIONS, references: [] });
  const [status, setStatus] = useState<PaperDetail['status']>('draft');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [error, setError] = useState('');

  // Active section index (-1 = references panel)
  const [activeSection, setActiveSection] = useState(0);

  // AI generate (section)
  const [generating, setGenerating] = useState<number | null>(null);
  const [generatingAbstract, setGeneratingAbstract] = useState(false);
  const [abstractFeedback, setAbstractFeedback] = useState<string>('');

  // ── AI Edit toolbar ──────────────────────────────────────────────────────
  const [editToolbarVisible, setEditToolbarVisible] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [editSectionIndex, setEditSectionIndex] = useState<number>(0);
  const [editLoading, setEditLoading] = useState(false);
  const activeTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // ── Inline autocomplete ───────────────────────────────────────────────────
  const [autocompleteText, setAutocompleteText] = useState('');
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const autocompleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Literature review ─────────────────────────────────────────────────────
  const [litReviewOpen, setLitReviewOpen] = useState(false);
  const [litReviewStyle, setLitReviewStyle] = useState<'narrative' | 'thematic' | 'chronological' | 'systematic'>('narrative');
  const [litReviewText, setLitReviewText] = useState('');
  const [generatingLitReview, setGeneratingLitReview] = useState(false);
  const [litReviewError, setLitReviewError] = useState('');

  // ── Burden sidebar ────────────────────────────────────────────────────────
  const [burdenOpen, setBurdenOpen] = useState(false);
  const [burdenData, setBurdenData] = useState<ContextualBurden | null>(null);
  const [burdenLoading, setBurdenLoading] = useState(false);

  // ── PDF Chat ──────────────────────────────────────────────────────────────
  const [pdfChatOpen, setPdfChatOpen] = useState(false);
  const [pdfs, setPdfs] = useState<PdfDoc[]>([]);
  const [pdfsLoading, setPdfsLoading] = useState(false);
  const [activePdfId, setActivePdfId] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // ── References ────────────────────────────────────────────────────────────
  const [newRef, setNewRef] = useState('');
  const [citationStyle, setCitationStyle] = useState('vancouver');
  const [resolvingCitation, setResolvingCitation] = useState(false);
  const [resolveError, setResolveError] = useState('');

  // ── Publishing / export ───────────────────────────────────────────────────
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!paperId) return;
    papersApi.get(paperId)
      .then((p) => {
        setPaper(p);
        setTitle(p.title);
        setAbstract(p.abstract ?? '');
        setContent(parseContent(p.content));
        setStatus(p.status);
      })
      .catch((e) => setError(e instanceof ApiError ? `Error ${e.status}` : 'Failed to load paper'))
      .finally(() => setLoading(false));
  }, [paperId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  const save = useCallback(async (silent = false) => {
    if (!paperId) return;
    if (!silent) setSaving(true);
    try {
      await papersApi.update(paperId, {
        title: title.trim() || 'Untitled',
        abstract: abstract.trim() || undefined,
        content: content as unknown as Record<string, unknown>,
        status,
      });
      if (!silent) {
        setSaveMsg('Saved');
        setTimeout(() => setSaveMsg(''), 2000);
      }
    } catch {
      if (!silent) setSaveMsg('Save failed');
    } finally {
      if (!silent) setSaving(false);
    }
  }, [paperId, title, abstract, content, status]);

  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; }, [save]);

  useEffect(() => {
    const interval = setInterval(() => saveRef.current(true), 30_000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Section helpers
  // ---------------------------------------------------------------------------

  function updateSection(index: number, field: keyof Section, value: string) {
    setContent((prev) => {
      const sections = prev.sections.map((s, i) =>
        i === index ? { ...s, [field]: value } : s
      );
      return { ...prev, sections };
    });
  }

  function addSection() {
    setContent((prev) => ({
      ...prev,
      sections: [...prev.sections, { heading: 'New Section', body: '' }],
    }));
    setActiveSection(content.sections.length);
  }

  function removeSection(index: number) {
    setContent((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== index),
    }));
    setActiveSection((prev) => Math.max(0, prev - 1));
  }

  // ---------------------------------------------------------------------------
  // References
  // ---------------------------------------------------------------------------

  function addReference(text?: string) {
    const val = (text ?? newRef).trim();
    if (!val) return;
    setContent((prev) => ({
      ...prev,
      references: [...prev.references, val],
    }));
    setNewRef('');
    setResolveError('');
  }

  function removeReference(index: number) {
    setContent((prev) => ({
      ...prev,
      references: prev.references.filter((_, i) => i !== index),
    }));
  }

  // Smart paste: detect DOI or PMID and auto-resolve
  async function handleRefPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').trim();
    const isDoi = /\b10\.\d{4,}\//.test(pasted);
    const isPmid = /^\d{6,9}$/.test(pasted);
    if (!isDoi && !isPmid) return;

    e.preventDefault();
    setNewRef(pasted);
    setResolvingCitation(true);
    setResolveError('');
    try {
      const resolved = await citationsApi.resolve(pasted);
      if (resolved.citation_text) {
        addReference(resolved.citation_text);
      } else {
        setNewRef(pasted);
        setResolveError('Could not fully resolve — add manually.');
      }
    } catch {
      setNewRef(pasted);
      setResolveError('Resolve failed — add manually or try again.');
    } finally {
      setResolvingCitation(false);
    }
  }

  // Manual resolve button
  async function handleResolveRef() {
    if (!newRef.trim()) return;
    setResolvingCitation(true);
    setResolveError('');
    try {
      const resolved = await citationsApi.resolve(newRef.trim());
      if (resolved.citation_text) {
        addReference(resolved.citation_text);
      } else {
        setResolveError('Could not resolve — add manually.');
      }
    } catch {
      setResolveError('Resolve failed.');
    } finally {
      setResolvingCitation(false);
    }
  }

  // Insert lit review text into Introduction section
  function insertLitReviewIntoEditor() {
    const introIdx = content.sections.findIndex(s => s.heading.toLowerCase() === 'introduction');
    const targetIdx = introIdx >= 0 ? introIdx : activeSection >= 0 ? activeSection : 0;
    updateSection(targetIdx, 'body',
      (content.sections[targetIdx]?.body ? content.sections[targetIdx].body + '\n\n' : '') + litReviewText
    );
    setLitReviewOpen(false);
    if (introIdx >= 0) setActiveSection(introIdx);
  }

  // Insert a burden stat as a sentence into the current section
  function insertBurdenStat(stat: BurdenStat) {
    const sentence = `According to ${statSourceLabel(stat.source)} data (${stat.year}), the ${stat.metric.toLowerCase()} for ${stat.disease} in ${stat.state || 'India'} was ${stat.value?.toLocaleString('en-IN')} ${stat.unit || ''}.`;
    const idx = activeSection >= 0 && activeSection < content.sections.length ? activeSection : 0;
    updateSection(idx, 'body',
      (content.sections[idx].body ? content.sections[idx].body + ' ' : '') + sentence
    );
  }

  function statSourceLabel(src: string) {
    const map: Record<string, string> = {
      who_gho: 'WHO GHO', ihme_gbd: 'IHME GBD', icmr: 'ICMR',
      nfhs: 'NFHS-5', idsp_sum: 'IDSP',
    };
    return map[src] || src;
  }

  // ---------------------------------------------------------------------------
  // AI Edit toolbar
  // ---------------------------------------------------------------------------

  function handleTextareaSelect(
    e: React.MouseEvent<HTMLTextAreaElement> | React.KeyboardEvent<HTMLTextAreaElement>,
    sectionIndex: number,
  ) {
    const ta = e.currentTarget;
    const start = ta.selectionStart ?? 0;
    const end = ta.selectionEnd ?? 0;
    if (start !== end) {
      setSelectedText(ta.value.substring(start, end));
      setSelectionRange({ start, end });
      setEditSectionIndex(sectionIndex);
      setEditToolbarVisible(true);
      activeTextareaRef.current = ta;
    } else {
      setEditToolbarVisible(false);
      setSelectedText('');
    }
  }

  async function handleAiEdit(instruction: string) {
    if (!selectedText || selectionRange === null) return;
    setEditLoading(true);
    try {
      const result = await api.post<{ text: string }>(
        `/api/papers/${paperId}/ai-edit`,
        { text: selectedText, instruction }
      );
      // Replace selection in the section body
      const section = content.sections[editSectionIndex];
      if (!section) return;
      const newBody =
        section.body.substring(0, selectionRange.start) +
        result.text +
        section.body.substring(selectionRange.end);
      updateSection(editSectionIndex, 'body', newBody);
      setEditToolbarVisible(false);
      setSelectedText('');
    } catch {
      // ignore
    } finally {
      setEditLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Inline autocomplete
  // ---------------------------------------------------------------------------

  function handleSectionBodyChange(index: number, value: string) {
    updateSection(index, 'body', value);
    setAutocompleteText('');

    if (autocompleteTimerRef.current) clearTimeout(autocompleteTimerRef.current);
    if (value.trim().length < 40) return;

    autocompleteTimerRef.current = setTimeout(async () => {
      setAutocompleteLoading(true);
      try {
        const result = await api.post<{ completion: string }>(
          `/api/papers/${paperId}/autocomplete`,
          { text: value, section: content.sections[index]?.heading ?? '' }
        );
        if (result.completion) setAutocompleteText(result.completion);
      } catch {
        // silent
      } finally {
        setAutocompleteLoading(false);
      }
    }, 1800);
  }

  function acceptAutocomplete() {
    if (!autocompleteText || activeSection < 0 || activeSection >= content.sections.length) return;
    const section = content.sections[activeSection];
    updateSection(activeSection, 'body',
      section.body + (section.body.endsWith(' ') ? '' : ' ') + autocompleteText
    );
    setAutocompleteText('');
  }

  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Tab' && autocompleteText) {
      e.preventDefault();
      acceptAutocomplete();
    }
    if (e.key === 'Escape') setAutocompleteText('');
  }

  // ---------------------------------------------------------------------------
  // AI: generate section
  // ---------------------------------------------------------------------------

  async function handleGenerateSection(index: number) {
    setGenerating(index);
    setAutocompleteText('');
    try {
      const section = content.sections[index];
      const result = await api.post<{ text: string }>(`/api/papers/${paperId}/generate-section`, {
        section: section.heading,
        context: { title, abstract, references: [] },
      });
      updateSection(index, 'body', result.text);
    } catch {
      // ignore — user can retry
    } finally {
      setGenerating(null);
    }
  }

  // ---------------------------------------------------------------------------
  // AI: check abstract
  // ---------------------------------------------------------------------------

  async function handleCheckAbstract() {
    setGeneratingAbstract(true);
    setAbstractFeedback('');
    try {
      const result = await api.post<{
        imrad_checklist?: Record<string, boolean>;
        issues?: string[];
        score?: number;
        word_count?: number;
        raw?: string;
      }>(`/api/papers/${paperId}/check-abstract`, { abstract_text: abstract });
      const issues = result.issues?.join('; ') ?? '';
      const score = result.score != null ? `Score: ${result.score}/10` : '';
      const wc = result.word_count != null ? `${result.word_count} words` : '';
      setAbstractFeedback([score, wc, issues].filter(Boolean).join(' · ') || result.raw || 'Analysis complete');
    } catch {
      // ignore
    } finally {
      setGeneratingAbstract(false);
    }
  }

  // ---------------------------------------------------------------------------
  // AI: Literature Review
  // ---------------------------------------------------------------------------

  async function handleGenerateLitReview() {
    setGeneratingLitReview(true);
    setLitReviewText('');
    setLitReviewError('');
    try {
      const result = await api.post<{ text: string; style: string; references_used: number }>(
        `/api/papers/${paperId}/generate-literature-review`,
        { style: litReviewStyle }
      );
      setLitReviewText(result.text);
    } catch (e) {
      if (e instanceof ApiError && e.status === 400) {
        setLitReviewError('Add references to this paper first — go to the References panel.');
      } else {
        setLitReviewError('Failed to generate. Check ANTHROPIC_API_KEY is configured.');
      }
    } finally {
      setGeneratingLitReview(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Burden: contextual fetch
  // ---------------------------------------------------------------------------

  async function handleLoadBurden() {
    setBurdenLoading(true);
    setBurdenData(null);
    try {
      const result = await api.post<ContextualBurden>(
        `/api/burden/contextual?paper_id=${paperId}&country_code=IND`,
        {}
      );
      setBurdenData(result);
    } catch {
      setBurdenData({ disease: 'Unknown', stats: [], summary: 'No burden data found. Refresh from Burden Dashboard.' });
    } finally {
      setBurdenLoading(false);
    }
  }

  useEffect(() => {
    if (burdenOpen && !burdenData && !burdenLoading) {
      handleLoadBurden();
    }
  }, [burdenOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // PDF Chat
  // ---------------------------------------------------------------------------

  async function handleOpenPdfChat() {
    setPdfChatOpen(true);
    setPdfsLoading(true);
    try {
      const list = await pdfsApi.list();
      setPdfs(list);
    } catch {
      // ignore
    } finally {
      setPdfsLoading(false);
    }
  }

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPdf(true);
    try {
      const doc = await pdfsApi.upload(file);
      setPdfs((prev) => [doc, ...prev]);
      setActivePdfId(doc.id);
      setChatMessages([]);
    } catch {
      // ignore
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  }

  async function handlePdfDelete(id: number) {
    await pdfsApi.delete(id);
    setPdfs((prev) => prev.filter((d) => d.id !== id));
    if (activePdfId === id) {
      setActivePdfId(null);
      setChatMessages([]);
    }
  }

  async function handleChat(e: React.FormEvent) {
    e.preventDefault();
    if (!chatInput.trim() || !activePdfId || chatLoading) return;
    const question = chatInput.trim();
    setChatInput('');
    const userMsg: ChatMessage = { role: 'user', content: question };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const result = await pdfsApi.chat(
        activePdfId,
        question,
        chatMessages.map((m) => ({ role: m.role, content: m.content }))
      );
      setChatMessages((prev) => [...prev, { role: 'assistant', content: result.answer }]);
    } catch {
      setChatMessages((prev) => [...prev, { role: 'assistant', content: 'Error getting response. Try again.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ---------------------------------------------------------------------------
  // Publish
  // ---------------------------------------------------------------------------

  async function handlePublish() {
    setPublishing(true);
    setPublishError('');
    try {
      const res = await papersApi.publish(paperId);
      setPaper((prev) => prev ? { ...prev, doi: res.doi, status: 'published' } : prev);
      setStatus('published');
      setSaveMsg(`Published — DOI: ${res.doi}`);
    } catch (e) {
      setPublishError(e instanceof ApiError ? `Publish failed (${e.status})` : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Export
  // ---------------------------------------------------------------------------

  function handleExport(format: 'docx' | 'ris' | 'json') {
    const url = papersApi.export(paperId, format);
    save(true).then(() => window.open(url, '_blank'));
    setExportOpen(false);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
      </div>
    );
  }

  const currentSection = content.sections[activeSection];

  return (
    <div className="flex h-full">
      {/* Left nav */}
      <aside className="w-52 shrink-0 bg-slate-50 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <button
            onClick={() => router.push('/papers')}
            className="text-sm text-slate-500 hover:text-slate-900 transition"
          >
            ← Papers
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">Sections</p>
          {content.sections.map((section, i) => (
            <button
              key={i}
              onClick={() => { setActiveSection(i); setAutocompleteText(''); setEditToolbarVisible(false); }}
              className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                activeSection === i
                  ? 'bg-teal-100 text-teal-800 font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {section.heading || `Section ${i + 1}`}
            </button>
          ))}
          <button
            onClick={addSection}
            className="w-full text-left px-3 py-2 rounded text-sm text-slate-400 hover:text-teal-600 hover:bg-slate-100 transition"
          >
            + Add section
          </button>

          <div className="pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">References</p>
            <button
              onClick={() => { setActiveSection(-1); setEditToolbarVisible(false); }}
              className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                activeSection === -1
                  ? 'bg-teal-100 text-teal-800 font-medium'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              References ({content.references.length})
            </button>
          </div>

          {/* AI Tools */}
          <div className="pt-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-2">AI Tools</p>
            <button
              onClick={() => setLitReviewOpen(true)}
              className="w-full text-left px-3 py-2 rounded text-sm text-violet-700 hover:bg-violet-50 transition"
            >
              Literature Review
            </button>
            <button
              onClick={() => setBurdenOpen(o => !o)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                burdenOpen ? 'bg-teal-100 text-teal-800' : 'text-teal-700 hover:bg-teal-50'
              }`}
            >
              Burden Data
            </button>
            <button
              onClick={handleOpenPdfChat}
              className="w-full text-left px-3 py-2 rounded text-sm text-blue-700 hover:bg-blue-50 transition"
            >
              PDF Chat
            </button>
          </div>
        </nav>
      </aside>

      {/* Main editor */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as PaperDetail['status'])}
              className="text-sm border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-teal-500"
            >
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="published">Published</option>
            </select>
            {paper?.doi && (
              <a
                href={`https://doi.org/${paper.doi}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-teal-600 hover:underline"
              >
                {paper.doi}
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            {saveMsg && (
              <span className={`text-xs ${saveMsg.includes('fail') ? 'text-red-500' : 'text-teal-600'}`}>
                {saveMsg}
              </span>
            )}

            <button
              onClick={() => save(false)}
              disabled={saving}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <div className="relative" ref={exportRef}>
              <button
                onClick={() => setExportOpen((o) => !o)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm rounded transition"
              >
                Export ▾
              </button>
              {exportOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-10 min-w-[140px]">
                  {(['docx', 'ris', 'json'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => handleExport(fmt)}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 uppercase"
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {status !== 'published' && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="px-4 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded transition disabled:opacity-50"
              >
                {publishing ? 'Publishing…' : 'Publish & Get DOI'}
              </button>
            )}
          </div>
        </div>

        {publishError && (
          <div className="bg-red-50 border-b border-red-200 text-red-700 px-6 py-2 text-sm">
            {publishError}
          </div>
        )}

        <div className="flex-1 flex overflow-hidden">
          {/* Editor body */}
          <div className="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
            {/* Title & Abstract */}
            <div className="mb-8">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Paper title"
                className="w-full text-3xl font-bold text-slate-900 placeholder-slate-300 border-none outline-none bg-transparent mb-4"
              />
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">Abstract</label>
                  <button
                    onClick={handleCheckAbstract}
                    disabled={generatingAbstract || !abstract.trim()}
                    className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs rounded transition disabled:opacity-40"
                  >
                    {generatingAbstract ? 'Checking…' : 'AI Check'}
                  </button>
                </div>
                <textarea
                  value={abstract}
                  onChange={(e) => { setAbstract(e.target.value); setAbstractFeedback(''); }}
                  placeholder="Write your abstract here…"
                  rows={4}
                  className="w-full px-0 py-1 border-none outline-none resize-none text-slate-600 text-sm leading-relaxed bg-transparent"
                />
                {abstractFeedback && (
                  <p className="text-xs text-purple-600 bg-purple-50 rounded px-3 py-2 mt-1">{abstractFeedback}</p>
                )}
              </div>
              <hr className="border-slate-200 mt-4" />
            </div>

            {/* Section editor */}
            {activeSection >= 0 && activeSection < content.sections.length && currentSection && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    value={currentSection.heading}
                    onChange={(e) => updateSection(activeSection, 'heading', e.target.value)}
                    className="text-xl font-bold text-slate-900 border-none outline-none bg-transparent flex-1"
                  />
                  <div className="flex items-center gap-2 shrink-0 ml-4">
                    <button
                      onClick={() => handleGenerateSection(activeSection)}
                      disabled={generating === activeSection}
                      className="px-3 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs rounded transition disabled:opacity-40"
                    >
                      {generating === activeSection ? 'Generating…' : 'AI Generate'}
                    </button>
                    {content.sections.length > 1 && (
                      <button
                        onClick={() => removeSection(activeSection)}
                        className="px-3 py-1 text-red-400 hover:text-red-600 text-xs transition"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                {/* AI Edit toolbar — shown when text is selected */}
                {editToolbarVisible && editSectionIndex === activeSection && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3 p-2 bg-slate-900 rounded-lg shadow-lg">
                    <span className="text-xs text-slate-400 mr-1">AI Edit:</span>
                    {AI_EDIT_ACTIONS.map((action) => (
                      <button
                        key={action.key}
                        onClick={() => handleAiEdit(action.key)}
                        disabled={editLoading}
                        className="px-2.5 py-1 text-xs bg-slate-700 hover:bg-teal-600 text-slate-100 rounded transition disabled:opacity-40"
                      >
                        {editLoading ? '…' : action.label}
                      </button>
                    ))}
                    <button
                      onClick={() => { setEditToolbarVisible(false); setSelectedText(''); }}
                      className="ml-auto text-slate-500 hover:text-slate-300 text-xs px-1"
                    >
                      ✕
                    </button>
                  </div>
                )}

                <textarea
                  value={currentSection.body}
                  onChange={(e) => handleSectionBodyChange(activeSection, e.target.value)}
                  onMouseUp={(e) => handleTextareaSelect(e, activeSection)}
                  onKeyUp={(e) => handleTextareaSelect(e, activeSection)}
                  onKeyDown={handleBodyKeyDown}
                  placeholder={`Write your ${currentSection.heading.toLowerCase()} here…`}
                  rows={24}
                  className="w-full border-none outline-none resize-none text-slate-700 leading-relaxed text-sm bg-transparent"
                />

                {/* Autocomplete suggestion */}
                {(autocompleteText || autocompleteLoading) && (
                  <div className="mt-2 border border-dashed border-slate-300 rounded-lg p-3 bg-slate-50">
                    {autocompleteLoading ? (
                      <span className="text-xs text-slate-400 italic">AI is thinking…</span>
                    ) : (
                      <>
                        <p className="text-sm text-slate-400 italic leading-relaxed">{autocompleteText}</p>
                        <div className="mt-2 flex gap-2">
                          <button
                            onClick={acceptAutocomplete}
                            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-xs rounded transition"
                          >
                            Accept (Tab)
                          </button>
                          <button
                            onClick={() => setAutocompleteText('')}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs rounded transition"
                          >
                            Dismiss (Esc)
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* References panel */}
            {activeSection === -1 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-slate-900">References</h2>
                  <select
                    value={citationStyle}
                    onChange={e => setCitationStyle(e.target.value)}
                    className="text-sm border border-slate-300 rounded px-2 py-1 focus:ring-1 focus:ring-teal-500"
                    title="Citation style for new references"
                  >
                    {CITATION_STYLES.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>

                {/* Smart paste input */}
                <div className="mb-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newRef}
                      onChange={(e) => { setNewRef(e.target.value); setResolveError(''); }}
                      onPaste={handleRefPaste}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addReference())}
                      placeholder="Paste DOI, PMID, or citation text — auto-resolves"
                      className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent text-sm"
                    />
                    <button
                      onClick={handleResolveRef}
                      disabled={!newRef.trim() || resolvingCitation}
                      className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm rounded-lg transition disabled:opacity-50"
                      title="Resolve DOI/PMID to full citation"
                    >
                      {resolvingCitation ? '…' : 'Resolve'}
                    </button>
                    <button
                      onClick={() => addReference()}
                      disabled={!newRef.trim()}
                      className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Paste a DOI (10.xxx/…) or PMID (8-digit number) — the citation will be resolved automatically.
                  </p>
                  {resolveError && (
                    <p className="text-xs text-amber-600 mt-1">{resolveError}</p>
                  )}
                </div>

                {content.references.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-8">No references added yet</p>
                ) : (
                  <ol className="space-y-2 mt-4">
                    {content.references.map((ref, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-700">
                        <span className="text-slate-400 shrink-0 w-6 text-right">{i + 1}.</span>
                        <span className="flex-1 leading-relaxed">{ref}</span>
                        <button
                          onClick={() => removeReference(i)}
                          className="text-red-400 hover:text-red-600 shrink-0 transition"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            )}
          </div>

          {/* Right: Burden sidebar */}
          {burdenOpen && (
            <aside className="w-80 shrink-0 border-l border-slate-200 bg-slate-50 flex flex-col overflow-hidden">
              <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 text-sm">Burden Data</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleLoadBurden}
                    disabled={burdenLoading}
                    className="text-xs text-teal-600 hover:text-teal-800 disabled:opacity-50"
                  >
                    {burdenLoading ? 'Loading…' : 'Refresh'}
                  </button>
                  <button onClick={() => setBurdenOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {burdenLoading && (
                  <div className="text-center py-8 text-slate-500 text-sm">Fetching contextual burden data…</div>
                )}
                {burdenData && (
                  <>
                    <div className="bg-teal-50 rounded-lg p-3 text-xs text-teal-800 border border-teal-200">
                      <span className="font-semibold">Topic: {burdenData.disease}</span>
                      <br />{burdenData.summary}
                    </div>
                    {burdenData.stats.length === 0 && (
                      <p className="text-slate-400 text-xs text-center py-4">
                        No burden data matched. Visit Burden Dashboard → Refresh from Sources.
                      </p>
                    )}
                    {burdenData.stats.map((stat) => (
                      <div key={stat.id} className="bg-white rounded-lg border border-slate-200 p-3">
                        <div className="text-xs text-slate-500 mb-1">{stat.metric}</div>
                        <div className="text-lg font-bold text-slate-900">
                          {stat.value !== null ? stat.value.toLocaleString('en-IN') : '—'}
                          <span className="text-xs font-normal text-slate-400 ml-1">{stat.unit}</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-1">{stat.state || 'India'} · {stat.year}</div>
                        <button
                          onClick={() => insertBurdenStat(stat)}
                          className="mt-2 w-full text-center text-xs py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded transition"
                        >
                          + Insert into editor
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Literature Review Modal ── */}
      {litReviewOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Literature Review Generator</h2>
                <p className="text-sm text-slate-500 mt-0.5">Synthesises your saved references using Claude AI</p>
              </div>
              <button onClick={() => setLitReviewOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <div className="p-6 border-b border-slate-200">
              <label className="block text-sm font-medium text-slate-700 mb-2">Review Style</label>
              <div className="grid grid-cols-4 gap-2">
                {(['narrative', 'thematic', 'chronological', 'systematic'] as const).map(style => (
                  <button
                    key={style}
                    onClick={() => setLitReviewStyle(style)}
                    className={`py-2 px-3 rounded-lg text-sm capitalize transition ${
                      litReviewStyle === style
                        ? 'bg-violet-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
              <div className="mt-4 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                {litReviewStyle === 'narrative' && 'Flowing prose weaving together findings into a story of the research field.'}
                {litReviewStyle === 'thematic' && 'Groups studies into 3-5 major themes with a synthesis at the end.'}
                {litReviewStyle === 'chronological' && 'Traces how the field evolved over time, highlighting pivotal studies.'}
                {litReviewStyle === 'systematic' && 'PRISMA-aligned — describes study characteristics, findings, and limitations.'}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {litReviewError && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm mb-4">
                  {litReviewError}
                </div>
              )}
              {litReviewText ? (
                <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">{litReviewText}</pre>
              ) : (
                !generatingLitReview && (
                  <div className="text-center py-12 text-slate-400">
                    <div className="text-4xl mb-3">📚</div>
                    <p className="text-sm">Click Generate to synthesise your references into a literature review.</p>
                    <p className="text-xs mt-1">Requires at least 1 reference saved to this paper.</p>
                  </div>
                )
              )}
              {generatingLitReview && (
                <div className="text-center py-12 text-slate-500 text-sm">
                  <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  Generating {litReviewStyle} literature review…
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={() => setLitReviewOpen(false)} className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm">
                Close
              </button>
              {litReviewText && (
                <button
                  onClick={insertLitReviewIntoEditor}
                  className="px-5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium rounded-lg transition"
                >
                  Insert into Introduction
                </button>
              )}
              <button
                onClick={handleGenerateLitReview}
                disabled={generatingLitReview}
                className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium rounded-lg transition disabled:opacity-50"
              >
                {generatingLitReview ? 'Generating…' : litReviewText ? 'Regenerate' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Chat Modal ── */}
      {pdfChatOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-bold text-slate-900">PDF Chat</h2>
                <p className="text-sm text-slate-500 mt-0.5">Upload a PDF and ask questions about it</p>
              </div>
              <button onClick={() => setPdfChatOpen(false)} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">×</button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* PDF list sidebar */}
              <div className="w-56 shrink-0 border-r border-slate-200 flex flex-col">
                <div className="p-3 border-b border-slate-100">
                  <input
                    ref={pdfInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handlePdfUpload}
                    className="hidden"
                  />
                  <button
                    onClick={() => pdfInputRef.current?.click()}
                    disabled={uploadingPdf}
                    className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition disabled:opacity-50"
                  >
                    {uploadingPdf ? 'Uploading…' : '+ Upload PDF'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {pdfsLoading && (
                    <p className="text-xs text-slate-400 text-center py-4">Loading…</p>
                  )}
                  {!pdfsLoading && pdfs.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-6">No PDFs yet.<br />Upload one to start chatting.</p>
                  )}
                  {pdfs.map((doc) => (
                    <div
                      key={doc.id}
                      className={`rounded-lg p-2 cursor-pointer group flex items-start gap-2 ${
                        activePdfId === doc.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => {
                        setActivePdfId(doc.id);
                        setChatMessages([]);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-800 truncate">{doc.filename}</p>
                        <p className="text-xs text-slate-400">{doc.page_count != null ? `${doc.page_count} pages` : ''}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handlePdfDelete(doc.id); }}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs shrink-0 mt-0.5 transition"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {!activePdfId ? (
                  <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                    <div className="text-center">
                      <div className="text-4xl mb-3">📄</div>
                      <p>Select or upload a PDF to start chatting</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                      {chatMessages.length === 0 && (
                        <div className="text-center text-slate-400 text-sm py-8">
                          Ask any question about the selected PDF.
                        </div>
                      )}
                      {chatMessages.map((msg, i) => (
                        <div
                          key={i}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              msg.role === 'user'
                                ? 'bg-blue-600 text-white rounded-br-sm'
                                : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
                            <div className="flex gap-1">
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={chatBottomRef} />
                    </div>

                    <form onSubmit={handleChat} className="p-4 border-t border-slate-200 flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask a question about this PDF…"
                        disabled={chatLoading}
                        className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm disabled:opacity-50"
                      />
                      <button
                        type="submit"
                        disabled={!chatInput.trim() || chatLoading}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-xl transition disabled:opacity-50"
                      >
                        Send
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
