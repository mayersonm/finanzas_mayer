import { httpError } from '../../shared/http.js';

export async function gasConfigRequest(env, action, extraParams = new URLSearchParams()) {
  if (!env.GAS_API_URL || !env.GAS_API_KEY) {
    throw httpError(400, 'Faltan secrets GAS_API_URL o GAS_API_KEY');
  }

  const url = new URL(env.GAS_API_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('key', env.GAS_API_KEY);
  for (const [key, value] of extraParams.entries()) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));

  if (!response.ok || data.ok === false) {
    throw httpError(502, data.error || 'No se pudo leer configuracion desde Apps Script');
  }

  return data;
}
