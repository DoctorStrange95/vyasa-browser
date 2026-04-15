/**
 * Centralized API client for HealthScholar.
 *
 * Features
 * --------
 * - Attaches Bearer token from localStorage automatically.
 * - On 401, attempts a silent token refresh using the stored refresh_token.
 *   If refresh succeeds the original request is retried once with the new
 *   access token.  If refresh fails (token expired / revoked) the user is
 *   redirected to /login.
 * - All methods throw an ApiError with `status` and `body` on HTTP errors
 *   (after retry logic is exhausted).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
  }
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

function getAccessToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
}

function getRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
}

function saveTokens(access: string, refresh: string): void {
  localStorage.setItem('access_token', access);
  localStorage.setItem('refresh_token', refresh);
}

function clearTokens(): void {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
}

// ---------------------------------------------------------------------------
// Refresh logic (called at most once per failed request)
// ---------------------------------------------------------------------------

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  try {
    const resp = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!resp.ok) return false;
    const data = await resp.json();
    saveTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core fetch wrapper
// ---------------------------------------------------------------------------

type RequestOptions = Omit<RequestInit, 'body'> & {
  json?: unknown;
  body?: BodyInit | null;
  /** Skip auth header (login / register endpoints) */
  anonymous?: boolean;
};

async function request<T = unknown>(
  path: string,
  options: RequestOptions = {},
  _retry = true,
): Promise<T> {
  const { json, anonymous, ...fetchOpts } = options;

  const headers = new Headers(fetchOpts.headers);
  if (json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (!anonymous) {
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const resp = await fetch(`${API_BASE}${path}`, {
    ...fetchOpts,
    headers,
    body: json !== undefined ? JSON.stringify(json) : fetchOpts.body,
  });

  // Silent token refresh on 401
  if (resp.status === 401 && _retry && !anonymous) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      return request<T>(path, options, false);   // retry once
    }
    clearTokens();
    if (typeof window !== 'undefined') window.location.replace('/login');
    throw new ApiError(401, null, 'Session expired');
  }

  if (!resp.ok) {
    let body: unknown;
    try { body = await resp.json(); } catch { body = await resp.text(); }
    throw new ApiError(resp.status, body);
  }

  // 204 No Content
  if (resp.status === 204) return undefined as T;

  return resp.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Convenience methods
// ---------------------------------------------------------------------------

export const api = {
  get: <T = unknown>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'GET' }),

  post: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', json: body }),

  put: <T = unknown>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'PUT', json: body }),

  delete: <T = unknown>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'DELETE' }),

  /** Multipart form upload — caller builds the FormData */
  upload: <T = unknown>(path: string, formData: FormData, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: 'POST', body: formData }),
};

// ---------------------------------------------------------------------------
// Typed endpoint helpers  (add more as needed)
// ---------------------------------------------------------------------------

export interface PaginatedArticles {
  items: Article[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface Article {
  id: number;
  title: string;
  abstract: string | null;
  authors: string[] | null;
  journal: string | null;
  year: number | null;
  doi: string | null;
  pmid: string | null;
  url: string | null;
  source: string;
  disease_category: string | null;
  study_type: string | null;
  geography: string | null;
  keywords: string[] | null;
  scraped_at: string;
}

export interface Paper {
  id: number;
  title: string;
  abstract: string | null;
  status: 'draft' | 'review' | 'published';
  doi: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaperDetail extends Paper {
  content: Record<string, unknown> | null;
}

export interface Dataset {
  id: number;
  filename: string;
  row_count: number | null;
  columns: Array<{ name: string; type: string; dtype: string }> | null;
  uploaded_at: string;
}

export interface LibraryEntry {
  article: Article;
  notes: string | null;
  tags: string[] | null;
  added_at: string;
}

export const authApi = {
  me: () => api.get<{ id: number; email: string; name: string; role: string }>('/auth/me'),
};

export const searchApi = {
  search: (params: Record<string, string | number | boolean>) => {
    const qs = new URLSearchParams(
      Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => [k, String(v)]),
    ).toString();
    return api.get<PaginatedArticles>(`/api/search?${qs}`);
  },
  save: (articleId: number, notes?: string, tags?: string[]) =>
    api.post<{ saved: boolean; article_id: number }>('/api/search/save', {
      article_id: articleId, notes, tags,
    }),
  library: () => api.get<LibraryEntry[]>('/api/library'),
  removeFromLibrary: (articleId: number) => api.delete(`/api/library/${articleId}`),
};

export const papersApi = {
  list: () => api.get<Paper[]>('/api/papers'),
  get: (id: number) => api.get<PaperDetail>(`/api/papers/${id}`),
  create: (title: string, abstract?: string) =>
    api.post<Paper>('/api/papers', { title, abstract }),
  update: (id: number, body: Partial<Pick<PaperDetail, 'title' | 'abstract' | 'content' | 'status'>>) =>
    api.put<Paper>(`/api/papers/${id}`, body),
  delete: (id: number) => api.delete(`/api/papers/${id}`),
  publish: (id: number) => api.post<{ doi: string; paper_id: number }>(`/api/papers/${id}/publish`),
  export: (id: number, format: 'docx' | 'ris' | 'json') =>
    `${API_BASE}/api/papers/${id}/export?format=${format}`,
};

export const analysisApi = {
  datasets: () => api.get<Dataset[]>('/api/analysis/datasets'),
  upload: (file: File, paperId?: number) => {
    const form = new FormData();
    form.append('file', file);
    if (paperId) form.append('paper_id', String(paperId));
    return api.upload<Dataset>('/api/analysis/upload', form);
  },
  run: (datasetId: number, analysisType: string, params: Record<string, unknown>) =>
    api.post('/api/analysis/run', { dataset_id: datasetId, analysis_type: analysisType, params }),
};

export const collectionsApi = {
  list: () => api.get('/api/collections'),
  create: (name: string, description?: string) =>
    api.post('/api/collections', { name, description }),
  get: (id: number) => api.get(`/api/collections/${id}`),
  addArticle: (collectionId: number, articleId: number) =>
    api.post(`/api/collections/${collectionId}/articles`, { article_id: articleId }),
};

export interface ResolvedCitation {
  title: string | null;
  authors: string[];
  journal: string | null;
  year: number | null;
  volume: string | null;
  issue: string | null;
  pages: string | null;
  doi: string | null;
  pmid: string | null;
  citation_text: string | null;
  source: string;
}

export const citationsApi = {
  resolve: (input: string) =>
    api.post<ResolvedCitation>('/api/citations/resolve', { input }),
};

export interface PdfDoc {
  id: number;
  filename: string;
  page_count: number | null;
  uploaded_at: string;
  paper_id: number | null;
}

export const pdfsApi = {
  list: () => api.get<PdfDoc[]>('/api/pdfs'),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<PdfDoc>('/api/pdfs', form);
  },
  delete: (id: number) => api.delete(`/api/pdfs/${id}`),
  chat: (id: number, question: string, history: { role: string; content: string }[]) =>
    api.post<{ answer: string; pdf_id: number }>(`/api/pdfs/${id}/chat`, { question, history }),
};
