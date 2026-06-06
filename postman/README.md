# Postman - Finanzas Mayeson

Esta carpeta contiene una coleccion de Postman para probar el Worker D1.

## Archivos

- `Finanzas_Mayeson.postman_collection.json`: coleccion importable.
- `Finanzas_Mayeson.postman_environment.json`: variables de entorno sin secretos.
- `generate-postman.mjs`: genera nuevamente los JSON si cambian los endpoints.

## Como usar

1. Abre Postman.
2. Importa `Finanzas_Mayeson.postman_collection.json`.
3. Importa `Finanzas_Mayeson.postman_environment.json`.
4. Selecciona el environment `Finanzas Mayeson - Produccion`.
5. Llena las variables sensibles en Postman, no en el archivo:
   - `login_password`
   - `dashboard_api_key` si quieres usar API key directa
   - `admin_key` para endpoints admin-only
   - `chat_id` si quieres forzar un usuario de Telegram
6. Ejecuta `00 Salud y Auth / Login`.
7. Si el login responde bien, la coleccion guarda automaticamente:
   - `session_token`
   - `auth_token`
8. Luego puedes ejecutar `01 Dashboard / Dashboard principal`.

## Atajos

- Si no quieres hacer login, pega tu `dashboard_api_key` en `auth_token`.
- Para endpoints admin-only, pega `ADMIN_KEY` en `admin_key`.
- Los requests de crear movimiento, fijo, deuda e inversion guardan IDs automaticamente para poder editar o eliminar despues.

## Regenerar

```powershell
node postman/generate-postman.mjs
```

No subas claves reales a estos JSON. La coleccion queda lista para importar, pero los secretos se colocan dentro de Postman.
