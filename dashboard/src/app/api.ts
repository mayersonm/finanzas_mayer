import { API_URL } from './config';

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
