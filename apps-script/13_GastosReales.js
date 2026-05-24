// ---- GASTOS REALES / COMPROMETIDOS -------------------------

function cmdGastosReales(chatId) {
  const mes = Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM');
  const d1 = leerDashboardD1_(chatId);
  if (d1 && d1.ok) {
    const fijosD1 = d1.fijos || [];
    const presupuestosD1 = d1.presupuestos || [];
    const realesD1 = d1.gastosReales || {};

    const lineasFijosD1 = fijosD1.length
      ? fijosD1.map(item => {
          const original = formatoMoneda_(item.monto, item.currency || 'PEN');
          const convertido = item.currency === 'USD' && item.montoPen
            ? ` / S/ ${Number(item.montoPen || 0).toFixed(2)}`
            : '';
          return `• ${capitalizar(item.nombre)}: ${original}${convertido}`;
        }).join('\n')
      : '• Sin gastos fijos cargados';

    const lineasPresupuestoD1 = presupuestosD1.length
      ? presupuestosD1.map(item => {
          const gastado = Number(item.gasto || 0);
          const limite = Number(item.limite || 0);
          const considerado = gastado > 0 ? gastado : limite;
          const nota = gastado > 0
            ? `gastado S/ ${gastado.toFixed(2)}`
            : `sin gasto: cuenta limite S/ ${limite.toFixed(2)}`;
          return `• ${capitalizar(item.cat)}: S/ ${considerado.toFixed(2)} _(${nota})_`;
        }).join('\n')
      : '• Sin presupuestos cargados';

    return sendMessage(chatId,
      `🧮 *Gastos reales/comprometidos - ${d1.mesKey || mes}*\n\n` +
      `🔁 Fijos pendientes: *S/ ${Number(realesD1.totalFijos || 0).toFixed(2)}*\n` +
      `✅ Fijos pagados: *S/ ${Number(realesD1.totalFijosPagados || 0).toFixed(2)}*\n` +
      `🎯 Presupuesto considerado: *S/ ${Number(realesD1.totalPresupuesto || 0).toFixed(2)}*\n` +
      `─────────────────\n` +
      `📌 Total estimado: *S/ ${Number(realesD1.total || 0).toFixed(2)}*\n\n` +
      `*Fijos*\n${lineasFijosD1}\n\n` +
      `*Presupuestos*\n${lineasPresupuestoD1}\n\n` +
      `_Fuente: D1. Regla: los fijos pagados se restan de caja sin crear movimiento; los pendientes quedan como comprometidos._`,
      true
    );
  }

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
