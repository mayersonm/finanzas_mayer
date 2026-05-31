// ---- AYUDA VISUAL ------------------------------------------

function sendHelp(chatId) {
  const gastoTxt = CATS_GASTO.join(' · ');
  const ingresoTxt = CATS_INGRESO.join(' · ');
  const hora = parseInt(Utilities.formatDate(new Date(), 'America/Lima', 'HH'), 10);
  const saludo = hora < 12 ? '🌅 Buenos dias'
    : hora < 19 ? '☀️ Buenas tardes'
    : '🌙 Buenas noches';

  const data = obtenerTransacciones(chatId);
  const ingresos = data
    .filter(r => r[2] === 'ingreso')
    .reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);
  const gastos = data
    .filter(r => r[2] === 'gasto')
    .reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);
  const balance = ingresos - gastos;
  let patrimonioDisponible = balance;
  try {
    const d1 = leerDashboardD1_(chatId);
    if (d1 && d1.ok) {
      patrimonioDisponible = Number(d1.patrimonioDisponible || d1.patrimonio || d1.balanceGeneralNeto || d1.balanceNeto || patrimonioDisponible);
    }
  } catch (_err) {
    patrimonioDisponible = balance;
  }
  const emoji = balance >= 0 ? '🟢' : '🔴';

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const nomMes = meses[new Date().getMonth()];
  const gastosMes = data
    .filter(r => r[2] === 'gasto' && mesKey_(r[0]) === mes)
    .reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);
  let deudasActivas = 0;
  let deudaPendientePen = 0;
  let deudaPendienteUsd = 0;
  try {
    const deudas = leerDeudas_(chatId)
      .filter(d => d.estado !== 'pagada' && d.pendiente > 0);
    deudasActivas = deudas.length;
    deudaPendientePen = deudas.filter(d => d.currency !== 'USD').reduce((a, d) => a + d.pendiente, 0);
    deudaPendienteUsd = deudas.filter(d => d.currency === 'USD').reduce((a, d) => a + d.pendiente, 0);
  } catch (_err) {
    deudasActivas = 0;
    deudaPendientePen = 0;
    deudaPendienteUsd = 0;
  }
  const resumenDeuda = [
    deudaPendientePen > 0 ? `S/ ${deudaPendientePen.toFixed(2)}` : '',
    deudaPendienteUsd > 0 ? `US$ ${deudaPendienteUsd.toFixed(2)}` : '',
  ].filter(Boolean).join(' + ');

  const help = [
    `${saludo}, *Mayeson* 👋`,
    data.length
      ? 'Tu tablero ya tiene movimientos. Usa estos atajos:'
      : 'Todo esta limpio. Arranca con tus datos reales:',
    '',
    '📌 *Estado actual*',
    `• ${emoji} Balance: *S/ ${balance.toFixed(2)}*`,
    `• 💸 Gastos ${nomMes}: *S/ ${gastosMes.toFixed(2)}*`,
    `• 🧾 Movimientos: *${data.length}*`,
    `• 💳 Deudas activas: *${deudasActivas}*${resumenDeuda ? ` · ${resumenDeuda}` : ''}`,
    '',
    '🚀 *Empieza aqui*',
    '',
    '• 💰 `cobro salario sueldo mayo 3000`',
    '• 💰 `ingreso 3000 salario sueldo mayo`',
    '• 🛒 `gasto supermercado arroz plaza vea 25`',
    '• 🛒 `gasto 25 supermercado almuerzo`',
    '• 💵 `gasto 12 USD supermercado cafe`',
    '• 💳 `gasto 120 supermercado metro credito`',
    '• 🧾 Si no reconoce categoria, conserva lo escrito como descripcion',
    '• 💱 Monedas aceptadas: `PEN` y `USD`',
    '• 💵 Si no indicas pago, el gasto queda como debito',
    '• 📸 Envia una foto clara de un recibo',
    '',
    '⚡ *Consulta rapido*',
    '',
    '• 🌙 `hoy`         - resumen del dia',
    '• 📆 `resumen`     - resumen del mes',
    '• 💼 `balance`     - saldo total',
    '• 🧠 `libre`       - dinero libre y gasto diario',
    '• 🛍️ `puedo gastar 120 zapatillas` - simular compra',
    '• 🧮 `reales`      - fijos + presupuesto',
    '• 📋 `ultimos`     - ultimos movimientos',
    '• 🗑️ `eliminar 1`  - borrar un movimiento de `ultimos`',
    '• 🗑️ `eliminar ultimo` - borrar el ultimo movimiento',
    '• 🏷️ `categoria 1 supermercado` - corregir categoria',
    '• 💳 `pago ultimo credito`      - corregir ultimo movimiento',
    '• 💵 `pago 1 debito`            - corregir por numero de `ultimos`',
    '• 🔔 `alertas`     - alertas inteligentes',
    '• 🧠 `insights`    - insights con IA',
    '• 🔎 `buscar kfc`  - buscar transacciones',
    '',
    '💳 *Debito y credito*',
    '',
    '• 💵 Debito es la forma de pago por defecto',
    '• 💳 Agrega `credito` al final del gasto para tarjeta',
    '• ⏰ En credito calculo la fecha de pago segun corte y dia de pago',
    '• ⚙️ `credito configurar corte 25 pago 10`',
    '• 💳 `pago ultimo credito`',
    '• 💳 `pago 1 credito`',
    '• 💵 `pago 1 debito`',
    '',
    '🔁 *Gastos fijos*',
    '',
    '• ➕ `fijo alquiler 1500 servicios` - crear/actualizar en soles',
    '• ➕ `fijo netflix 15 USD entretenimiento` - crear/actualizar en dolares',
    '• ✅ `pagar fijo alquiler`          - marcar pagado sin crear transaccion',
    '• ⏭️ `saltar fijo alquiler`         - omitir este mes',
    '• 📌 `fijos`                        - ver todos',
    '',
    '💳 *Deudas*',
    '',
    '• ➕ `deuda laptop 2500 vence 2026-06-30` - crear/actualizar',
    '• ➕ `deuda viaje 800 USD vence 2026-08-15` - deuda en dolares',
    '• ➕ `deuda prestamo 1200` - sin vencimiento',
    '• 💵 `pagar deuda laptop 300`',
    '• 💵 `pagar deuda viaje 100 USD`',
    '• 📌 `deudas` - ver pendientes',
    '',
    '🎯 *Presupuestos y metas*',
    '',
    '• 🧱 `presupuesto supermercado 500` - poner limite',
    '• 🚦 `presupuesto`            - ver alertas',
    '• 🧠 `reglas`                 - ver reglas inteligentes',
    '• 🧠 `regla kfc entretenimiento`',
    '• 🧠 `regla presupuesto entretenimiento incluye otro`',
    '• 🏁 `meta emergencia 2000`   - crear meta',
    '• 💵 `ahorrar 200 emergencia` - sumar ahorro',
    '• 📍 `metas`                  - ver metas',
    '',
    '📊 *Analisis y reportes*',
    '',
    '• 🆚 `comparar`    - este mes vs anterior',
    '• 🔮 `proyeccion`  - estimado de cierre',
    '• 🔔 `alertas`     - presupuestos, fijos, deudas y credito',
    '• 🧠 `insights`    - lectura inteligente con IA',
    '• 🤖 `analisis`    - consejos con IA',
    '• 🧭 `anual`       - resumen anual por correo',
    '• 📎 `exportar`    - historial en Excel',
    '• 📬 `correo`      - ver/configurar email',
    '• 📬 `correo mensual tu@email.com`',
    '',
    '🏷️ *Categorias gasto*',
    gastoTxt,
    '',
    '💼 *Categorias ingreso*',
    ingresoTxt,
  ].join('\n')
    .replace(/Balance: \*S\/ [^*]+\*/, 'Patrimonio disponible: *S/ ' + patrimonioDisponible.toFixed(2) + '*');

  return sendMessage(chatId, help, true);
}
