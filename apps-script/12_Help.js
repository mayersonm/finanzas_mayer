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
  const emoji = balance >= 0 ? '🟢' : '🔴';

  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                 'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const nomMes = meses[new Date().getMonth()];
  const gastosMes = data
    .filter(r => r[2] === 'gasto' && Utilities.formatDate(new Date(r[0]), 'America/Lima', 'yyyy-MM') === mes)
    .reduce((a, r) => a + (parseFloat(r[5]) || 0), 0);

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
    '',
    '🚀 *Empieza aqui*',
    '',
    '• 💰 `ingreso 3000 salario sueldo mayo`',
    '• 🛒 `gasto 25 comida almuerzo`',
    '• 💳 `gasto 120 supermercado metro credito`',
    '• 📸 Envia una foto clara de un recibo',
    '',
    '⚡ *Consulta rapido*',
    '',
    '• 🌙 `hoy`         - resumen del dia',
    '• 📆 `resumen`     - resumen del mes',
    '• 💼 `balance`     - saldo total',
    '• 🧮 `reales`      - fijos + presupuesto',
    '• 📋 `ultimos`     - ultimos movimientos',
    '• 🏷️ `categoria 1 supermercado` - corregir categoria',
    '• 💳 `pago ultimo credito`      - corregir debito/credito',
    '• 🔎 `buscar kfc`  - buscar transacciones',
    '',
    '💳 *Debito y credito*',
    '',
    '• ⚙️ `credito configurar corte 25 pago 10`',
    '• 💳 `pago 1 credito`',
    '• 💵 `pago 1 debito`',
    '',
    '🔁 *Gastos fijos*',
    '',
    '• ➕ `fijo alquiler 1500 servicios` - crear/actualizar',
    '• ✅ `pagar fijo alquiler`          - marcar pagado',
    '• ⏭️ `saltar fijo alquiler`         - omitir este mes',
    '• 📌 `fijos`                        - ver todos',
    '',
    '🎯 *Presupuestos y metas*',
    '',
    '• 🧱 `presupuesto comida 500` - poner limite',
    '• 🚦 `presupuesto`            - ver alertas',
    '• 🏁 `meta emergencia 2000`   - crear meta',
    '• 💵 `ahorrar 200 emergencia` - sumar ahorro',
    '• 📍 `metas`                  - ver metas',
    '',
    '📊 *Analisis y reportes*',
    '',
    '• 🆚 `comparar`    - este mes vs anterior',
    '• 🔮 `proyeccion`  - estimado de cierre',
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
  ].join('\n');

  return sendMessage(chatId, help, true);
}
