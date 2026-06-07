# Finanzas Mayeson

Monorepo del sistema de finanzas personales:

- `apps-script/`: bot de Telegram en Google Apps Script + Google Sheets.
- `d1-api/`: API en Cloudflare Worker + D1.
- `dashboard/`: dashboard web React + TypeScript + Vite.

## Documentacion

- [Documento funcional](DOCUMENTO_FUNCIONAL.md): explica como usar Telegram, dashboard, gastos, deudas, fijos, presupuestos, reportes, sincronizacion y Dinero Libre.
- [Documento tecnico](DOCUMENTO_TECNICO.md): explica arquitectura, componentes, D1, R2, Worker, Apps Script, migraciones, despliegue y mantenimiento.
- [Guia de instalacion](GUIA_INSTALACION_OTRO_DISPOSITIVO.md): paso a paso para instalar el proyecto en otro dispositivo.

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
- ahorro del ciclo, colchon minimo, perfil inversionista y horizonte;
- estado operativo de Worker, D1, R2 y Apps Script;
- administrador de categorias, reglas IA y reglas de presupuesto.

El boton `Actualizar` solo vuelve a leer D1. El boton `Sync manual` importa el respaldo de Google Sheets hacia D1 y muestra cuantos movimientos, presupuestos, fijos, deudas y metas se revisaron. Para movimientos, Google Sheets manda: si Sheets tiene 24 movimientos, D1 debe quedar con esos mismos 24 para ese `chat_id`; cualquier movimiento extra que exista solo en D1 se elimina durante la sincronizacion manual. No existe sincronizacion D1 -> Sheets.

En `Inicio`, el boton `Cerrar ciclo` guarda el snapshot actual en D1 (`financial_closures`), marca el ciclo como cerrado y deja una propuesta para el siguiente ciclo: ahorro sugerido y presupuesto recomendado por categoria. El cierre se etiqueta con el dia 23, por ejemplo `Cierre 23/05`, pero los movimientos mantienen sus fechas reales dentro del mes calendario. El bloque `Top fugas` muestra los 5 gastos variables que mas pesan en el mes.

La pestana `Dinero Libre` proyecta el gasto desde `Caja actual`. Las deudas y fijos quedan visibles como referencia, pero no reducen el calculo diario porque se pueden mover o patear. Usa tres rangos: seguro, normal y flexible. Tambien simula compras y muestra una ruta educativa para invertir el excedente segun perfil y horizonte.

La pestana `Calendario` muestra el mes calendario real con gasto diario por fecha, fijos, deudas, pagos de credito, alertas, objetivo semanal y cierre. La regla de cierre se activa cuando el ciclo esta cerca de terminar y el dia 23 sugiere cerrar el ciclo. El ahorro queda como sugerencia hasta que se separe de verdad.

El `Objetivo semanal` se calcula desde D1 con el dinero libre disponible del ciclo. Muestra cuanto se puede gastar en la semana, cuanto ya se uso, cuanto queda y cuanto conviene gastar por dia hasta el domingo o hasta el fin del ciclo.

Los correos diario, mensual y anual leen movimientos, presupuestos y metas desde D1; Sheets queda como respaldo si D1 no responde. El cierre mensual automatico se envia todos los dias 23, pero los movimientos se reportan con sus fechas reales.

La sincronizacion automatica por cron del Worker esta desactivada para evitar que el respaldo de Sheets reimporte filas antiguas sin control. Si algun dia se necesita reactivarla, configura el secret `ENABLE_AUTO_GAS_SYNC=true` y vuelve a declarar el cron en `d1-api/wrangler.toml`.

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
cobro salario sueldo mayo 3000
gasto supermercado arroz plaza vea 25
gasto 120 supermercado metro credito
pago ultimo credito
pago 1 debito
libre
puedo gastar 120 zapatillas
```

En el dashboard:

```text
Calendario -> ver fijos, deudas, cierre, pagos de credito, alertas y objetivo semanal.
Inicio -> cerrar ciclo, guardar snapshot D1 y revisar presupuesto sugerido del siguiente ciclo.
```

Si escribes una palabra que no es categoria, el bot la conserva como descripcion y deja la categoria como `otro` o la reclasifica por reglas si aplica.

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

La pestaña `Patrimonio` separa dos numeros: `Patrimonio disponible`, que es el balance caja menos deudas activas y fijos pendientes, y `Patrimonio total`, que suma inversiones y metas al disponible. Tambien permite guardar cortes historicos en D1 para comparar la evolucion.
