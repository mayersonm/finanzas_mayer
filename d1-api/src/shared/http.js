export function json(data, status = 200) {
  return corsResponse(JSON.stringify(data), status, {
    'content-type': 'application/json; charset=utf-8',
  });
}

export function corsResponse(body, status = 200, headers = {}) {
  return new Response(body, {
    status,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization,x-admin-key',
      ...headers,
    },
  });
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

export async function safeJson(request) {
  try {
    return await request.json();
  } catch (_error) {
    return {};
  }
}

export function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(String(value || ''));
  } catch (_error) {
    return fallback;
  }
}
