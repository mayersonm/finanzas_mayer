import { API_URL, SESSION_STORAGE_KEY } from './config';

type ApiPath = 'dashboard' | 'login' | 'session' | 'logout' | 'password' | 'sync';

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

// Obtener tasa de cambio USD/PEN actualizada
export async function getUsdToPenRate(): Promise<number> {
  const cacheKey = `${SESSION_STORAGE_KEY}_exchange_rate`;
  const cached = sessionStorage.getItem(cacheKey);
  
  // Si hay datos en cache y son recientes (menos de 1 hora), usarlos
  if (cached) {
    const { rate, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < 3600000) {
      return rate;
    }
  }

  try {
    // Usar API de exchangerate-api.com con clave de la variable de entorno
    const apiKey = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
    const url = apiKey 
      ? `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`
      : 'https://api.exchangerate-api.com/v4/latest/USD';
    
    const response = await fetch(url);
    if (!response.ok) throw new Error('Exchange rate API error');
    
    const data = await response.json();
    const rate = data.rates?.PEN || 3.85; // fallback a 3.85 si falla
    
    // Guardar en cache
    sessionStorage.setItem(cacheKey, JSON.stringify({ rate, timestamp: Date.now() }));
    return rate;
  } catch (error) {
    console.warn('Error fetching exchange rate, using fallback:', error);
    // Si falla, intentar obtener del cache aunque sea viejo
    if (cached) {
      const { rate } = JSON.parse(cached);
      return rate;
    }
    // Último recurso: valor por defecto
    return 3.85;
  }
}
