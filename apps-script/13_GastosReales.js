// ---- GASTOS REALES / COMPROMETIDOS -------------------------

function cmdGastosReales(chatId) {
  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const fijos = leerFijosReales_(chatId);
  const presupuestos = leerPresupuestosReales_(chatId);
  const gastosCat = (obtenerGastosPorMesCat(chatId, mes)[mes]) || {};

  const totalFijosPen = fijos.filter(item => item.currency !== 'USD').reduce((acc, item) => acc + item.monto, 0);
  const totalFijosUsd = fijos.filter(item => item.currency === 'USD').reduce((acc, item) => acc + item.monto, 0);
  const totalFijos = resumenTotalFijos_(fijos);
  const lineasFijos = fijos.length
    ? fijos.map(item => `• ${capitalizar(item.nombre)}: ${formatoMoneda_(item.monto, item.currency)}`).join('\n')
    : '• Sin gastos fijos cargados';

  let totalPresupuesto = 0;
  const lineasPresupuesto = presupuestos.length
    ? presupuestos.map(item => {
        const gastado = gastoPresupuestoPorCategoria_(gastosCat, item.cat, chatId);
        const considerado = gastado > 0 ? gastado : item.limite;
        const nota = gastado > 0
          ? `gastado S/ ${gastado.toFixed(2)}`
          : `sin gasto: cuenta limite S/ ${item.limite.toFixed(2)}`;

        totalPresupuesto += considerado;
        return `• ${capitalizar(item.cat)}: S/ ${considerado.toFixed(2)} _(${nota})_`;
      }).join('\n')
    : '• Sin presupuestos cargados';

  const totalPen = totalFijosPen + totalPresupuesto;
  const totalTexto = totalFijosUsd > 0
    ? `${formatoMoneda_(totalPen, 'PEN')} + ${formatoMoneda_(totalFijosUsd, 'USD')}`
    : formatoMoneda_(totalPen, 'PEN');

  sendMessage(chatId,
    `🧮 *Gastos reales/comprometidos - ${mes}*\n\n` +
    `🔁 Fijos: *${totalFijos}*\n` +
    `🎯 Presupuesto considerado: *S/ ${totalPresupuesto.toFixed(2)}*\n` +
    `─────────────────\n` +
    `📌 Total estimado: *${totalTexto}*\n\n` +
    `*Fijos*\n${lineasFijos}\n\n` +
    `*Presupuestos*\n${lineasPresupuesto}\n\n` +
    `_Regla: si una categoria no tiene gasto aun, cuenta el limite completo; si ya tiene gasto, cuenta lo gastado._`,
    true
  );
}

function leerFijosReales_(chatId) {
  const sheet = getOrCreateSheet('Fijos', ['ChatID','Nombre','Monto','Categoría','Moneda']);
  asegurarColumnasFijos_(sheet);

  return sheet.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === String(chatId))
    .map(r => ({
      nombre: String(r[1] || ''),
      monto: parseFloat(r[2]) || 0,
      cat: normalizarCat(r[3] || 'servicios', r[1], chatId),
      currency: normalizarMoneda_(r[4]) || 'PEN',
    }))
    .filter(item => item.nombre && item.monto > 0);
}

function leerPresupuestosReales_(chatId) {
  const sheet = getOrCreateSheet('Presupuestos', ['ChatID','Categoría','Límite']);

  return sheet.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]) === String(chatId))
    .map(r => ({
      cat: normalizarCat(r[1] || 'otro', '', chatId),
      limite: parseFloat(r[2]) || 0,
    }))
    .filter(item => item.cat && item.limite > 0);
}
