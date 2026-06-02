function cmdDineroLibre(chatId, text) {
  const d1 = leerDashboardD1_(chatId);
  if (!d1 || !d1.ok || !d1.dineroLibre) {
    return sendMessage(chatId, 'No pude leer Dinero Libre desde D1. Revisa el Worker o vuelve a sincronizar.', true);
  }

  const plan = d1.dineroLibre;
  const compra = parseCompraDineroLibre_(text);
  if (compra) return responderCompraDineroLibre_(chatId, plan, compra);

  const inv = plan.investment || {};
  const daily = plan.daily || {};
  const actualSavings = Number((plan.actualSavings ?? plan.savingsTarget) || 0);
  const suggestedSavings = Number(plan.recommendedSavings || 0);
  const distributionBase = Math.max(Number(plan.freeAfterCommitments || 0), 0);
  const extraMargin = Math.max(Number((plan.investment || {}).amount || 0), 0);
  const weekly = d1.objetivoSemanal || {};
  const weeklyText = weekly && weekly.label
    ? `\nObjetivo semanal: ${weekly.range || ''}\n` +
      `- Usado: S/ ${Number(weekly.spent || 0).toFixed(2)} de S/ ${Number(weekly.target || 0).toFixed(2)}\n` +
      `- Queda: S/ ${Number(weekly.remaining || 0).toFixed(2)} - diario S/ ${Number(weekly.dailyRemaining || 0).toFixed(2)}\n`
    : '';

  return sendMessage(chatId,
    `🧠 *Dinero Libre*\n\n` +
    `🚦 Estado: *${plan.statusLabel || 'Plan'}*\n` +
    `📅 ${plan.closeLabel || 'Cierre'} · ${plan.daysLeft || 1} dia(s)\n\n` +
    `💰 Disponible real: *S/ ${distributionBase.toFixed(2)}*\n` +
    `🟢 Seguro: *S/ ${Number(daily.safe || 0).toFixed(2)}* hoy\n` +
    `✅ Normal: *S/ ${Number(daily.normal || 0).toFixed(2)}* hoy\n` +
    `🟡 Flexible: *S/ ${Number(daily.flexible || 0).toFixed(2)}* hoy\n\n` +
    `🎯 Ahorro real protegido: S/ ${actualSavings.toFixed(2)}\n` +
    `💡 Ahorro sugerido: S/ ${suggestedSavings.toFixed(2)}\n` +
    `🛡️ Colchon: S/ ${Number(plan.emergencyBuffer || 0).toFixed(2)}\n` +
    `🧾 Fijos + deudas: S/ ${Number((plan.fixedPending || 0) + (plan.debtPending || 0)).toFixed(2)}\n` +
    `💵 Para gastar ciclo: *S/ ${Number(plan.availableToSpend || 0).toFixed(2)}*\n` +
    `🟠 Margen extra: S/ ${extraMargin.toFixed(2)}\n` +
    weeklyText + `\n` +
    `📈 *Ruta:* ${inv.title || 'Sin excedente'}\n` +
    `${inv.nextStep || ''}\n\n` +
    `_Prueba una compra: \`puedo gastar 120 zapatillas\`_`,
    true
  );
}

function parseCompraDineroLibre_(text) {
  const clean = String(text || '').trim();
  const match = clean.match(/^(?:puedo(?:\s+gastar)?|libre)\s+([\d]+(?:[.,]\d{1,2})?)(?:\s+(pen|usd))?(?:\s+(.+))?$/i);
  if (!match) return null;

  const amount = parseFloat(String(match[1] || '').replace(',', '.'));
  if (!amount || amount <= 0) return null;

  const currency = normalizarMoneda_(match[2]) || 'PEN';
  const desc = String(match[3] || 'compra').trim();
  return { amount: amount, currency: currency, desc: desc };
}

function responderCompraDineroLibre_(chatId, plan, compra) {
  const rate = 3.85;
  const amountPen = compra.currency === 'USD' ? compra.amount * rate : compra.amount;
  const limits = plan.purchaseLimits || {};
  const actualSavings = Number((plan.actualSavings ?? plan.savingsTarget) || 0);
  const disponible = Number(plan.availableToSpend || 0);
  const restante = Math.max(disponible - amountPen, 0);
  let estado = '🔴 No conviene';
  let detalle = 'Supera tu dinero libre sin tocar ahorro real o compromisos.';

  if (amountPen <= Number(limits.green || 0)) {
    estado = '🟢 Compra sana';
    detalle = 'Entra dentro del gasto normal de hoy.';
  } else if (amountPen <= Number(limits.amber || 0)) {
    estado = '🟡 Compra posible';
    detalle = 'Cabe en modo flexible, pero compensa bajando el gasto de manana.';
  } else if (amountPen <= Number(limits.hard || disponible)) {
    estado = '🟠 Compra pesada';
    detalle = 'Cabe en el ciclo, pero rompe tu ritmo diario.';
  }

  return sendMessage(chatId,
    `🛍️ *${estado}*\n\n` +
    `${capitalizar(compra.desc)}\n` +
    `Monto: ${formatoMoneda_(compra.amount, compra.currency)}${compra.currency === 'USD' ? ' aprox S/ ' + amountPen.toFixed(2) : ''}\n\n` +
    `${detalle}\n` +
    `💵 Libre restante del ciclo: *S/ ${restante.toFixed(2)}*\n` +
    `✅ Gasto normal diario: S/ ${Number((plan.daily || {}).normal || 0).toFixed(2)}\n` +
    `🎯 Ahorro real protegido: S/ ${actualSavings.toFixed(2)}`,
    true
  );
}
