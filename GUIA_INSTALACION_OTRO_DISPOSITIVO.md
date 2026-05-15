# Guia para levantar Finanzas Mayeson en otro dispositivo

Esta guia deja el proyecto listo en una PC nueva sin copiar secretos al repo.

## 1. Instalar programas base

En el nuevo dispositivo instala:

- Git: https://git-scm.com/downloads
- Node.js LTS 20 o superior: https://nodejs.org/
- Visual Studio Code, opcional pero recomendado.

Verifica en PowerShell:

```powershell
git --version
node --version
npm --version
```

## 2. Descargar las fuentes

Opcion recomendada, desde GitHub:

```powershell
cd C:\Users\TU_USUARIO\Desktop
git clone https://github.com/mayersonm/finanzas_mayer.git
cd finanzas_mayer
```

Opcion empaquetada desde esta PC:

```powershell
cd C:\Users\mayer\Documents\Codex\2026-05-09\files-mentioned-by-the-user-09\finanzas-mayeson
git archive --format=zip --output ..\finanzas_mayeson_fuentes.zip HEAD
```

Luego copia `finanzas_mayeson_fuentes.zip` al otro equipo y descomprime.

## 3. Levantar el dashboard React + TypeScript

En la nueva PC:

```powershell
cd C:\RUTA\finanzas_mayer\dashboard
npm ci
Copy-Item .env.example .env.local
notepad .env.local
```

Configura `.env.local` asi:

```env
VITE_GAS_API_URL=https://finanzas-d1-api.mayersonm.workers.dev/api/dashboard
```

Ejecuta local:

```powershell
npm run dev
```

Abre la URL que muestre Vite, normalmente:

```text
http://localhost:5173
```

Compilar para produccion:

```powershell
npm run build
```

## 4. Desplegar dashboard en Cloudflare Pages

Primero inicia sesion:

```powershell
npx wrangler login
```

Despliegue manual:

```powershell
cd C:\RUTA\finanzas_mayer\dashboard
npm run build
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
```

Si usas Cloudflare Pages conectado a GitHub:

- Framework: Vite.
- Root directory: `dashboard`.
- Build command: `npm run build`.
- Build output: `dist`.
- Variable de entorno: `VITE_GAS_API_URL`.

## 5. Levantar Worker + D1 + R2

Entra a la API:

```powershell
cd C:\RUTA\finanzas_mayer\d1-api
npm ci
npx wrangler login
```

Revisa `wrangler.toml`:

- `database_name = "finanzas_mayeson"`
- `database_id` debe ser el ID real de D1.
- `bucket_name = "finanzas-mayeson-receipts"`

Aplica migraciones en D1 remoto:

```powershell
npx wrangler d1 migrations apply finanzas_mayeson --remote
```

Configura secretos del Worker:

```powershell
npx wrangler secret put ADMIN_KEY
npx wrangler secret put DEFAULT_CHAT_ID
npx wrangler secret put GAS_API_URL
npx wrangler secret put GAS_API_KEY
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Despliega:

```powershell
npm run deploy
```

Prueba salud:

```powershell
Invoke-WebRequest -UseBasicParsing https://finanzas-d1-api.mayersonm.workers.dev/health
```

## 6. Configurar Apps Script en otra PC

Instala clasp:

```powershell
npm install -g @google/clasp
clasp login
```

En Google Apps Script abre tu proyecto y copia el `Script ID` desde Configuracion del proyecto.

En la carpeta `apps-script`, crea `.clasp.json`:

```powershell
cd C:\RUTA\finanzas_mayer\apps-script
notepad .clasp.json
```

Contenido:

```json
{
  "scriptId": "TU_SCRIPT_ID",
  "rootDir": "."
}
```

Sube fuentes:

```powershell
npx clasp push -f
```

Publica una version nueva sobre el Web App actual:

```powershell
npx clasp deployments
npx clasp deploy -i TU_DEPLOYMENT_ID -d "deploy desde nuevo dispositivo"
```

## 7. Script Properties necesarias

En Apps Script > Project Settings > Script Properties configura:

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

Para credito, puedes configurarlo desde Telegram:

```text
credito configurar corte 25 pago 10
```

Para imagenes, el valor recomendado es:

```text
receipt_image_max_bytes = 921600
```

## 8. Pruebas finales

En Telegram:

```text
ayuda
credito
gasto 10 supermercado prueba credito
ultimos
pago ultimo debito
```

En dashboard:

- Inicia sesion.
- Pulsa Actualizar.
- Revisa que el movimiento muestre forma de pago.
- Si es credito, revisa que aparezca fecha de pago.

En Worker:

```powershell
Invoke-WebRequest -UseBasicParsing https://finanzas-d1-api.mayersonm.workers.dev/health
```

## 9. Comandos rapidos

Dashboard:

```powershell
cd dashboard
npm ci
npm run dev
npm run build
```

Worker:

```powershell
cd d1-api
npm ci
npx wrangler d1 migrations apply finanzas_mayeson --remote
npm run deploy
```

Apps Script:

```powershell
cd apps-script
npx clasp push -f
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
```
