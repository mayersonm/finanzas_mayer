# Documento funcional - Finanzas Mayeson

Este documento explica como usar Finanzas Mayeson desde Telegram y desde el dashboard.

## 1. Que es Finanzas Mayeson

Finanzas Mayeson es un sistema personal para registrar, revisar y decidir mejor sobre tu dinero.

Permite:

- registrar ingresos y gastos desde Telegram;
- leer recibos con IA;
- guardar foto del recibo en el dashboard;
- manejar gastos fijos, deudas, pagos, metas e inversiones;
- ver patrimonio disponible y patrimonio total;
- calcular cuanto puedes gastar al dia sin tocar ahorro;
- revisar alertas, insights y reportes;
- recibir resumenes diarios, mensuales y anuales por correo;
- usar Google Sheets como respaldo y D1 como base principal.

## 2. Flujo recomendado de uso diario

1. Registra cada gasto o ingreso desde Telegram.
2. Si tienes recibo, manda la foto.
3. Revisa el dashboard cuando quieras ver detalle.
4. Usa `libre` para saber cuanto puedes gastar hoy.
5. Usa `puedo gastar ...` antes de una compra grande.
6. Marca gastos fijos y deudas como pagados cuando corresponda.
7. Usa `Sync manual` solo si corregiste algo manualmente en Google Sheets.

## 3. Telegram

### 3.1 Registrar ingresos

```text
ingreso 3000 salario sueldo mayo
cobro 500 freelance proyecto
cobro salario sueldo mayo 3000
```

El sistema acepta `ingreso` y `cobro` como entrada de dinero.

### 3.2 Registrar gastos

Puedes escribir monto primero:

```text
gasto 25 supermercado almuerzo
gasto 12 USD supermercado cafe
gasto 120 supermercado metro credito
```

O categoria primero:

```text
gasto supermercado arroz plaza vea 25
gasto transporte taxi 18
```

Si la palabra despues del monto no es una categoria conocida, el bot la conserva como descripcion y deja la categoria como `otro` o la reclasifica por reglas.

Ejemplo:

```text
gasto 25 arroz
```

Resultado esperado:

- descripcion: `Arroz`
- categoria: `otro` o categoria detectada por reglas

### 3.3 Moneda

Solo se aceptan:

```text
PEN
USD
```

Ejemplos:

```text
gasto 45 PEN supermercado
gasto 12 USD entretenimiento netflix
```

Si no indicas moneda, se usa `PEN`.

### 3.4 Debito y credito

Por defecto, los gastos son debito.

Para registrar credito:

```text
gasto 120 supermercado metro credito
```

Configurar tarjeta:

```text
credito configurar corte 25 pago 10
```

Corregir pago de un movimiento:

```text
pago ultimo credito
pago 1 debito
pago 1 credito
```

La fecha de pago de credito se calcula con el dia de corte y dia de pago configurados.

### 3.5 Recibos con IA

Envia una foto clara del recibo.

El flujo esperado:

```text
El bot avisa que esta analizando
La IA lee comercio, monto, categoria, fecha, moneda y metodo de pago
El movimiento se registra
La foto se adjunta al dashboard
```

Si la IA no puede leer el recibo, puedes registrar el gasto manualmente.

### 3.6 Ultimos movimientos

Ver ultimos movimientos:

```text
ultimos
```

Eliminar movimiento:

```text
eliminar ultimo
eliminar 1
```

Corregir categoria:

```text
categoria ultimo supermercado
categoria 1 transporte
```

Buscar movimientos:

```text
buscar kfc
buscar plaza vea
```

## 4. Dinero Libre

Dinero Libre responde la pregunta mas importante del dia:

```text
Cuanto puedo gastar hoy sin tocar mi ahorro, fijos, deudas ni colchon?
```

### 4.1 Ver plan diario

```text
libre
dinero libre
plan diario
```

El bot responde:

- estado del plan;
- dias hasta el cierre;
- gasto seguro de hoy;
- gasto normal de hoy;
- gasto flexible de hoy;
- ahorro protegido;
- fijos y deudas pendientes;
- dinero libre del ciclo;
- sugerencia educativa de inversion.

### 4.2 Simular compra

```text
puedo gastar 120 zapatillas
puedo gastar 35 almuerzo
puedo gastar 20 USD compra online
```

El sistema compara la compra contra:

- gasto normal diario;
- gasto flexible;
- dinero libre total del ciclo;
- ahorro protegido;
- fijos y deudas pendientes.

Posibles respuestas:

- compra sana;
- compra posible;
- compra pesada;
- no conviene.

### 4.3 Configuracion de Dinero Libre

Desde el dashboard, entra a:

```text
Config > Dinero libre
```

Configura:

- ahorro del ciclo;
- colchon minimo;
- perfil inversionista;
- horizonte.

Perfiles:

- conservador;
- moderado;
- agresivo.

Horizontes:

- corto;
- medio;
- largo.

La sugerencia de inversion es educativa. No promete rentabilidad ni reemplaza asesoramiento financiero.

## 5. Dashboard

### 5.1 Login

El dashboard usa login normal con correo y clave privada.

No hay registro de usuarios ni login con Google.

### 5.2 Inicio

Muestra:

