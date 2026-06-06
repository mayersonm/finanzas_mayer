
# App

Entrada HTTP del Worker.

- `../index.js` es el entrypoint estable de Wrangler.
- `worker.js` arma el router y delega a modulos de dominio.
- La logica compartida vive en `../shared`.
- Autenticacion vive en `../auth`.
- Funciones de dashboard y configuracion viven en `../modules`.
