# Proxy Binance en Fly.io

Este proxy evita usar tunnel local para Binance.

Arquitectura:

```txt
Dashboard -> Cloudflare Worker -> Fly.io Proxy -> Binance
```

## Costo esperado

Fly no entrega IP de salida fija por defecto. Para permitir la IP en Binance se debe crear una static egress IP:

```bash
fly ips allocate-egress --app finanzas-mayeson-binance-proxy -r gru
```

La IPv4 static egress cuesta aproximadamente USD 3.60/mes, facturada por hora. La app puede usar la maquina pequena de 256 MB.

## 1. Instalar flyctl en Windows

En PowerShell:

```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

Cierra y abre otra consola. Valida:

```powershell
fly version
```

## 2. Login

```powershell
fly auth login
```

## 3. Crear la app

Entra a la carpeta del proxy:

```powershell
cd C:\Users\mayer\Desktop\Programas\React\11-finanzas-mayeson\binance-proxy
```

Crea la app:

```powershell
fly apps create finanzas-mayeson-binance-proxy
```

Si el nombre no esta disponible, cambia `app = "..."` en `fly.toml` y usa ese mismo nombre en los comandos.

## 4. Configurar secrets

Primero genera una clave interna larga para el proxy. Ejemplo:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Luego configura secrets. No los guardes en archivos:

```powershell
fly secrets set PROXY_KEY="PEGA_AQUI_LA_CLAVE_INTERNA"
fly secrets set BINANCE_API_KEY="PEGA_AQUI_LA_API_KEY_NUEVA"
fly secrets set BINANCE_API_SECRET="PEGA_AQUI_LA_SECRET_NUEVA"
```

La API key de Binance debe ser nueva, solo lectura.

## 5. Desplegar

```powershell
fly deploy
```

## 6. Crear IP fija de salida

```powershell
fly ips allocate-egress --app finanzas-mayeson-binance-proxy -r gru
fly ips list --app finanzas-mayeson-binance-proxy
```

Copia la IPv4 egress y ponla en Binance API Management como IP permitida.

## 7. Probar el proxy

Prueba salud:

```powershell
Invoke-WebRequest -UseBasicParsing https://finanzas-mayeson-binance-proxy.fly.dev/health
```

Prueba Binance time:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Headers @{ "x-proxy-key" = "PEGA_AQUI_LA_CLAVE_INTERNA" } `
  https://finanzas-mayeson-binance-proxy.fly.dev/api/binance/time
```

Prueba cuenta:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Headers @{ "x-proxy-key" = "PEGA_AQUI_LA_CLAVE_INTERNA" } `
  https://finanzas-mayeson-binance-proxy.fly.dev/api/binance/account
```

Si Binance responde 403, revisa que la IP egress de Fly este permitida en Binance.

## 8. Conectar Cloudflare Worker

En el Worker se configura el proxy:

```powershell
cd C:\Users\mayer\Desktop\Programas\React\11-finanzas-mayeson\d1-api
wrangler secret put BINANCE_PROXY_URL
```

Valor:

```txt
https://finanzas-mayeson-binance-proxy.fly.dev
```

Luego:

```powershell
wrangler secret put BINANCE_PROXY_KEY
```

Valor: la misma `PROXY_KEY`.

Despliega:

```powershell
npm run deploy
```

## 9. Seguridad

- Rota la API key anterior de Binance si fue pegada en chats o capturas.
- La API key nueva debe tener solo lectura.
- No actives retiros.
- No guardes `BINANCE_API_SECRET` en Git.
- Usa `fly secrets list` para validar que estan cargados, no para ver valores.

## Comandos utiles

Ver estado:

```powershell
fly status --app finanzas-mayeson-binance-proxy
```

Ver logs:

```powershell
fly logs --app finanzas-mayeson-binance-proxy
```

Reiniciar:

```powershell
fly machine restart --app finanzas-mayeson-binance-proxy
```
