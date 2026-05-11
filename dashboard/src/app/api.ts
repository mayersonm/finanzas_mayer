import { API_URL } from './config';

type ApiPath = 'dashboard' | 'login' | 'session' | 'logout' | 'password' | 'sync';

export function apiEndpoint(path: ApiPath): string {
  const dashboardUrl = new URL(API_URL);

  if (dashboardUrl.pathname.endsWith('/api/dashboard')) {
    dashboardUrl.pathname = dashboardUrl.pathname.replace(/\/api\/dashboard\/?$/, `/api/${path}`);
    dashboardUrl.search = '';
    return dashboardUrl.toString();
  }

  if (path === 'dashboard') return dashboardUrl.toString();

  dashboardUrl.pathname = `/api/${path}`;
  dashboardUrl.search = '';
  return dashboardUrl.toString();
}
