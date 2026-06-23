import { apiEndpoint } from './api';
import { SESSION_STORAGE_KEY } from './config';

// Evento global que App.tsx escucha para cerrar la sesion cuando el Worker responde 401.
export const SESSION_EXPIRED_EVENT = 'finanzas:session-expired';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | undefined | null>;
  token?: string | null;
  signal?: AbortSignal;
}

function currentToken(): string | null {
  return window.localStorage.getItem(SESSION_STORAGE_KEY);
}

function buildUrl(path: string, query?: ApiOptions['query']): string {
  const url = new URL(apiEndpoint(path));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function authHeaders(token?: string | null): Record<string, string> {
  const active = token === undefined ? currentToken() : token;
  return active ? { Authorization: `Bearer ${active}` } : {};
}

// Lanza el evento de sesion expirada una sola vez por respuesta 401.
function handleUnauthorized(): never {
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  throw new ApiError('Sesion expirada. Ingresa nuevamente.', 401);
}

// Petición JSON centralizada: añade auth, maneja 401 y normaliza errores `{ ok: false }`.
export async function apiRequest<T = unknown>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders(options.token) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, options.query), {
    method: options.method || 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  if (response.status === 401) handleUnauthorized();

  const result = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string } & T;
  if (!response.ok || result?.ok === false) {
    throw new ApiError(result?.error || `Error ${response.status}`, response.status);
  }
  return result as T;
}

// Descarga binaria (recibos) con el mismo manejo de auth y 401.
export async function apiBlob(path: string, options: ApiOptions = {}): Promise<Blob> {
  const response = await fetch(buildUrl(path, options.query), {
    method: options.method || 'GET',
    headers: authHeaders(options.token),
    signal: options.signal,
  });

  if (response.status === 401) handleUnauthorized();
  if (!response.ok) throw new ApiError(`Error ${response.status}`, response.status);
  return response.blob();
}
