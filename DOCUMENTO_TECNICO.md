# Documento tecnico - Finanzas Mayeson

Este documento describe la arquitectura, componentes, datos, despliegue y mantenimiento tecnico del sistema.

## 1. Arquitectura general

```text
Telegram
  -> Google Apps Script
  -> Google Sheets respaldo
  -> Cloudflare Worker
  -> Cloudflare D1 principal
  -> Cloudflare R2 recibos
  -> Dashboard React en Cloudflare Pages
```

Componentes:

- `apps-script/`: bot de Telegram, lectura de recibos, comandos, respaldo en Sheets y llamadas al Worker.
- `d1-api/`: Cloudflare Worker con API, D1, R2, login, sincronizacion y calculos financieros.
- `dashboard/`: React + TypeScript + Vite desplegado en Cloudflare Pages.
- Google Sheets: respaldo operativo y fuente de sincronizacion manual.
- D1: fuente principal del dashboard y reportes.
- R2: almacenamiento de fotos de recibos.

## 2. Responsabilidad de cada capa

### 2.1 Telegram Bot

Responsable de:

- recibir comandos;
- registrar movimientos;
- leer recibos con IA;
- responder balance, resumen, presupuestos, alertas y Dinero Libre;
- guardar respaldo en Google Sheets;
- enviar datos principales al Worker.

Archivos relevantes:

- `apps-script/01_Webhook.js`
- `apps-script/02_Router.js`
- `apps-script/03_Movimientos.js`
- `apps-script/04_Reportes.js`
- `apps-script/10_D1.js`
- `apps-script/12_Help.js`
- `apps-script/14_Fijos.js`
- `apps-script/19_DeudasAlertas.js`
- `apps-script/21_Reglas.js`
- `apps-script/23_DineroLibre.js`

### 2.2 Worker D1 API

Responsable de:

- autenticacion del dashboard;
- API REST;
- persistencia en D1;
- recibos en R2;
- calculos de dashboard;
- Dinero Libre;
- patrimonio;
- inversiones;
- cierres mensuales;
- reglas de categorias y presupuestos;
- sincronizacion Sheets -> D1.

Archivo principal:

- `d1-api/src/index.js`

Configuracion:

- `d1-api/wrangler.toml`

Migraciones:

- `d1-api/migrations/`

### 2.3 Dashboard

Responsable de:

- login;
- visualizacion de datos;
- CRUD de movimientos, fijos, deudas e inversiones;
- configuracion;
- filtros;
- exportacion;
- tema claro/oscuro;
- sincronizacion manual.

Archivos relevantes:

- `dashboard/src/App.tsx`
- `dashboard/src/app/api.ts`
- `dashboard/src/app/tabs.ts`
- `dashboard/src/types/dashboard.ts`
- `dashboard/src/features/finanzas/overview/OverviewSection.tsx`
- `dashboard/src/features/finanzas/movements/MovementsSection.tsx`
- `dashboard/src/features/finanzas/commitments/CommitmentsSection.tsx`
- `dashboard/src/features/finanzas/free-money/FreeMoneySection.tsx`
- `dashboard/src/features/inversiones/net-worth/NetWorthSection.tsx`
- `dashboard/src/features/inversiones/investments/InvestmentsSection.tsx`
- `dashboard/src/features/sistema/settings/SettingsSection.tsx`

## 3. Fuente de verdad

Fuente principal:

```text
Cloudflare D1
```

Fuente de respaldo:

```text
Google Sheets
```

Regla de sincronizacion manual:

```text
Sheets -> D1
```

No existe sincronizacion normal D1 -> Sheets.

Cuando se ejecuta `Sync manual`, Sheets manda para movimientos del `chat_id`. Si Sheets tiene 24 movimientos, D1 debe quedar con esos 24 movimientos para ese chat. Los extras en D1 se eliminan durante esa sincronizacion.

## 4. Cloudflare

### 4.1 Worker

Proyecto:

```text
finanzas-d1-api
```

