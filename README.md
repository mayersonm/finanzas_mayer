# Finanzas Mayeson

Monorepo del sistema de finanzas personales:

- `apps-script/`: bot de Telegram en Google Apps Script + Google Sheets.
- `d1-api/`: API en Cloudflare Worker + D1.
- `dashboard/`: dashboard web React + TypeScript + Vite.

## Variables y secretos

No se suben secretos al repo. Configura los valores reales en cada plataforma.

### Apps Script Properties

```text
telegram_bot_token
webapp_url
sheet_id
worker_url
dashboard_api_key
dashboard_chat_id
claude_api_key
d1_api_url
d1_admin_key
finance_email_to
daily_email_to
monthly_email_to
yearly_email_to
credit_cutoff_day
credit_due_day
credit_card_name
receipt_image_max_bytes
```

### Dashboard

Copia `dashboard/.env.example` a `dashboard/.env.local`:

```text
VITE_GAS_API_URL=https://tu-worker.workers.dev/api/dashboard
VITE_DASHBOARD_API_KEY=tu_dashboard_key
```

### Worker D1

Configura los secrets con Wrangler:

```powershell
npx wrangler secret put DASHBOARD_API_KEY
npx wrangler secret put ADMIN_KEY
npx wrangler secret put DEFAULT_CHAT_ID
npx wrangler secret put GAS_API_URL
npx wrangler secret put GAS_API_KEY
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

## Comandos utiles

Dashboard:

```powershell
cd dashboard
npm install
npm run build
```

Worker:

```powershell
cd d1-api
npm install
npm run deploy
```

Apps Script:

```powershell
cd apps-script
clasp push
```

## Pagos con debito/credito

Configura la tarjeta desde Telegram:

```text
credito configurar corte 25 pago 10
```

Registra o corrige movimientos:

```text
gasto 120 supermercado metro credito
pago ultimo credito
pago 1 debito
```

## Deudas, alertas e insights

```text
deuda laptop 2500 vence 2026-06-30
pagar deuda laptop 300
deudas
alertas
insights
```
