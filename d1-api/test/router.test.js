import { describe, expect, it } from 'vitest';
import { auth, createRouter, route } from '../src/app/router.js';

function dispatch(routes, method, path, init = {}) {
  const url = new URL(`https://api.test${path}`);
  const request = new Request(url, { method, ...init });
  return createRouter(routes)(request, {}, url);
}

describe('createRouter', () => {
  it('matchea ruta estatica y serializa el resultado como JSON 200', async () => {
    const res = await dispatch([route('GET', '/api/ping', auth.public, () => ({ ok: true, pong: 1 }))], 'GET', '/api/ping');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, pong: 1 });
  });

  it('extrae y decodifica parametros de ruta', async () => {
    const routes = [route('GET', '/api/items/:id', auth.public, (ctx) => ({ id: ctx.params.id }))];
    expect(await (await dispatch(routes, 'GET', '/api/items/abc123')).json()).toEqual({ id: 'abc123' });
    expect(await (await dispatch(routes, 'GET', '/api/items/a%20b')).json()).toEqual({ id: 'a b' });
  });

  it('respeta el status configurado (201)', async () => {
    const res = await dispatch([route('POST', '/api/items', auth.public, () => ({ ok: true }), 201)], 'POST', '/api/items');
    expect(res.status).toBe(201);
  });

  it('devuelve null cuando ninguna ruta coincide', async () => {
    const res = await dispatch([route('GET', '/api/x', auth.public, () => ({}))], 'GET', '/api/y');
    expect(res).toBeNull();
  });

  it('no matchea si el metodo difiere en el mismo path', async () => {
    const res = await dispatch([route('GET', '/api/x', auth.public, () => ({}))], 'POST', '/api/x');
    expect(res).toBeNull();
  });

  it('pasa un Response del handler sin re-serializar', async () => {
    const res = await dispatch([route('GET', '/api/raw', auth.public, () => new Response('hola', { status: 202 }))], 'GET', '/api/raw');
    expect(res.status).toBe(202);
    expect(await res.text()).toBe('hola');
  });

  it('la prioridad sigue el orden de registro (estatica antes que dinamica)', async () => {
    const routes = [
      route('GET', '/api/items/special', auth.public, () => ({ special: true })),
      route('GET', '/api/items/:id', auth.public, (ctx) => ({ id: ctx.params.id })),
    ];
    expect(await (await dispatch(routes, 'GET', '/api/items/special')).json()).toEqual({ special: true });
    expect(await (await dispatch(routes, 'GET', '/api/items/999')).json()).toEqual({ id: '999' });
  });

  it('expone el body parseado vía ctx.body()', async () => {
    const routes = [route('POST', '/api/echo', auth.public, async (ctx) => ({ got: await ctx.body() }))];
    const res = await dispatch(routes, 'POST', '/api/echo', {
      body: JSON.stringify({ a: 1 }),
      headers: { 'content-type': 'application/json' },
    });
    expect(await res.json()).toEqual({ got: { a: 1 } });
  });

  it('aplica la estrategia de auth antes del handler', async () => {
    const denied = () => { throw Object.assign(new Error('Unauthorized'), { status: 401 }); };
    let handlerRan = false;
    const routes = [route('GET', '/api/guard', denied, () => { handlerRan = true; return {}; })];
    await expect(dispatch(routes, 'GET', '/api/guard')).rejects.toThrow('Unauthorized');
    expect(handlerRan).toBe(false);
  });
});