Archivo:

```text
d1-api/wrangler.toml
```

Bindings:

```toml
[[d1_databases]]
binding = "DB"
database_name = "finanzas_mayeson"

[[r2_buckets]]
binding = "RECEIPTS_BUCKET"
bucket_name = "finanzas-mayeson-receipts"
```

Comandos:

```powershell
cd d1-api
npm ci
npx wrangler d1 migrations apply finanzas_mayeson --remote
npm run deploy
cd ..
```

### 4.2 D1

Base:

```text
finanzas_mayeson
```

Tablas principales:

- `transactions`
- `budgets`
- `goals`
- `receipts`
- `app_settings`
- `debts`
- `debt_payments`
- `fixed_expenses`
- `fixed_expense_month_status`
- `investments`
- `net_worth_snapshots`
- `financial_closures`
- `users`
- `user_chat_links`
- `user_settings`
- `category_definitions`
- `category_rules`
- `budget_category_rules`

### 4.3 R2

Bucket:

```text
finanzas-mayeson-receipts
```

Uso:

- guardar fotos optimizadas de recibos;
- enlazar recibo a `transaction_id`;
- servir imagen al dashboard con autenticacion.

### 4.4 Pages

Proyecto:

```text
finanzas-dashboard
```

Build:

```powershell
cd dashboard
npm ci
npm run build
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
cd ..
```

## 5. Google Apps Script

El Apps Script debe mantenerse sobre el deployment publicado existente para no romper el webhook de Telegram.

Comandos:

```powershell
cd apps-script
npx clasp push -f
npx clasp deployments
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
cd ..
```

No crear un deployment nuevo salvo que tambien se vaya a cambiar el webhook de Telegram.

## 6. Secretos y configuracion

No subir secretos al repositorio.

### 6.1 Apps Script Properties

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

### 6.2 Worker secrets

```powershell
npx wrangler secret put DASHBOARD_API_KEY
npx wrangler secret put ADMIN_KEY
npx wrangler secret put DEFAULT_CHAT_ID
npx wrangler secret put GAS_API_URL
npx wrangler secret put GAS_API_KEY
npx wrangler secret put LOGIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```

Significado:

- `DASHBOARD_API_KEY`: clave tecnica opcional para llamadas directas.
- `ADMIN_KEY`: clave privada para Apps Script y endpoints administrativos.
- `DEFAULT_CHAT_ID`: chat principal de Telegram.
- `GAS_API_URL`: URL `/exec` del Apps Script.
- `GAS_API_KEY`: misma clave que `dashboard_api_key`.
- `LOGIN_PASSWORD`: clave del dashboard.
- `SESSION_SECRET`: firma de sesiones.

### 6.3 Dashboard env

Archivo local:

```text
dashboard/.env.local
```

Variable:

```text
VITE_GAS_API_URL=https://TU_WORKER.workers.dev/api/dashboard
```

En produccion, configurar esta variable en Cloudflare Pages.

## 7. Autenticacion

Dashboard:

- login por correo y clave;
- token firmado por Worker;
- expiracion aproximada de 12 horas;
- cambio de clave desde el dashboard.

No hay registro publico ni Google Auth.

Apps Script hacia Worker:

- usa header `x-admin-key`;
- la clave debe coincidir con `ADMIN_KEY`.

## 8. Endpoints principales del Worker

Salud:

```text
GET /health
```

Login:

```text
POST /api/login
GET  /api/session
POST /api/logout
POST /api/password
```

Dashboard:

```text
GET /api/dashboard
GET /api/system-health
GET /api/settings
POST /api/settings
GET /api/profile
GET /api/users
```

Movimientos:

```text
GET    /api/transactions
POST   /api/transactions
PATCH  /api/transactions/:id
DELETE /api/transactions/:id
POST   /api/transactions/delete
POST   /api/transactions/category
POST   /api/transactions/payment
```

Recibos:

```text
POST /api/receipts
GET  /api/receipts/:id/file
```

