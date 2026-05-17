# Guia de instalacion completa de Finanzas xxxx

Esta guia es para instalar Finanzas xxxx en cualquier dispositivo sin depender de rutas locales. Sigue los pasos en orden: Telegram, Google Sheets, Apps Script, Cloudflare Worker, D1, R2 y dashboard.

Hay dos escenarios:

- Mismo proyecto en otro dispositivo: usas el repo, el mismo Apps Script, el mismo Worker, el mismo D1, el mismo R2 y el mismo dashboard.
- Instalacion desde cero: creas Telegram Bot, Google Sheet, Apps Script, Worker, D1, R2 y Pages desde una cuenta nueva.
- Nuevo usuario desde el dashboard: entra con Google, abre `Setup`, pega su token de Telegram y el sistema crea su propio Google Sheet + Apps Script con el nombre del usuario.

Nunca subas tokens, claves API, contrasenas ni archivos `.env` a Git.

## Alta nueva desde el dashboard

Usa este camino cuando el Worker, D1, R2 y dashboard principal ya existen.

1. Entra al dashboard.
2. Pulsa `Continuar con Google`.
3. Acepta los permisos de Google para crear Sheets y Apps Script.
4. Abre el tab `Setup`.
5. Crea un bot nuevo en `@BotFather` y pega el token en `Telegram`.
6. Pulsa `Crear entorno`.
7. Pulsa `Activar bot`.
8. Abre el bot en Telegram y envia:

```text
/start
```

El sistema crea un entorno nuevo con este formato:

```text
Finanzas NombreDelUsuario
```

Ese usuario empieza desde cero: no ve tus movimientos, no usa tu Chat ID y no escribe con tu `ADMIN_KEY` global.

## 1. Crear el bot en Telegram

Abre Telegram y busca el bot oficial:

```text
@BotFather
```

Crea un bot nuevo:

```text
/newbot
```

BotFather pedira:

```text
Nombre visible del bot
Usuario del bot terminado en bot
```

Ejemplo:

```text
Finanzas xxxx
finanzas_xxxx_bot
```

BotFather entregara un token parecido a este formato:

```text
123456789:AAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Guarda ese valor como:

```text
telegram_bot_token
```

No lo publiques y no lo pegues en Git.

## 2. Obtener tu Chat ID de Telegram

Primero abre tu bot en Telegram y envia cualquier mensaje, por ejemplo:

```text
hola
```

Luego ejecuta este comando reemplazando `TU_TOKEN_TELEGRAM`:

```powershell
Invoke-WebRequest -UseBasicParsing "https://api.telegram.org/botTU_TOKEN_TELEGRAM/getUpdates" | Select-Object -ExpandProperty Content
```

Busca un bloque parecido a este:

```json
"chat":{"id":123456789
```

Ese numero es tu Chat ID. Guardalo como:

```text
dashboard_chat_id
DEFAULT_CHAT_ID
```

Si `getUpdates` no muestra nada, envia otro mensaje al bot y vuelve a ejecutar el comando. Si el bot ya tiene webhook activo, primero revisa el webhook con:

```powershell
Invoke-WebRequest -UseBasicParsing "https://api.telegram.org/botTU_TOKEN_TELEGRAM/getWebhookInfo" | Select-Object -ExpandProperty Content
```

## 3. Crear el Google Sheet

Entra a Google Sheets y crea una hoja nueva.

Ponle un nombre claro, por ejemplo:

```text
Finanzas xxxx
```

Copia el ID del Sheet desde la URL.

Ejemplo de URL:

```text
https://docs.google.com/spreadsheets/d/1ABCDEF1234567890/edit
```

El Sheet ID seria:

```text
1ABCDEF1234567890
```

Guardalo como:

```text
sheet_id
```

No necesitas crear las pestanas manualmente si el codigo ya las crea al registrar movimientos, pero si algo falla, la primera prueba desde Telegram debe ayudarte a inicializarlas.

## 4. Preparar la computadora

Instala estas herramientas:

- Git
- Node.js LTS 20 o superior
- Visual Studio Code, opcional

Verifica la instalacion:

```powershell
git --version
node --version
npm --version
```

Instala `clasp`, que sirve para subir codigo a Google Apps Script:

```powershell
npm install -g @google/clasp
```

Verifica `clasp`:

```powershell
clasp --version
```

Wrangler no necesita instalarse globalmente; se ejecuta con `npx wrangler` dentro del proyecto.

## 5. Descargar el proyecto desde GitHub

Elige cualquier carpeta de tu computadora y ejecuta:

```powershell
git clone https://github.com/mayersonm/finanzas_mayer.git
cd finanzas_mayer
```

La estructura principal es:

```text
apps-script  -> Bot de Telegram en Google Apps Script
d1-api       -> Cloudflare Worker + D1 + R2
dashboard    -> Dashboard React + TypeScript + Vite
```

Instala dependencias del Worker:

```powershell
cd d1-api
npm ci
cd ..
```

Instala dependencias del dashboard:

```powershell
cd dashboard
npm ci
cd ..
```

## 6. Crear o conectar Google Apps Script

Primero habilita la API de Apps Script en tu cuenta de Google:

```text
https://script.google.com/home/usersettings
```

Activa:

```text
Google Apps Script API
```

Inicia sesion con clasp:

```powershell
clasp login
```

### Opcion A: usar el Apps Script existente

Usa esta opcion si estas instalando el mismo proyecto en otro dispositivo.

Entra a la carpeta:

```powershell
cd apps-script
```

Crea o revisa el archivo `.clasp.json`:

```powershell
notepad .clasp.json
```

Debe tener este formato:

```json
{
  "scriptId": "TU_SCRIPT_ID",
  "rootDir": "."
}
```

Para este proyecto, el Script ID actual es:

```text
1u9FmF_DZ16_g6jvOSgjEeNccCTvugcKosXquSWmdnWQyxicQjPnvttU8
```

Sube el codigo:

```powershell
npx clasp push -f
```

Lista los deployments:

```powershell
npx clasp deployments
```

Actualiza el deployment existente para no romper la URL publicada:

```powershell
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
```

No crees un deployment nuevo si quieres mantener el mismo webhook de Telegram.

Vuelve a la raiz:

```powershell
cd ..
```

### Opcion B: crear un Apps Script nuevo

Usa esta opcion si estas montando todo desde cero.

```powershell
cd apps-script
clasp create --type webapp --title "Finanzas xxxx"
npx clasp push -f
```

Luego abre Apps Script desde el enlace que muestra `clasp` o desde:

```text
https://script.google.com
```

Crea el despliegue Web App desde la interfaz:

```text
Deploy > New deployment > Web app
Execute as: Me
Who has access: Anyone
```

Copia la URL terminada en `/exec`. Guardala como:

```text
webapp_url
GAS_API_URL
```

Vuelve a la raiz:

```powershell
cd ..
```

## 7. Configurar Script Properties en Apps Script

En Google Apps Script entra a:

```text
Project Settings > Script Properties
```

Agrega estas propiedades. Los valores con `TU_` debes reemplazarlos.

```text
telegram_bot_token=TU_TOKEN_TELEGRAM
webapp_url=TU_URL_WEB_APP_EXEC
sheet_id=TU_SHEET_ID
worker_url=https://TU_WORKER.TU_SUBDOMINIO.workers.dev
dashboard_api_key=TU_DASHBOARD_API_KEY
dashboard_chat_id=TU_CHAT_ID
claude_api_key=TU_API_KEY_IA
claude_api_url=https://api.anthropic.com/v1/messages
claude_model=TU_MODELO_IA
d1_api_url=https://TU_WORKER.TU_SUBDOMINIO.workers.dev
d1_admin_key=TU_D1_ADMIN_KEY
finance_email_to=TU_CORREO
daily_email_to=TU_CORREO
monthly_email_to=TU_CORREO
yearly_email_to=TU_CORREO
credit_cutoff_day=25
credit_due_day=10
credit_card_name=Tarjeta
receipt_image_max_bytes=921600
```

Genera claves largas para `dashboard_api_key`, `d1_admin_key` y `SESSION_SECRET` con:

```powershell
[guid]::NewGuid().ToString("N")
```

Ejecuta ese comando tres veces y usa un valor distinto para cada secreto.

Sobre la IA:

- Si usas Anthropic directo, usa `https://api.anthropic.com/v1/messages`.
- Si usas SynteroLink u otro proveedor, la key debe pertenecer a un grupo que permita `/v1/messages`.
- Para Claude por AWS/proxy, normalmente debe estar en un grupo tipo `AWS Claude API`.
- Si ves `This group does not allow /v1/messages dispatch`, no es problema de la foto: es configuracion del proveedor.

## 8. Conectar Telegram con Apps Script

Cuando ya tengas la URL del Web App, configura el webhook de Telegram.

Reemplaza `TU_TOKEN_TELEGRAM` y `TU_URL_WEB_APP_EXEC`:

```powershell
Invoke-WebRequest -UseBasicParsing "https://api.telegram.org/botTU_TOKEN_TELEGRAM/setWebhook?url=TU_URL_WEB_APP_EXEC" | Select-Object -ExpandProperty Content
```

Verifica el webhook:

```powershell
Invoke-WebRequest -UseBasicParsing "https://api.telegram.org/botTU_TOKEN_TELEGRAM/getWebhookInfo" | Select-Object -ExpandProperty Content
```

Debe aparecer tu URL `/exec`.

Prueba en Telegram:

```text
ayuda
```

Si el bot responde, Telegram y Apps Script ya estan conectados.

## 9. Crear Cloudflare Worker, D1 y R2

Entra a Cloudflare y crea una cuenta si no tienes una.

Desde la terminal inicia sesion:

```powershell
cd d1-api
npx wrangler login
```

El navegador pedira autorizar Wrangler.

### Opcion A: usar el Cloudflare existente

Si estas usando este mismo proyecto, revisa que `d1-api/wrangler.toml` tenga los bindings:

```toml
name = "finanzas-d1-api"
main = "src/index.js"
compatibility_date = "2026-05-09"

[[d1_databases]]
binding = "DB"
database_name = "finanzas_xxxn"
database_id = "xxxxxx"

[[r2_buckets]]
binding = "RECEIPTS_BUCKET" 
bucket_name = "finanzas-xxxn-receipts"
```

Si esos datos siguen iguales, no tienes que crear D1 ni R2 otra vez.

### Opcion B: crear D1 desde cero

Crea la base D1:

```powershell
npx wrangler d1 create finanzas_xxxn
```

Wrangler mostrara un bloque con `database_id`. Copia ese ID y abre:

```powershell
notepad wrangler.toml
```

Actualiza esta parte:

```toml
[[d1_databases]]
binding = "DB"
database_name = "finanzas_xxxn"
database_id = "TU_DATABASE_ID"
```

Aplica migraciones en remoto:

```powershell
npx wrangler d1 migrations apply finanzas_xxxx --remote
```

Las migraciones crean tablas para movimientos, recibos, pagos, deudas, monedas PEN/USD y reglas inteligentes.

### Opcion C: crear R2 desde cero

Crea el bucket R2:

```powershell
npx wrangler r2 bucket create finanzas-xxxx-receipts
```

Verifica que `wrangler.toml` tenga el binding:

```toml
[[r2_buckets]]
binding = "RECEIPTS_BUCKET"
bucket_name = "finanzas-xxxx-receipts"
```

Ese binding es lo que adjunta R2 al Worker. Sin esto, el gasto puede registrarse pero la foto no se vera en el dashboard.

## 10. Configurar secretos del Worker

En la carpeta `d1-api`, configura los secretos.

```powershell
npx wrangler secret put ADMIN_KEY
npx wrangler secret put DEFAULT_CHAT_ID
npx wrangler secret put GAS_API_URL
npx wrangler secret put GAS_API_KEY
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Que valor poner en cada uno:

```text
ADMIN_KEY       -> mismo valor que d1_admin_key en Apps Script
DEFAULT_CHAT_ID -> tu Chat ID de Telegram
GAS_API_URL     -> URL /exec del Apps Script
GAS_API_KEY     -> mismo valor que dashboard_api_key en Apps Script
LOGIN_PASSWORD  -> contrasena para entrar al dashboard
SESSION_SECRET  -> clave larga generada con PowerShell
```

Si cambias cualquiera de estos valores despues, vuelve a ejecutar el comando `secret put` correspondiente.

## 11. Desplegar el Worker

Desde `d1-api` ejecuta:

```powershell
npx wrangler deploy
```

Prueba salud del Worker reemplazando la URL:

```powershell
Invoke-WebRequest -UseBasicParsing "https://TU_WORKER.TU_SUBDOMINIO.workers.dev/health" | Select-Object -ExpandProperty Content
```

Debe responder algo como:

```json
{"ok":true}
```

Cuando tengas la URL real del Worker, vuelve a Apps Script y confirma estas propiedades:

```text
worker_url=https://TU_WORKER.TU_SUBDOMINIO.workers.dev
d1_api_url=https://TU_WORKER.TU_SUBDOMINIO.workers.dev
d1_admin_key=TU_D1_ADMIN_KEY
```

Vuelve a la raiz:

```powershell
cd ..
```

## 12. Sincronizar datos hacia D1

El bot registra en Google Sheets y tambien envia datos a D1 si `d1_api_url` y `d1_admin_key` estan bien configurados.

Para forzar sincronizacion desde el Worker:

```powershell
$headers = @{ "x-admin-key" = "TU_D1_ADMIN_KEY" }
Invoke-WebRequest -UseBasicParsing -Method POST -Headers $headers -Uri "https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/sync/gas" | Select-Object -ExpandProperty Content
```

Usa esto cuando quieras que el dashboard local tenga la data actualizada desde Google Sheets.

## 13. Levantar el dashboard local

Entra al dashboard:

```powershell
cd dashboard
```

Crea el archivo local de entorno:

```powershell
Copy-Item .env.example .env.local
```

Abre el archivo:

```powershell
notepad .env.local
```

Coloca la URL del Worker con `/api/dashboard`:

```env
VITE_GAS_API_URL=https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/dashboard
```

Levanta el dashboard:

```powershell
npm run dev
```

Abre la URL que muestra Vite, normalmente:

```text
http://localhost:5173
```

Debe aparecer el login. Entra con el valor que configuraste en `LOGIN_PASSWORD`.

Si no aparece login y se ve modo demo, falta `VITE_GAS_API_URL` o el build se hizo sin esa variable.

## 14. Desplegar el dashboard en Cloudflare Pages

Desde `dashboard`, compila con la API real:

```powershell
$env:VITE_GAS_API_URL="https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/dashboard"
npm run build
```

Despliega en Pages:

```powershell
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
```

Wrangler mostrara una URL parecida a:

```text
https://TU_VERSION.finanzas-dashboard.pages.dev
```

Abrela y verifica:

```text
Debe salir login
Debe cargar Inicio
Debe cargar Movimientos
Debe cargar Compromisos
Debe cargar Analisis
Debe cargar Metas
```

Si quieres conectar Pages a GitHub desde Cloudflare, usa esta configuracion:

```text
Framework preset: Vite
Root directory: dashboard
Build command: npm run build
Build output directory: dist
Environment variable: VITE_GAS_API_URL=https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/dashboard
```

Vuelve a la raiz:

```powershell
cd ..
```

## 15. Pruebas finales en Telegram

Envia estos comandos al bot:

```text
ayuda
credito configurar corte 25 pago 10
gasto 10 supermercado prueba debito
gasto 12 USD comida cafe
gasto 120 supermercado metro credito
ultimos
pago ultimo credito
pago 1 debito
eliminar ultimo
deuda laptop 2500 vence 2026-06-30
deudas
alertas
insights
reglas
regla kfc entretenimiento
regla presupuesto comida incluye supermercado
```

Luego envia una foto clara de un recibo.

El flujo correcto es:

```text
El bot avisa que la IA esta analizando
La IA lee comercio, monto, categoria, fecha, moneda y metodo de pago
El movimiento se registra
La foto se adjunta al dashboard por R2
El dashboard muestra el movimiento al actualizar
```

## 16. Pruebas finales en dashboard

Entra al dashboard y revisa:

```text
Login
Inicio
Movimientos
Compromisos
Analisis
Metas
Tema claro y oscuro
Eliminar movimiento
Categorias y presupuestos
Recibos adjuntos
```

Pulsa `Actualizar` para traer datos recientes.

Si estas en local, el dashboard tambien usa la data real siempre que `.env.local` apunte a:

```text
https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/dashboard
```

No necesitas copiar manualmente la base D1 a tu computadora para ver data actualizada. Para desarrollo normal, usa el Worker remoto.

## 17. Comandos rapidos

Instalar dependencias:

```powershell
cd d1-api
npm ci
cd ..
cd dashboard
npm ci
cd ..
```

Subir Apps Script manteniendo deployment:

```powershell
cd apps-script
npx clasp push -f
npx clasp deployments
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
cd ..
```

Migrar D1 remoto:

```powershell
cd d1-api
npx wrangler d1 migrations apply finanzas_xxxx --remote
cd ..
```

Desplegar Worker:

```powershell
cd d1-api
npx wrangler deploy
cd ..
```

Levantar dashboard local:

```powershell
cd dashboard
npm run dev
```

Compilar dashboard:

```powershell
cd dashboard
$env:VITE_GAS_API_URL="https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/dashboard"
npm run build
cd ..
```

Desplegar dashboard:

```powershell
cd dashboard
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
cd ..
```

Subir cambios a Git:

```powershell
git status
git add GUIA_INSTALACION_OTRO_DISPOSITIVO.md
git commit -m "Update installation guide"
git push origin main
```

## 18. Problemas comunes

### Telegram no responde

Revisa el webhook:

```powershell
Invoke-WebRequest -UseBasicParsing "https://api.telegram.org/botTU_TOKEN_TELEGRAM/getWebhookInfo" | Select-Object -ExpandProperty Content
```

La URL debe ser la del Apps Script terminada en `/exec`.

Tambien verifica en Apps Script:

```text
Deploy as Web app
Execute as Me
Who has access Anyone
```

### Apps Script responde BOT ACTIVO, pero Telegram no

Revisa que `telegram_bot_token` este bien en Script Properties y vuelve a configurar webhook.

### Dashboard sin login

Causa comun:

```text
VITE_GAS_API_URL no estaba configurado al compilar
```

Solucion:

```powershell
cd dashboard
$env:VITE_GAS_API_URL="https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/dashboard"
npm run build
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
```

### El recibo se registra, pero la foto no aparece

Revisa:

```text
R2 bucket creado
Binding RECEIPTS_BUCKET en wrangler.toml
Worker desplegado despues de configurar R2
Apps Script con d1_api_url y d1_admin_key
```

### La IA dice HTTP 403

Si el detalle dice:

```text
This group does not allow /v1/messages dispatch
```

La key de IA esta en un grupo incorrecto o el proveedor no permite `/v1/messages`. Cambia el grupo de la key o ajusta `claude_api_url` al endpoint correcto.

### La IA dice HTTP 503

Normalmente es problema temporal del proveedor. Prueba otra vez. El codigo ya tiene reintentos, pero si el proveedor sigue caido, toca esperar o cambiar de grupo/proveedor.

### D1 no tiene data nueva

Revisa Script Properties:

```text
d1_api_url
d1_admin_key
```

Luego fuerza sincronizacion:

```powershell
$headers = @{ "x-admin-key" = "TU_D1_ADMIN_KEY" }
Invoke-WebRequest -UseBasicParsing -Method POST -Headers $headers -Uri "https://TU_WORKER.TU_SUBDOMINIO.workers.dev/api/sync/gas" | Select-Object -ExpandProperty Content
```

### Las reglas no funcionan

Verifica que se aplico la migracion `0007_rules.sql`:

```powershell
cd d1-api
npx wrangler d1 migrations apply finanzas_xxxx --remote
```

Luego prueba:

```text
reglas
regla kfc entretenimiento
regla presupuesto comida incluye supermercado
```

## 19. Orden recomendado cada vez que hagas cambios

Para no romper login, bot o dashboard:

```text
1. Baja cambios desde Git.
2. Cambia codigo.
3. Prueba local.
4. Si tocaste Apps Script, ejecuta clasp push y despliega el deployment existente.
5. Si tocaste Worker o migraciones, aplica migraciones y despliega Worker.
6. Si tocaste dashboard, compila con VITE_GAS_API_URL y despliega Pages.
7. Prueba Telegram y dashboard.
8. Sube cambios a Git.
```

Comandos base:

```powershell
git pull origin main
git status
```

Despues de probar:

```powershell
git add .
git commit -m "Describe el cambio"
git push origin main
```

Antes de `git add .`, revisa que no estes subiendo archivos secretos como `.env`, `.clasp.json` o `.wrangler`.