- patrimonio disponible;
- ingresos del mes;
- gastos del mes;
- libre proyectado;
- cierre mensual;
- gastos por categoria;
- alertas inteligentes;
- top fugas;
- insights.

Botones importantes:

- `Actualizar`: vuelve a leer D1.
- `Sync manual`: importa Google Sheets hacia D1.
- `Cerrar mes`: guarda el corte actual.

### 5.3 Movimientos

Permite:

- filtrar por texto, mes, categoria, tipo, pago y moneda;
- exportar movimientos filtrados;
- ver recibos adjuntos;
- editar movimiento;
- eliminar movimiento.

### 5.4 Compromisos

Incluye:

- presupuestos;
- gastos fijos;
- deudas;
- historial de pagos de deuda;
- correos configurados.

Desde aqui puedes:

- crear gasto fijo;
- editar gasto fijo;
- marcar fijo como pagado;
- saltar fijo del mes;
- eliminar fijo;
- crear deuda;
- editar deuda;
- registrar pago de deuda;
- eliminar deuda.

### 5.5 Dinero Libre

Muestra:

- gasto diario seguro;
- gasto diario normal;
- gasto flexible;
- libre del ciclo;
- monto listo para invertir;
- simulador de compra;
- ruta educativa de inversion;
- acciones sugeridas.

### 5.6 Patrimonio

Separa:

- patrimonio disponible: caja menos deudas y fijos pendientes;
- patrimonio total: disponible mas inversiones y metas.

Permite guardar cortes historicos para comparar evolucion.

### 5.7 Inversiones

Permite registrar:

- nombre;
- tipo;
- monto invertido;
- valor actual;
- moneda;
- notas.

Acepta `PEN` y `USD`.

### 5.8 Analisis

Muestra:

- impacto por categoria;
- avance de presupuestos;
- insights inteligentes;
- top fugas.

### 5.9 Metas

Muestra metas de ahorro registradas y avance.

Desde Telegram:

```text
meta emergencia 2000
ahorrar emergencia 200
metas
```

### 5.10 Config

Permite configurar:

- credito;
- moneda por defecto;
- pago por defecto;
- Dinero Libre;
- IA y recibos;
- correos;
- estado operativo;
- categorias;
- reglas de clasificacion;
- reglas de presupuesto.

## 6. Gastos fijos

Crear o actualizar:

```text
fijo alquiler 1500 servicios
fijo netflix 15 USD entretenimiento
```

Ver fijos:

```text
fijos
```

Marcar pagado:

```text
pagar fijo alquiler
```

Importante: pagar un fijo no debe crear una transaccion duplicada. Solo cambia el estado del fijo para que se descuente del patrimonio y compromisos.

Saltar este mes:

```text
saltar fijo alquiler
```

Eliminar:

```text
eliminar fijo alquiler
```

## 7. Deudas

Crear:

```text
deuda laptop 2500 vence 2026-06-30
deuda viaje 800 USD vence 2026-08-15
deuda prestamo 1200
```

Pagar:

```text
pagar deuda laptop 300
pagar deuda viaje 100 USD
```

Ver:

```text
deudas
```

Cada pago queda en historial y tambien se refleja como salida de caja.

## 8. Presupuestos y reglas

Crear presupuesto:

```text
presupuesto supermercado 500
presupuesto transporte 120
```

Ver presupuestos:

```text
presupuesto
```

Reglas de categoria:

```text
regla kfc entretenimiento
regla popeyes entretenimiento
regla plaza vea supermercado
```

Reglas de presupuesto:

```text
regla presupuesto entretenimiento incluye otro
regla presupuesto supermercado incluye comida
```

Las reglas viven en D1 y se pueden administrar desde el dashboard.

## 9. Correos

El sistema soporta:

- correo diario;
- correo mensual;
- correo anual.

Los correos leen D1 como fuente principal.

El cierre mensual se trabaja alrededor del dia 23, pero las transacciones mantienen su fecha real.

## 10. Sincronizacion Sheets a D1

D1 es la base principal.

Google Sheets es respaldo y punto de correccion manual.

Cuando usas `Sync manual`, el dashboard trae la data de Sheets hacia D1.

Regla importante:

```text
Sheets manda en sincronizacion manual.
```

Si Sheets tiene 24 movimientos para el chat, D1 debe quedar con esos 24 movimientos para ese chat. Los movimientos extra que existan solo en D1 se eliminan durante esa sincronizacion manual.

## 11. Categorias principales

Gasto:

```text
supermercado
transporte
servicios
entretenimiento
salud
ropa
educacion
deudas
otro
```

Ingreso:

```text
salario
freelance
inversion
venta
otro
```

Alias importantes:

- comida, mercado, abarrotes, frutas y hortalizas suman como supermercado;
- KFC, Popeyes y comida rapida suman como entretenimiento;
- deudas y prestamos suman como deudas.

## 12. Recomendaciones de uso

- Registra gastos el mismo dia.
- Usa recibo con foto cuando sea posible.
- Antes de compras grandes usa `puedo gastar`.
- Mantén actualizado el ahorro del ciclo en Config.
- Marca fijos y deudas apenas se paguen.
- Usa Sync manual solo cuando hayas tocado Sheets.
- Revisa Dinero Libre antes de gastar fuera de presupuesto.