Presupuestos y reglas:

```text
POST /api/budgets
GET  /api/categories
POST /api/categories
POST /api/categories/delete
GET  /api/rules
POST /api/rules/classify
POST /api/rules/budget/keys
POST /api/rules/category
POST /api/rules/category/delete
POST /api/rules/budget
POST /api/rules/budget/delete
```

Fijos:

```text
POST   /api/fixed-expenses
PATCH  /api/fixed-expenses/:id
DELETE /api/fixed-expenses/:id
POST   /api/fixed-expenses/:id/status
```

Deudas:

```text
POST   /api/debts
PATCH  /api/debts/:id
DELETE /api/debts/:id
POST   /api/debts/:id/payments
```

Inversiones:

```text
GET    /api/investments
POST   /api/investments
PATCH  /api/investments/:id
DELETE /api/investments/:id
```

Patrimonio:

```text
GET  /api/net-worth
POST /api/net-worth/snapshot
```

Cierres:

```text
GET  /api/closures
POST /api/closures
```

Sincronizacion:

```text
POST /api/sync
POST /api/sync/gas
```

Apps Script auxiliares:

```text
POST /api/apps-script/setup-triggers
POST /api/apps-script/send-daily-email
POST /api/apps-script/send-monthly-email
POST /api/apps-script/send-yearly-email
POST /api/apps-script/send-daily-telegram
```

## 9. Modelo de datos resumido

### 9.1 transactions

Guarda movimientos:

- fecha;
- hora;
- tipo;
- descripcion;
- categoria;
- monto;
- moneda;
- metodo de pago;
- fecha de pago;
- tarjeta;
- fuente.

ID estable:

```text
tx:chat_id:fecha:hora:tipo:categoria:monto:moneda:descripcion
```

### 9.2 receipts

Guarda metadata de recibo y referencia R2:

- transaction_id;
- storage;
- r2_key;
- file_name;
- content_type;
- size;
- datos leidos por IA.

### 9.3 fixed_expenses

Guarda gastos fijos:

- nombre;
- monto;
- moneda;
- categoria;
- activo.

Estado mensual:

```text
fixed_expense_month_status
```

### 9.4 debts y debt_payments

`debts` guarda la deuda.

`debt_payments` guarda cada pago.

Cuando se paga una deuda, se registra salida de caja para que el balance baje.

### 9.5 user_settings

Guarda configuraciones por usuario:

- corte y pago de tarjeta;
- moneda y metodo de pago por defecto;
- maximo de imagen;
- correos;
- ahorro del ciclo;
- colchon minimo;
- perfil inversionista;
- horizonte.

### 9.6 investments

Guarda inversiones:

- nombre;
- tipo;
- monto invertido;
- valor actual;
- moneda;
- notas.

### 9.7 financial_closures

Guarda cierres mensuales para congelar snapshots del ciclo.

### 9.8 net_worth_snapshots

Guarda snapshots historicos de patrimonio.

## 10. Reglas de negocio importantes

### 10.1 Moneda

Solo:

```text
PEN
USD
```

D1 guarda moneda original y convierte a PEN para totales usando tasa USD/PEN cacheada por Worker.

### 10.2 Categorias

Si la categoria explicita es valida, se respeta.

La descripcion solo se usa para clasificar cuando la categoria viene como `otro`, vacia o texto libre.

Aliases:

- comida, mercado, abarrotes, frutas, hortalizas -> supermercado;
- KFC, Popeyes, comida rapida -> entretenimiento;
- deuda, prestamo -> deudas.

### 10.3 Cierre mensual

Las transacciones conservan su fecha real.

El cierre se etiqueta con el dia 23.

El dashboard puede mostrar cortes internos alrededor del dia 23 sin mover fechas de transacciones.

### 10.4 Gastos fijos

Marcar un fijo como pagado no debe duplicar una transaccion.

El estado del fijo afecta compromisos y patrimonio.

### 10.5 Deudas

Pagar deuda:

