# Guia para instalar Finanzas Mayeson en cualquier dispositivo

Esta guia sirve para levantar el proyecto desde cero en otra computadora, sin copiar secretos al repositorio y sin depender de rutas locales.

La idea general es:

1. Descargar el codigo desde GitHub.
2. Instalar dependencias.
3. Configurar secretos en cada plataforma.
4. Desplegar Apps Script, Worker y Dashboard.
5. Probar Telegram y el dashboard.

## 1. Instalar herramientas

Instala estas herramientas antes de empezar:

- Git
- Node.js LTS 20 o superior
- Visual Studio Code, opcional

Verifica que quedaron instaladas:

```powershell
git --version
node --version
npm --version
```

Si esos comandos muestran versiones, ya puedes continuar.

## 2. Descargar el proyecto

Elige una carpeta cualquiera para tus proyectos y ejecuta:

```powershell
git clone https://github.com/mayersonm/finanzas_mayer.git
cd finanzas_mayer
```

Este comando descarga el repositorio y entra a la carpeta principal del proyecto.

## 3. Instalar dependencias

El proyecto tiene dos partes con Node.js: el dashboard y el Worker.

Instala dependencias del dashboard:

```powershell
cd dashboard
npm ci
cd ..
```

Instala dependencias del Worker:

```powershell
cd d1-api
npm ci
cd ..
```

`npm ci` instala exactamente las versiones guardadas en `package-lock.json`.

## 4. Configurar el dashboard local

El dashboard necesita saber donde esta la API del Worker. Sin esta variable, el dashboard abre en modo demo y no muestra login.

Entra al dashboard:

```powershell
cd dashboard
```

Crea el archivo local de variables:

```powershell
Copy-Item .env.example .env.local
```

Abre el archivo:

```powershell
notepad .env.local
```

Coloca este valor:

```env
VITE_GAS_API_URL=https://finanzas-d1-api.mayersonm.workers.dev/api/dashboard
```

Levanta el dashboard en modo desarrollo:

```powershell
npm run dev
```

Abre la URL que muestre Vite. Normalmente es:

```text
http://localhost:5173
```

Si aparece la pantalla de login, la configuracion esta bien.

Vuelve a la raiz del proyecto:

```powershell
cd ..
```

## 5. Configurar Cloudflare

Inicia sesion en Cloudflare con Wrangler:

```powershell
cd d1-api
npx wrangler login
```

El navegador pedira autorizar Wrangler. Acepta con la cuenta de Cloudflare donde esta el proyecto.

Aplica migraciones en D1 remoto:

```powershell
npx wrangler d1 migrations apply finanzas_mayeson --remote
```

Esto crea o actualiza las tablas de D1, incluyendo transacciones, recibos, ajustes y deudas.

Configura secretos del Worker:

```powershell
npx wrangler secret put ADMIN_KEY
npx wrangler secret put DEFAULT_CHAT_ID
npx wrangler secret put GAS_API_URL
npx wrangler secret put GAS_API_KEY
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Cada comando pedira escribir el valor secreto. Esos valores no se guardan en Git.

Despliega el Worker:

```powershell
npm run deploy
```

Prueba que el Worker responde:

```powershell
Invoke-WebRequest -UseBasicParsing https://finanzas-d1-api.mayersonm.workers.dev/health
```

Si ves `"ok":true`, el Worker esta funcionando.

Vuelve a la raiz:

```powershell
cd ..
```

## 6. Desplegar el dashboard en Cloudflare Pages

Entra al dashboard:

```powershell
cd dashboard
```

Compila con la URL real del Worker. Este paso es importante para que aparezca el login:

```powershell
$env:VITE_GAS_API_URL="https://finanzas-d1-api.mayersonm.workers.dev/api/dashboard"
npm run build
```

Despliega a Pages:

```powershell
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
```

Wrangler mostrara una URL de Pages. Abrela y confirma que aparece la pantalla de login.

Si Pages esta conectado a GitHub, configura en Cloudflare Pages:

```text
Framework preset: Vite
Root directory: dashboard
Build command: npm run build
Build output directory: dist
Variable: VITE_GAS_API_URL=https://finanzas-d1-api.mayersonm.workers.dev/api/dashboard
```

Vuelve a la raiz:

```powershell
cd ..
```

## 7. Configurar Apps Script

Instala clasp:

```powershell
npm install -g @google/clasp
```

Inicia sesion en Google:

```powershell
clasp login
```

Entra a la carpeta de Apps Script:

```powershell
cd apps-script
```

Crea el archivo local de configuracion:

```powershell
notepad .clasp.json
```

Pega este contenido y reemplaza `TU_SCRIPT_ID` por el Script ID real del proyecto:

```json
{
  "scriptId": "TU_SCRIPT_ID",
  "rootDir": "."
}
```

El `Script ID` se encuentra en Google Apps Script, dentro de Project Settings.

Sube el codigo:

```powershell
npx clasp push -f
```

Lista los deployments disponibles:

```powershell
npx clasp deployments
```

Busca el deployment actual del Web App. Para mantener la misma URL, no crees uno nuevo; actualiza el deployment existente:

```powershell
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
```

`TU_DEPLOYMENT_ID` es el ID que aparece en `npx clasp deployments`.

Prueba el Web App:

```powershell
Invoke-WebRequest -UseBasicParsing "TU_WEB_APP_URL"
```

Debe responder:

```text
BOT ACTIVO
```

Vuelve a la raiz:

```powershell
cd ..
```

## 8. Configurar Script Properties

En Google Apps Script abre:

```text
Project Settings > Script Properties
```

Agrega estas propiedades:

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

Para la IA, si usas Anthropic directo:

```text
claude_api_url=https://api.anthropic.com/v1/messages
```

Si usas SynteroLink u otro proveedor compatible, confirma que permita `/v1/messages` o `/v1/chat/completions`.

Para imagenes de recibos, valor recomendado:

```text
receipt_image_max_bytes=921600
```

Para credito puedes configurarlo desde Telegram:

```text
credito configurar corte 25 pago 10
```

## 9. Probar Telegram

En Telegram prueba:

```text
ayuda
credito
gasto 10 supermercado prueba credito
ultimos
pago ultimo debito
deuda laptop 2500 vence 2026-06-30
deudas
alertas
insights
```

Para probar recibos, envia una foto clara de un ticket. El bot debe responder primero que esta analizando.

## 10. Probar dashboard

Abre la URL de Cloudflare Pages.

Debe aparecer el login. Si aparece modo demo, falta configurar `VITE_GAS_API_URL` en el build o en Cloudflare Pages.

Despues de entrar:

```text
Pulsa Actualizar
Revisa Movimientos
Revisa Compromisos
Revisa Deudas
Revisa Analisis
```

## 11. Comandos rapidos

Dashboard local:

```powershell
cd dashboard
npm ci
npm run dev
```

Build del dashboard con login:

```powershell
cd dashboard
$env:VITE_GAS_API_URL="https://finanzas-d1-api.mayersonm.workers.dev/api/dashboard"
npm run build
```

Deploy dashboard:

```powershell
cd dashboard
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
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
npx clasp deployments
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
```

Git:

```powershell
git status
git add .
git commit -m "mensaje del cambio"
git push origin main
```

## 12. Problemas comunes

Dashboard sin login:

```text
Falta VITE_GAS_API_URL en el build.
```

Solucion:

```powershell
cd dashboard
$env:VITE_GAS_API_URL="https://finanzas-d1-api.mayersonm.workers.dev/api/dashboard"
npm run build
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
```

Apps Script no sube:

```text
Falta .clasp.json o el Script ID es incorrecto.
```

Solucion:

```powershell
cd apps-script
npx clasp deployments
```

Si ese comando no encuentra el proyecto, revisa `.clasp.json`.

IA bloqueada por proveedor:

```text
This group does not allow /v1/messages dispatch
```

Solucion:

```text
Revisa claude_api_url, claude_api_key y claude_model.
Si usas proveedor proxy, confirma permisos para /v1/messages o /v1/chat/completions.
```

