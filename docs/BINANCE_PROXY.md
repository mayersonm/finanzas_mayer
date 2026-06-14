# Binance en Finanzas Mayeson

## Que se valido

- Binance responde correctamente desde la PC local con Python.
- Binance bloquea Cloudflare Worker con HTTP 403.
- Binance bloquea Google Apps Script con HTTP 451 por ubicacion restringida.

Por eso la firma HMAC, la API key y el endpoint estan bien. El problema es la red desde donde sale la llamada.

## Arquitectura recomendada sin tunel temporal

Usar un proxy propio con IP publica fija. La opcion elegida para este proyecto es Fly.io con static egress IP:

```txt
Dashboard -> Worker -> Fly.io proxy -> Binance
```

Ventajas:

- Binance ve una IP fija que puedes permitir en API Management.
- La secret no llega al navegador.
- El Worker conserva la misma API `/api/crypto`.
- No dependes de una URL temporal de tunnel/ngrok/localtunnel.

## Proxy incluido

El repo trae un proxy deployable en Fly:

- `binance-proxy/`
- Guia completa: `docs/FLY_BINANCE_PROXY.md`

Tambien hay dos proxies locales en `tools/` para pruebas:

- `tools/binance-proxy.mjs` para Node.js.
- `tools/binance_proxy.py` para Python.

El recomendado para produccion es `binance-proxy/` en Fly.io.

## Variables del proxy

```bash
BINANCE_PROXY_KEY=una_clave_larga
BINANCE_PROXY_HOST=0.0.0.0
BINANCE_PROXY_PORT=8789
```

En VPS se debe ejecutar con HTTPS delante, por ejemplo Nginx/Caddy o el proxy del proveedor.

En Fly.io se usa el HTTPS propio de Fly y una static egress IP:

```bash
fly ips allocate-egress --app finanzas-mayeson-binance-proxy -r gru
fly ips list --app finanzas-mayeson-binance-proxy
```

La IPv4 egress que aparezca en `fly ips list` es la que debe ir en Binance API Management.

## Worker

Configurar estos secrets:

```bash
npx wrangler@4.100.0 secret put BINANCE_PROXY_URL
npx wrangler@4.100.0 secret put BINANCE_PROXY_KEY
```

`BINANCE_PROXY_URL` debe ser la URL publica del VPS, por ejemplo:

```txt
https://finanzas-mayeson-binance-proxy.fly.dev
```

`BINANCE_PROXY_KEY` debe ser la misma clave configurada en el proxy.

Con Fly, el Worker puede consultar el proxy nuevo directamente y las claves de Binance pueden vivir solo en Fly como secrets:

```bash
fly secrets set BINANCE_API_KEY="..."
fly secrets set BINANCE_API_SECRET="..."
fly secrets set PROXY_KEY="..."
```

## Seguridad

- La secret de Binance vive solo en el Worker como `BINANCE_API_SECRET`.
- El proxy recibe una URL firmada temporal y la API key.
- No expongas el proxy sin `BINANCE_PROXY_KEY`.
- Si la API key fue compartida en chat/capturas, rotala en Binance.

## Opcion temporal

Cloudflare Tunnel funciona para pruebas si el proxy corre en la PC local:

```txt
Worker -> Cloudflare Tunnel -> PC local -> Binance
```

No es la opcion final porque depende de que la PC este encendida y la URL puede cambiar si usas tunnel temporal.
