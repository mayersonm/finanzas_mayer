# App

Entrada del Worker HTTP.

Por ahora `worker.js` conserva la logica operativa completa del API para no cambiar comportamiento durante el refactor. La siguiente separacion segura es mover rutas por dominio a `../modules/*` manteniendo `index.js` como entrypoint estable para Wrangler.
