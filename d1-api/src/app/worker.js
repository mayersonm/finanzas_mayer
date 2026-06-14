
import { json, corsResponse } from '../shared/http.js';
import { routeHandlers } from './routes/index.js';
import { syncFromGas } from '../modules/sync/service.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return corsResponse(null, 204);
    }

    try {
      for (const route of routeHandlers) {
        const response = await route(request, env, url);
        if (response) return response;
      }

      return json({ ok: false, error: 'Not found' }, 404);
    } catch (error) {
      const status = error.status || 500;
      return json({ ok: false, error: error.message || String(error) }, status);
    }
  },

  async scheduled(_event, env, ctx) {
    if (String(env.ENABLE_AUTO_GAS_SYNC || '').toLowerCase() !== 'true') {
      return;
    }

    const params = new URLSearchParams({ limit: '500' });
    ctx.waitUntil(syncFromGas(env, params));
  },
};
