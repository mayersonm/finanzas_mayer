# Finanzas D1 API

API gratis en Cloudflare Worker + D1 para el dashboard financiero.

## Flujo recomendado

```text
React Dashboard -> Worker API -> Cloudflare D1
Apps Script actual -> sigue funcionando como origen temporal
Worker /api/sync/gas -> migra datos desde Apps Script a D1
```

## 1. Login

```powershell
npx wrangler login
```

## 2. Crear la base D1

```powershell
cd C:\Users\mayer\Documents\Codex\2026-05-09\files-mentioned-by-the-user-09\finanzas-d1-api
npx wrangler d1 create finanzas_mayeson
```

Copia el `database_id` que te devuelve Cloudflare y reemplazalo en `wrangler.toml`.

## 3. Crear tablas

```powershell
npx wrangler d1 migrations apply finanzas_mayeson --remote
```

## 4. Guardar secrets

```powershell
npx wrangler secret put DASHBOARD_API_KEY
npx wrangler secret put ADMIN_KEY
npx wrangler secret put DEFAULT_CHAT_ID
npx wrangler secret put GAS_API_URL
npx wrangler secret put GAS_API_KEY
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Valores sugeridos:

```text
DASHBOARD_API_KEY = la misma key del dashboard actual
ADMIN_KEY         = otra clave larga privada para sincronizar
DEFAULT_CHAT_ID   = tu ChatID
GAS_API_URL       = URL nueva de Apps Script /exec
GAS_API_KEY       = dashboard_api_key de Apps Script
LOGIN_PASSWORD    = clave privada para entrar al dashboard
SESSION_SECRET    = cadena larga aleatoria para firmar sesiones
```

## 5. Deploy

```powershell
npx wrangler deploy
```

## 6. Sincronizar desde Google Sheets/App Script

```powershell
$ADMIN_KEY = "tu_admin_key"
Invoke-WebRequest `
  -Method POST `
  -Headers @{ "x-admin-key" = $ADMIN_KEY } `
  -Uri "https://finanzas-d1-api.TU_SUBDOMINIO.workers.dev/api/sync/gas"
```

## 7. Probar dashboard API

```text
https://finanzas-d1-api.TU_SUBDOMINIO.workers.dev/api/dashboard?key=TU_DASHBOARD_API_KEY
```

Cuando eso responda `ok: true`, el frontend se cambia de Apps Script a D1.
