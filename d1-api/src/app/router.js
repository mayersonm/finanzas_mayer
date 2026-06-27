import { json, safeJson } from '../shared/http.js';
import {
  requireAdminKey,
  requireDashboardAccess,
  requireDashboardOrAdminAccess,
} from '../modules/auth/service.js';

// Estrategias de autorizacion reutilizables por las rutas declarativas.
export const auth = {
  public: async () => {},
  dash: (request, env) => requireDashboardAccess(request, env),
  dashAdmin: (request, env) => requireDashboardOrAdminAccess(request, env),
  admin: async (request, env) => requireAdminKey(request, env),
};

// Convierte "/api/work-items/:id/timeline" en un regex con nombres de parametros.
function compilePath(path) {
  const names = [];
  const pattern = path.replace(/:[A-Za-z0-9_]+/g, (token) => {
    names.push(token.slice(1));
    return '([^/]+)';
  });
  return { regex: new RegExp(`^${pattern}$`), names };
}

/**
 * Declara una ruta.
 * @param {string} method  Metodo HTTP (GET, POST, PATCH, DELETE).
 * @param {string} path    Ruta con parametros tipo ":id".
 * @param {Function} authStrategy  Una de las estrategias de `auth`.
 * @param {(ctx) => any} handler  Recibe el contexto y devuelve datos JSON o un Response.
 * @param {number} [status=200]  Status por defecto cuando el handler devuelve datos planos.
 */
export function route(method, path, authStrategy, handler, status = 200) {
  return { method, ...compilePath(path), auth: authStrategy, handler, status };
}

function matchRoute(routes, method, pathname) {
  for (const entry of routes) {
    if (entry.method !== method) continue;
    const match = entry.regex.exec(pathname);
    if (!match) continue;

    const params = {};
    entry.names.forEach((name, index) => {
      params[name] = decodeURIComponent(match[index + 1]);
    });
    return { entry, params };
  }
  return null;
}

// Crea el dispatcher: aplica auth, arma el contexto y serializa la respuesta.
// Devuelve `null` cuando ninguna ruta coincide para que el worker responda 404.
export function createRouter(routes) {
  return async function dispatch(request, env, url) {
    const matched = matchRoute(routes, request.method, url.pathname);
    if (!matched) return null;

    const { entry, params } = matched;
    await entry.auth(request, env);

    const ctx = {
      request,
      env,
      url,
      params,
      query: url.searchParams,
      body: () => request.json(),
      safeBody: () => safeJson(request),
    };

    const result = await entry.handler(ctx);
    if (result instanceof Response) return result;
    return json(result, entry.status);
  };
}
