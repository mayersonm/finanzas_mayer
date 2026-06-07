# Entorno QA

QA existe para probar cambios sin tocar produccion.

## Recursos

- Worker QA: `finanzas-d1-api-qa`
- D1 QA: `finanzas_mayeson_qa`
- D1 QA id: `ffbd7ef3-2bb6-4924-9a07-c945015d59b9`
- R2 QA: `finanzas-mayeson-receipts-qa`
- Dashboard QA: rama Pages `qa`
- API QA publica: `https://finanzas-d1-api-qa.mayersonm.workers.dev`
- Dashboard QA: `https://qa.finanzas-dashboard-4d5.pages.dev`
- Produccion dashboard: `https://finanzas-dashboard-4d5.pages.dev`

## Regla de trabajo

Primero se despliega y prueba en QA. Produccion solo se toca cuando QA queda validado.

## 1. Configurar secretos QA

Ejecuta estos comandos y pega cada valor cuando Wrangler lo pida:

```powershell
cd d1-api
npx wrangler@4.98.0 secret put SESSION_SECRET --env qa
npx wrangler@4.98.0 secret put LOGIN_PASSWORD --env qa
npx wrangler@4.98.0 secret put ADMIN_KEY --env qa
npx wrangler@4.98.0 secret put DASHBOARD_API_KEY --env qa
npx wrangler@4.98.0 secret put DEFAULT_CHAT_ID --env qa
```

Opcional, solo si quieres sincronizar desde Apps Script o probar IA en QA:

```powershell
npx wrangler@4.98.0 secret put GAS_API_URL --env qa
npx wrangler@4.98.0 secret put GAS_API_KEY --env qa
npx wrangler@4.98.0 secret put CLAUDE_API_KEY --env qa
npx wrangler@4.98.0 secret put CLAUDE_API_URL --env qa
npx wrangler@4.98.0 secret put CLAUDE_MODEL --env qa
```

Nota: QA tiene `ENVIRONMENT=qa`. El Worker QA bloquea acciones externas con efecto secundario: enviar correos, configurar triggers y borrar en Apps Script/Sheets. La sincronizacion lee desde Apps Script y escribe en D1 QA.

## 2. Aplicar migraciones en QA

```powershell
cd d1-api
npm run db:migrate:qa
```

## 3. Desplegar Worker QA

```powershell
cd d1-api
npm run deploy:qa
```

Prueba rapida:

```powershell
Invoke-WebRequest -UseBasicParsing https://finanzas-d1-api-qa.mayersonm.workers.dev/ | Select-Object -ExpandProperty Content
```

## 4. Desplegar Dashboard QA

```powershell
cd dashboard
npm run deploy:qa
```

Esto compila con `dashboard/.env.qa`, que apunta a:

```text
https://finanzas-d1-api-qa.mayersonm.workers.dev/api/dashboard
```

## 5. Sincronizar data hacia QA

Cuando `GAS_API_URL`, `GAS_API_KEY` y `DEFAULT_CHAT_ID` ya existan en QA:

```powershell
cd d1-api
npx wrangler@4.98.0 d1 execute finanzas_mayeson_qa --remote --command "SELECT COUNT(*) AS movimientos FROM transactions;"
```

Tambien puedes usar el boton de sincronizacion manual desde el dashboard QA.

## 6. Promover a produccion

Solo despues de validar QA:

```powershell
cd d1-api
npm run db:migrate:prod
npm run deploy:prod
cd ..\dashboard
npm run deploy:prod
```

## Checklist antes de produccion

- Login QA funciona.
- Dashboard QA carga datos desde D1 QA.
- El cambio probado no afecta Sheets ni correos reales.
- Worker QA responde 200.
- Dashboard QA responde 200.
- No hay errores en consola.