- crea pago en `debt_payments`;
- reduce pendiente;
- registra salida de caja.

### 10.6 Dinero Libre

Formula conceptual:

```text
balance del ciclo
- ahorro objetivo
- colchon minimo
- fijos pendientes
- deudas pendientes
= dinero libre antes de presupuesto
```

Luego:

```text
dinero disponible para gastar
= minimo(dinero libre antes de presupuesto, presupuesto variable restante)
```

Y:

```text
gasto normal diario
= dinero disponible para gastar / dias hasta cierre
```

Rangos:

- seguro: 70% del normal;
- normal: gasto diario recomendado;
- flexible: 135% del normal.

La inversion sugerida toma:

- excedente disponible;
- deuda pendiente;
- ahorro configurado;
- colchon;
- perfil;
- horizonte.

Es educativa y no debe mostrarse como promesa de rentabilidad.

## 11. Build y validacion

Dashboard:

```powershell
cd dashboard
npm run build
cd ..
```

Worker:

```powershell
node --check d1-api/src/index.js
```

Apps Script:

```powershell
cd apps-script
npx clasp push -f
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
cd ..
```

Verificar Worker:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://TU_WORKER.workers.dev/health"
```

Verificar Pages:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri "https://TU_DASHBOARD.pages.dev"
```

## 12. Despliegue recomendado

Orden recomendado:

1. Aplicar migraciones D1.
2. Desplegar Worker.
3. Subir Apps Script al deployment existente.
4. Compilar dashboard.
5. Desplegar Pages.
6. Verificar `/health`.
7. Verificar login del dashboard.
8. Probar comando Telegram.

Comandos:

```powershell
cd d1-api
npx wrangler d1 migrations apply finanzas_mayeson --remote
npm run deploy
cd ..

cd apps-script
npx clasp push -f
npx clasp deployments
npx clasp deploy -i TU_DEPLOYMENT_ID -d "actualizacion"
cd ..

cd dashboard
npm run build
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
cd ..
```

## 13. Operacion y mantenimiento

### 13.1 Sincronizar Sheets a D1

Desde dashboard:

```text
Sync manual
```

Desde Worker:

```powershell
$headers = @{ "x-admin-key" = "TU_ADMIN_KEY" }
Invoke-WebRequest -UseBasicParsing -Method POST -Headers $headers -Uri "https://TU_WORKER.workers.dev/api/sync/gas?chat_id=TU_CHAT_ID&limit=500"
```

### 13.2 Limpiar Pages antiguos

Listar:

```powershell
npx wrangler pages deployment list --project-name finanzas-dashboard
```

Borrar anterior:

```powershell
npx wrangler pages deployment delete TU_DEPLOYMENT_ID --project-name finanzas-dashboard --force
```

Dejar solo la ultima implementacion activa si se quiere mantener ordenado el panel.

### 13.3 Actualizar Git

```powershell
git status
git add .
git commit -m "descripcion del cambio"
git push origin main
```

## 14. Riesgos conocidos

- Crear un deployment nuevo de Apps Script puede romper Telegram si no se actualiza webhook.
- Sincronizar Sheets a D1 elimina extras de D1 que no esten en Sheets para ese chat.
- Si R2 no esta configurado, el movimiento puede registrarse pero la foto no se vera en dashboard.
- Si `ADMIN_KEY` no coincide entre Apps Script y Worker, D1 no recibira datos.
- Si el proveedor IA bloquea `/v1/messages`, la lectura de recibos falla aunque la foto este bien.
- Si una deuda se paga dos veces manualmente, puede duplicar salida de caja.

## 15. Checklist de cambio seguro

Antes de tocar produccion:

```text
git status
npm run build en dashboard
node --check d1-api/src/index.js
revisar migraciones nuevas
```

Despues de desplegar:

```text
Worker /health responde
Dashboard carga login
Telegram responde ayuda
Comando libre responde
Dashboard muestra Dinero Libre
Git queda limpio
```
