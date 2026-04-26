/**
 * PostgREST Client for Self-Hosted Sonaro Gate
 * Replaces Supabase client with direct PostgREST calls.
 * When VITE_API_URL is not set, falls back to mock data.
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

// ─── Types ──────────────────────────────────────
export type AppRole = 'super_admin' | 'admin' | 'operator' | 'auditor';

export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url?: string;
}

export interface AuthSession {
  token: string;
  user: AuthUser;
  roles: AppRole[];
}

// ─── Token management ───────────────────────────
const TOKEN_KEY = 'sonaro_token';
const SESSION_KEY = 'sonaro_session';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function storeSession(session: AuthSession) {
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

// ─── HTTP helper ────────────────────────────────
async function request<T = any>(
  path: string,
  options: RequestInit = {},
  params?: Record<string, string>
): Promise<{ data: T | null; error: Error | null }> {
  if (!API_URL) {
    return { data: null, error: new Error('API_URL not configured') };
  }

  // Build URL: support both absolute (http://...) and relative (/api) base URLs
  let urlStr: string;
  if (API_URL.startsWith('http')) {
    const url = new URL(path, API_URL);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }
    urlStr = url.toString();
  } else {
    // Relative base like "/api" — construct manually
    const base = API_URL.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const qs = params
      ? '?' + Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
      : '';
    urlStr = `${base}${cleanPath}${qs}`;
  }

  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // For PostgREST: prefer return=representation for mutations
  if (['POST', 'PATCH', 'PUT'].includes(options.method || '')) {
    headers['Prefer'] = 'return=representation';
  }

  try {
    const res = await fetch(urlStr, { ...options, headers });
    if (!res.ok) {
      // Auto-logout on 401 — token expired or invalid
      if (res.status === 401) {
        clearSession();
        window.location.href = '/auth';
        return { data: null, error: new Error('Session expired. Please log in again.') };
      }
      const body = await res.text();
      let message = `Request failed (${res.status})`;
      try {
        const json = JSON.parse(body);
        if (json.message) message = json.message;
        else if (json.error) message = json.error;
      } catch { if (body) message = body; }
      return { data: null, error: new Error(message) };
    }
    if (res.status === 204) return { data: null, error: null };
    const data = await res.json();
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err as Error };
  }
}

// ─── PostgREST Query Builder ────────────────────
class QueryBuilder<T = any> {
  private _table: string;
  private _params: Record<string, string> = {};
  private _method: string = 'GET';
  private _body: any = null;
  private _single = false;
  private _maybeSingle = false;

  constructor(table: string) {
    this._table = table;
    this._params['select'] = '*';
  }

  select(columns = '*') {
    this._params['select'] = columns;
    return this;
  }

  eq(col: string, val: any) {
    this._params[col] = `eq.${val}`;
    return this;
  }

  neq(col: string, val: any) {
    this._params[col] = `neq.${val}`;
    return this;
  }

  gt(col: string, val: any) {
    this._params[col] = `gt.${val}`;
    return this;
  }

  gte(col: string, val: any) {
    this._params[col] = `gte.${val}`;
    return this;
  }

  lt(col: string, val: any) {
    this._params[col] = `lt.${val}`;
    return this;
  }

  lte(col: string, val: any) {
    this._params[col] = `lte.${val}`;
    return this;
  }

  in(col: string, vals: any[]) {
    this._params[col] = `in.(${vals.join(',')})`;
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    const dir = opts?.ascending === false ? 'desc' : 'asc';
    this._params['order'] = `${col}.${dir}`;
    return this;
  }

  limit(count: number) {
    this._params['limit'] = String(count);
    return this;
  }

  single() {
    this._single = true;
    this._params['limit'] = '1';
    return this;
  }

  maybeSingle() {
    this._maybeSingle = true;
    this._params['limit'] = '1';
    return this;
  }

  insert(data: any) {
    this._method = 'POST';
    this._body = data;
    return this;
  }

  update(data: any) {
    this._method = 'PATCH';
    this._body = data;
    return this;
  }

  delete() {
    this._method = 'DELETE';
    return this;
  }

  upsert(data: any, opts?: { onConflict?: string }) {
    this._method = 'POST';
    this._body = data;
    // PostgREST handles upsert via Prefer header
    return this;
  }

  async then(resolve: (val: { data: T | T[] | null; error: Error | null }) => void) {
    const result = await request<T[]>(
      `/${this._table}`,
      {
        method: this._method,
        body: this._body ? JSON.stringify(this._body) : undefined,
      },
      this._params
    );

    if (result.error) {
      resolve({ data: null, error: result.error });
      return;
    }

    const arr = result.data;
    if (this._single || this._maybeSingle) {
      if (Array.isArray(arr) && arr.length > 0) {
        resolve({ data: arr[0] as any, error: null });
      } else if (this._maybeSingle) {
        resolve({ data: null, error: null });
      } else {
        resolve({ data: null, error: new Error('Row not found') });
      }
    } else {
      resolve({ data: arr, error: null });
    }
  }
}

// ─── Auth API ───────────────────────────────────
export const authApi = {
  async signIn(email: string, password: string): Promise<{
    error: Error | null;
    session: AuthSession | null;
    mfaRequired?: boolean;
    mfaToken?: string;
  }> {
    if (!API_URL) {
      // Demo/mock mode: accept default credentials
      if (email === 'admin@sonaro.local' && password === 'Admin123!') {
        const session: AuthSession = {
          token: 'mock-jwt-token',
          user: { id: '00000000-0000-0000-0000-000000000001', email, full_name: 'Super Admin' },
          roles: ['super_admin'],
        };
        storeSession(session);
        return { error: null, session };
      }
      return { error: new Error('Invalid login credentials'), session: null };
    }

    const { data, error } = await request<any>('/rpc/authenticate', {
      method: 'POST',
      body: JSON.stringify({ p_email: email, p_password: password }),
    });
    if (error) return { error, session: null };
    if (!data) return { error: new Error('Invalid login credentials'), session: null };

    // MFA challenge
    if (data.mfa_required) {
      return { error: null, session: null, mfaRequired: true, mfaToken: data.mfa_token };
    }

    if (!data.token) return { error: new Error('Invalid login credentials'), session: null };
    const session: AuthSession = {
      token: data.token,
      user: { id: data.user_id, email: data.email, full_name: data.full_name },
      roles: data.roles ?? [],
    };
    storeSession(session);
    return { error: null, session };
  },

  async verifyMfa(mfaToken: string, code: string): Promise<{ error: Error | null; session: AuthSession | null }> {
    const { data, error } = await request<any>('/auth/mfa/verify', {
      method: 'POST',
      body: JSON.stringify({ mfa_token: mfaToken, code }),
    });
    if (error) return { error, session: null };
    if (!data?.token) return { error: new Error('Invalid code'), session: null };
    const session: AuthSession = {
      token: data.token,
      user: { id: data.user_id, email: data.email, full_name: data.full_name },
      roles: data.roles ?? [],
    };
    storeSession(session);
    return { error: null, session };
  },

  signOut() {
    clearSession();
  },

  getSession(): AuthSession | null {
    return getStoredSession();
  },
};

// ─── MFA Management API ─────────────────────────
export const mfaApi = {
  async getStatus(): Promise<{ mfa_enabled: boolean }> {
    const { data } = await request<any>('/auth/mfa/status');
    return { mfa_enabled: data?.mfa_enabled ?? false };
  },

  async setup(): Promise<{ data: { secret: string; qr: string; otpauth_url: string } | null; error: Error | null }> {
    return request<{ secret: string; qr: string; otpauth_url: string }>('/auth/mfa/setup', { method: 'POST' });
  },

  async confirm(code: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await request<any>('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async disable(password: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await request<any>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  async changePassword(current_password: string, new_password: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await request<any>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ current_password, new_password }),
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};

// ─── Database Client ────────────────────────────
export const db = {
  from<T = any>(table: string) {
    return new QueryBuilder<T>(table);
  },
};

// ─── Check if API is available ──────────────────
export function isApiConfigured(): boolean {
  return !!API_URL;
}

// ─── Shared authenticated fetch helper ──────────
// Thin wrapper used across pages and components that need to call backend APIs.
// Sends the stored JWT token in the Authorization header and throws on HTTP errors.
export async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getStoredToken() ?? ''}`,
      ...(options?.headers ?? {}),
    },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
      window.location.href = '/auth';
      throw new Error('Session expired. Please log in again.');
    }
    throw new Error((json as any).message ?? `HTTP ${res.status}`);
  }
  return json;
}

export { API_URL };
