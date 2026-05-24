// ---- REGLAS DINAMICAS DE CATEGORIZACION --------------------

function cmdReglas(chatId, text) {
  if (!esAdminD1_(chatId)) {
    return sendMessage(chatId, 'No tienes permiso para administrar reglas.', true);
  }

  const clean = String(text || '').trim();
  const lower = clean.toLowerCase();

  if (lower === 'reglas' || lower === 'regla') {
    return mostrarReglas(chatId);
  }

  let match = clean.match(/^regla\s+presupuesto\s+(.+?)\s+(?:incluye|incluir|sumar)\s+(.+)$/i);
  if (match) {
    const budgetCategory = normalizarCatBasica_(match[1]);
    const includedCategory = normalizarCatBasica_(match[2]);
    if (!categoriaReglaValida_(budgetCategory) || !categoriaReglaValida_(includedCategory)) {
      return sendMessage(chatId, '❌ Categoria invalida. Ej: `regla presupuesto entretenimiento incluye otro`', true);
    }

    guardarReglaPresupuestoD1_(chatId, budgetCategory, includedCategory);
    return sendMessage(chatId,
      `✅ *Regla de presupuesto guardada*\n\n` +
      `🎯 Presupuesto: *${capitalizar(budgetCategory)}*\n` +
      `➕ Tambien suma: *${capitalizar(includedCategory)}*`,
      true
    );
  }

  match = clean.match(/^regla\s+presupuesto\s+(.+?)\s+(?:quitar|eliminar|excluir)\s+(.+)$/i);
  if (match) {
    const budgetCategory = normalizarCatBasica_(match[1]);
    const includedCategory = normalizarCatBasica_(match[2]);
    if (!categoriaReglaValida_(budgetCategory) || !categoriaReglaValida_(includedCategory)) {
      return sendMessage(chatId, '❌ Categoria invalida. Ej: `regla presupuesto entretenimiento quitar otro`', true);
    }

    eliminarReglaPresupuestoD1_(chatId, budgetCategory, includedCategory);
    return sendMessage(chatId,
      `✅ *Regla de presupuesto eliminada*\n\n` +
      `🎯 ${capitalizar(budgetCategory)} ya no suma ${capitalizar(includedCategory)}.`,
      true
    );
  }

  match = clean.match(/^regla\s+(?:borrar|eliminar|quitar)\s+(.+)$/i);
  if (match) {
    const keyword = limpiarKeywordRegla_(match[1]);
    if (!keyword) return sendMessage(chatId, '❌ Indica la palabra a borrar. Ej: `regla borrar kfc`', true);

    eliminarReglaCategoriaD1_(chatId, keyword);
    return sendMessage(chatId,
      `✅ *Regla eliminada*\n\n` +
      `🔎 Palabra: \`${keyword}\``,
      true
    );
  }

  match = clean.match(/^regla\s+(.+?)\s+([a-zA-ZñÑáéíóúÁÉÍÓÚ]+)$/);
  if (match) {
    const keyword = limpiarKeywordRegla_(match[1]);
    const category = normalizarCatBasica_(match[2]);
    if (!keyword || !categoriaReglaValida_(category)) {
      return sendMessage(chatId,
        '❌ Formato: `regla palabra categoria`\n\n' +
        'Ej: `regla kfc entretenimiento`',
        true
      );
    }

    guardarReglaCategoriaD1_(chatId, keyword, category);
    return sendMessage(chatId,
      `✅ *Regla guardada*\n\n` +
      `🔎 Si leo: \`${keyword}\`\n` +
      `🏷️ Categoria: *${capitalizar(category)}*`,
      true
    );
  }

  return sendMessage(chatId,
    '❌ No entendi la regla.\n\n' +
    '*Ejemplos:*\n' +
    '• `regla kfc entretenimiento`\n' +
    '• `regla borrar kfc`\n' +
    '• `regla presupuesto entretenimiento incluye otro`\n' +
    '• `regla presupuesto entretenimiento quitar otro`',
    true
  );
}

function mostrarReglas(chatId) {
  try {
    const data = listarReglasD1_(chatId);
    const personales = (data.categoryRules || []).filter(function (r) {
      return r.active && r.scope === 'personal';
    });
    const globales = (data.categoryRules || []).filter(function (r) {
      return r.active && r.scope === 'global';
    });
    const presupuesto = (data.budgetRules || []).filter(function (r) {
      return r.active;
    });

    const catLines = personales.concat(globales).slice(0, 18).map(function (r) {
      const scope = r.scope === 'personal' ? '👤' : '🌐';
      return scope + ' `' + r.keyword + '` → *' + capitalizar(r.category) + '*';
    }).join('\n') || '_Sin reglas activas_';

    const budgetLines = presupuesto.slice(0, 10).map(function (r) {
      const scope = r.scope === 'personal' ? '👤' : '🌐';
      return scope + ' *' + capitalizar(r.budgetCategory) + '* incluye *' + capitalizar(r.includedCategory) + '*';
    }).join('\n') || '_Sin reglas de presupuesto_';

    return sendMessage(chatId,
      `🧠 *Reglas inteligentes*\n\n` +
      `*Clasificacion*\n${catLines}\n\n` +
      `*Presupuestos*\n${budgetLines}\n\n` +
      `_👤 personal · 🌐 global_`,
      true
    );
  } catch (err) {
    return sendMessage(chatId, '❌ No pude leer reglas desde D1.\n\n' + String(err), true);
  }
}

function limpiarKeywordRegla_(value) {
  return normalizarTextoClave_(value)
    .replace(/\s+/g, ' ')
    .trim();
}

function categoriaReglaValida_(category) {
  return CATS_GASTO.indexOf(category) >= 0 || CATS_INGRESO.indexOf(category) >= 0;
}
