import { API_URL, SESSION_STORAGE_KEY } from './config';

type ApiPath = 'dashboard' | 'calendar' | 'login' | 'session' | 'logout' | 'password' | 'sync';

export function apiEndpoint(path: ApiPath | string): string {
  const dashboardUrl = new URL(API_URL);
  const cleanPath = path.replace(/^\/+/, '');

  if (dashboardUrl.pathname.endsWith('/api/dashboard')) {
    dashboardUrl.pathname = dashboardUrl.pathname.replace(/\/api\/dashboard\/?$/, `/api/${cleanPath}`);
    dashboardUrl.search = '';
    return dashboardUrl.toString();
  }

  if (path === 'dashboard') return dashboardUrl.toString();

  dashboardUrl.pathname = `/api/${cleanPath}`;
  dashboardUrl.search = '';
  return dashboardUrl.toString();
}

// Obtener tasa de cambio USD/PEN actualizada.
export async function getUsdToPenRate(): Promise<number> {
  const cacheKey = `${SESSION_STORAGE_KEY}_exchange_rate`;
  const cached = sessionStorage.getItem(cacheKey);

  if (cached) {
    try {
      const { rate, timestamp } = JSON.parse(cached);
      if (rate > 0 && Date.now() - timestamp < 3600000) {
        return rate;
      }
    } catch {
      sessionStorage.removeItem(cacheKey);
    }
  }

  try {
    const token = window.localStorage.getItem(SESSION_STORAGE_KEY);
    const response = await fetch(apiEndpoint('exchange-rate'), {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) throw new Error('Exchange rate API error');

    const data = await response.json() as { ok?: boolean; rate?: number };
    const rate = Number(data.rate || 0) || 3.85;

    sessionStorage.setItem(cacheKey, JSON.stringify({ rate, timestamp: Date.now() }));
    return rate;
  } catch (error) {
    console.warn('Error fetching exchange rate, using fallback:', error);
    if (cached) {
      try {
        const { rate } = JSON.parse(cached);
        if (rate > 0) return rate;
      } catch {
        sessionStorage.removeItem(cacheKey);
      }
    }
    return 3.85;
  }
}
