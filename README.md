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
claude_api_url
claude_model
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

Para Anthropic directo:

```text
claude_api_url=https://api.anthropic.com/v1/messages
```

Si usas un proveedor proxy, confirma que tu grupo/cuenta permita despachar a `/v1/messages`.

### Dashboard

Copia `dashboard/.env.example` a `dashboard/.env.local`:

```text
VITE_GAS_API_URL=https://tu-worker.workers.dev/api/dashboard
```

El dashboard usa login normal con usuario y clave. El usuario inicial queda en D1 como `dashboard_login_email=mayersonm@gmail.com`. No hay registro ni login con Google.

La pestana `Config` guarda las preferencias en D1 y concentra:

- configuracion de credito, moneda, recibos y correos;
- estado operativo de Worker, D1, R2 y Apps Script;
- administrador de categorias, reglas IA y reglas de presupuesto.

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

## Gastos fijos

```text
fijo alquiler 1500 servicios
fijo netflix 15 USD entretenimiento
fijos
pagar fijo alquiler
saltar fijo alquiler
eliminar fijo alquiler
```

Los gastos fijos aceptan `PEN` y `USD`. Desde Telegram se guardan en Sheets y tambien se envian directo a D1 para que aparezcan en el dashboard. En `Compromisos` tambien puedes crear, editar y eliminar gastos fijos desde la interfaz.

## Deudas, alertas e insights

```text
deuda laptop 2500 vence 2026-06-30
deuda viaje 800 USD vence 2026-08-15
pagar deuda laptop 300
pagar deuda viaje 100 USD
deudas
alertas
insights
```

Las deudas aceptan `PEN` y `USD`. En el dashboard, las deudas en USD muestran su monto original y una referencia convertida a soles con la tasa USD/PEN cacheada por el Worker.

Desde el dashboard, en `Compromisos`, tambien puedes crear, editar, pagar y eliminar deudas. Cada pago queda guardado en el historial de la deuda para revisar fecha, monto, moneda y nota.
Cuando pagas una deuda, tambien se registra un movimiento de gasto para que el balance de caja baje correctamente.

## Inversiones y patrimonio

El dashboard incluye `Inversiones` para registrar posiciones con tipo, monto invertido, valor actual, moneda `PEN` o `USD` y notas.

La pestaña `Patrimonio` calcula activos, pasivos y patrimonio neto usando balance, inversiones, metas y deudas. Tambien permite guardar cortes historicos en D1 para comparar la evolucion.
