# Modules

Mapa objetivo para separar el API sin romper contratos existentes:

- `auth`: login, sesion, cambio de clave y permisos.
- `dashboard`: resumen principal, patrimonio, dinero libre, analisis e insights.
- `transactions`: movimientos, importacion y exportacion.
- `commitments`: gastos fijos, deudas y pagos.
- `investments`: inversiones, portafolio y valorizacion.
- `rules`: categorias, reglas automaticas y normalizacion.
- `sync`: sincronizacion Sheets -> D1.
- `receipts`: recibos, R2 y archivos adjuntos.
- `shared`: fechas, moneda, respuestas HTTP y utilidades comunes.

La regla es mover primero helpers puros y despues handlers con pruebas de sintaxis/despliegue en cada paso.
