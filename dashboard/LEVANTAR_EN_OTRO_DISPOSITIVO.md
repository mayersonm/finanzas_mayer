# Levantar Mayeson Finanzas en otro dispositivo

Esta guia es para ejecutar el dashboard React + TypeScript en otra PC.

## 1. Requisitos

- Node.js 20 o superior.
- Git, si vas a clonar desde GitHub.
- Acceso al repo: `https://github.com/mayersonm/finanzas_mayer`.
- URL del Worker/API D1.

## 2. Instalar desde GitHub

```powershell
git clone https://github.com/mayersonm/finanzas_mayer.git
cd finanzas_mayer\dashboard
npm install
```

## 3. Configurar la API

Crea el archivo `.env.local` dentro de la carpeta `dashboard`:

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

El contenido debe quedar apuntando al Worker real:

```env
VITE_GAS_API_URL=https://finanzas-d1-api.mayersonm.workers.dev/api/dashboard
```

No subas `.env.local` a GitHub.

## 4. Ejecutar en local

```powershell
npm run dev
```

Abre la URL que muestre Vite, normalmente:

```text
http://localhost:5173
```

## 5. Compilar para produccion

```powershell
npm run build
```

La carpeta generada sera `dist`.

## 6. Desplegar a Cloudflare Pages

Primero inicia sesion si la PC no tiene Wrangler configurado:

```powershell
npx wrangler login
```

Luego despliega:

```powershell
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
```

## 7. Estructura del dashboard

```text
src
  app            Configuracion, endpoints y tabs
  components     Piezas reutilizables de UI
  data           Datos demo
  features       Secciones principales del dashboard
  lib            Helpers de formato, calculos y colores
  types          Tipos TypeScript compartidos
```

## 8. Comandos utiles

```powershell
npm install
npm run dev
npm run build
npx wrangler pages deploy dist --project-name finanzas-dashboard --branch main
```
