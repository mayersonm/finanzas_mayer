export const API_URL = import.meta.env.VITE_GAS_API_URL || 'https://script.google.com/macros/s/TU_SCRIPT_ID/exec';
export const SESSION_STORAGE_KEY = 'finanzas_dashboard_session';

export function isApiConfigured(): boolean {
  return !API_URL.includes('TU_SCRIPT_ID');
}
