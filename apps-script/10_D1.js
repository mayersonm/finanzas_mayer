// ---- CLOUDFLARE D1 -----------------------------------------
// Escritura doble: Sheets sigue como respaldo y D1 recibe la copia principal.
//
// Script Properties:
//   d1_api_url   = https://finanzas-d1-api.mayersonm.workers.dev
//   d1_admin_key = clave ADMIN_KEY del Worker

function guardarTransaccionD1(tx) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('D1 omitido: faltan d1_api_url o d1_admin_key');
      return false;
    }

    const payload = {
      id: tx.id || crearIdTransaccionD1_(tx),
      chat_id: String(tx.chatId),
      fecha: tx.fecha,
      hora: tx.hora,
      tipo: tx.tipo,
      desc: tx.desc,
      cat: String(tx.cat || 'otro').toLowerCase(),
      monto: Number(tx.monto),
      currency: normalizarMoneda_(tx.currency || tx.moneda) || 'PEN',
      payment_method: tx.paymentMethod || tx.payment_method || 'debito',
      payment_due_date: tx.paymentDueDate || tx.payment_due_date || '',
      card_name: tx.cardName || tx.card_name || '',
      source: tx.source || 'telegram',
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/transactions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return payload.id;
  } catch (err) {
    Logger.log('Error guardarTransaccionD1: ' + err);
    return false;
  }
}

function guardarReciboD1(receipt) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Recibo D1 omitido: faltan d1_api_url o d1_admin_key');
      return false;
    }

    if (!receipt || !receipt.transactionId || !receipt.imageBase64) {
      Logger.log('Recibo D1 omitido: faltan transactionId o imageBase64');
      return false;
    }

    const payload = {
      transaction_id: String(receipt.transactionId),
      chat_id: String(receipt.chatId),
      image_base64: receipt.imageBase64,
      content_type: receipt.mimeType || receipt.contentType || 'image/jpeg',
      file_name: receipt.fileName || 'recibo.jpg',
      telegram_file_id: receipt.telegramFileId || '',
      telegram_file_path: receipt.telegramFilePath || '',
      fecha: receipt.fecha || '',
      hora: receipt.hora || '',
      tipo: receipt.tipo || 'gasto',
      desc: receipt.desc || '',
      cat: receipt.cat || 'otro',
      monto: Number(receipt.monto || 0),
      currency: normalizarMoneda_(receipt.currency || receipt.moneda) || 'PEN',
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/receipts', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error recibo D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error guardarReciboD1: ' + err);
    return false;
  }
}

function guardarFijoD1(fixed) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Fijo D1 omitido: faltan d1_api_url o d1_admin_key');
      return false;
    }

    if (!fixed || !fixed.nombre || !fixed.monto) {
      Logger.log('Fijo D1 omitido: faltan nombre o monto');
      return false;
    }

    const payload = {
      id: fixed.id || '',
      chat_id: String(fixed.chatId),
      nombre: fixed.nombre,
      monto: Number(fixed.monto || 0),
      cat: fixed.cat || fixed.category || 'servicios',
      currency: normalizarMoneda_(fixed.currency || fixed.moneda) || 'PEN',
      active: fixed.active === false ? false : true,
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/fixed-expenses', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error fijo D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error guardarFijoD1: ' + err);
    return false;
  }
}

function eliminarFijoD1(chatId, nombre) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Eliminar fijo D1 omitido: faltan d1_api_url o d1_admin_key');
      return false;
    }

    const fixedId = ['fixed', String(chatId), normalizarClaveFijoD1_(nombre)].join(':').slice(0, 180);
    const resp = UrlFetchApp.fetch(
      apiUrl.replace(/\/$/, '') + '/api/fixed-expenses/' + encodeURIComponent(fixedId) + '?chat_id=' + encodeURIComponent(String(chatId)),
      {
        method: 'delete',
        headers: { 'x-admin-key': adminKey },
        muteHttpExceptions: true,
      }
    );

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error eliminar fijo D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error eliminarFijoD1: ' + err);
    return false;
  }
}

function guardarPresupuestoD1_(chatId, cat, limite) {
  try {
    const payload = {
      chat_id: String(chatId),
      cat: cat,
      limite: Number(limite || 0),
    };

    const result = d1ApiRequest_('/api/budgets', payload);
    return Boolean(result && result.ok);
  } catch (err) {
    Logger.log('Error guardarPresupuestoD1: ' + err);
    return false;
  }
}

function normalizarClaveFijoD1_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function guardarDeudaD1(debt) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Deuda D1 omitida: faltan d1_api_url o d1_admin_key');
      return false;
    }

    if (!debt || !debt.nombre || !debt.total) {
      Logger.log('Deuda D1 omitida: faltan nombre o total');
      return false;
    }

    const payload = {
      id: debt.id || '',
      chat_id: String(debt.chatId),
      nombre: debt.nombre,
      total: Number(debt.total || 0),
      pagado: Number(debt.pagado || 0),
      currency: normalizarMoneda_(debt.currency || debt.moneda) || 'PEN',
      vencimiento: debt.vencimiento || '',
      estado: debt.estado || 'activa',
      notas: debt.notas || '',
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/debts', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error deuda D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error guardarDeudaD1: ' + err);
    return false;
  }
}

function guardarPagoDeudaD1(debt, amount, paymentDate, notes, recordTransaction) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Pago deuda D1 omitido: faltan d1_api_url o d1_admin_key');
      return false;
    }

    if (!debt || !debt.nombre || !amount) {
      Logger.log('Pago deuda D1 omitido: faltan deuda o monto');
      return false;
    }

    const debtId = debt.id || ['debt', String(debt.chatId), normalizarClaveDeudaD1_(debt.nombre)].join(':').slice(0, 180);
    const payload = {
      chat_id: String(debt.chatId),
      amount: Number(amount || 0),
      currency: normalizarMoneda_(debt.currency || debt.moneda) || 'PEN',
      paymentDate: paymentDate || Utilities.formatDate(new Date(), 'America/Lima', 'yyyy-MM-dd'),
      notes: notes || 'Telegram',
      record_transaction: recordTransaction !== false,
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/debts/' + encodeURIComponent(debtId) + '/payments', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error pago deuda D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error guardarPagoDeudaD1: ' + err);
    return false;
  }
}

function normalizarClaveDeudaD1_(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function actualizarCategoriaD1(tx) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Categoria D1 omitida: faltan d1_api_url o d1_admin_key');
      return false;
    }

    const oldPayload = {
      chatId: tx.chatId,
      fecha: tx.fecha,
      hora: tx.hora,
      tipo: tx.tipo,
      desc: tx.desc,
      cat: tx.oldCat || tx.cat,
      monto: tx.monto,
    };
    const newPayload = {
      chatId: tx.chatId,
      fecha: tx.fecha,
      hora: tx.hora,
      tipo: tx.tipo,
      desc: tx.desc,
      cat: tx.cat,
      monto: tx.monto,
    };

    const payload = {
      old_id: crearIdTransaccionD1_(oldPayload),
      new_id: crearIdTransaccionD1_(newPayload),
      chat_id: String(tx.chatId),
      fecha: tx.fecha,
      hora: tx.hora,
      tipo: tx.tipo,
      desc: tx.desc,
      old_cat: String(tx.oldCat || '').toLowerCase(),
      cat: String(tx.cat || 'otro').toLowerCase(),
      monto: Number(tx.monto),
      currency: normalizarMoneda_(tx.currency || tx.moneda) || 'PEN',
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/transactions/category', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error categoria D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error actualizarCategoriaD1: ' + err);
    return false;
  }
}

function actualizarPagoD1(tx) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Pago D1 omitido: faltan d1_api_url o d1_admin_key');
      return false;
    }

    const payload = {
      id: crearIdTransaccionD1_(tx),
      chat_id: String(tx.chatId),
      fecha: tx.fecha,
      hora: tx.hora,
      tipo: tx.tipo,
      desc: tx.desc,
      cat: String(tx.cat || 'otro').toLowerCase(),
      monto: Number(tx.monto),
      payment_method: tx.paymentMethod || tx.payment_method || 'debito',
      payment_due_date: tx.paymentDueDate || tx.payment_due_date || '',
      card_name: tx.cardName || tx.card_name || '',
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/transactions/payment', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error pago D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error actualizarPagoD1: ' + err);
    return false;
  }
}

function eliminarTransaccionD1(tx) {
  try {
    const props = PropertiesService.getScriptProperties();
    const apiUrl = props.getProperty('d1_api_url');
    const adminKey = props.getProperty('d1_admin_key');

    if (!apiUrl || !adminKey) {
      Logger.log('Eliminar D1 omitido: faltan d1_api_url o d1_admin_key');
      return false;
    }

    const payload = {
      id: tx.id || crearIdTransaccionD1_(tx),
      chat_id: String(tx.chatId),
      fecha: tx.fecha,
      hora: tx.hora,
      tipo: tx.tipo,
      desc: tx.desc,
      cat: String(tx.cat || 'otro').toLowerCase(),
      monto: Number(tx.monto),
      currency: normalizarMoneda_(tx.currency || tx.moneda) || 'PEN',
    };

    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/api/transactions/delete', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-admin-key': adminKey },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });

    const code = resp.getResponseCode();
    if (code < 200 || code >= 300) {
      Logger.log('Error eliminar D1 HTTP ' + code + ': ' + resp.getContentText());
      return false;
    }

    return true;
  } catch (err) {
    Logger.log('Error eliminarTransaccionD1: ' + err);
    return false;
  }
}

function clasificarCategoriaD1_(cat, desc, chatId) {
  try {
    const cleanCat = String(cat || 'otro');
    const cleanDesc = String(desc || '');
    const scopeChatId = String(chatId || PropertiesService.getScriptProperties().getProperty('dashboard_chat_id') || '');
    const cache = CacheService.getScriptCache();
    const cacheKey = 'cat_rule_' + Utilities.base64EncodeWebSafe([scopeChatId, cleanCat, cleanDesc].join('|')).slice(0, 150);
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const result = d1ApiRequest_('/api/rules/classify', {
      chat_id: scopeChatId,
      cat: cleanCat,
      desc: cleanDesc,
    });

    const category = result && result.ok ? String(result.category || '') : '';
    if (category) cache.put(cacheKey, category, 600);
    return category;
  } catch (err) {
    Logger.log('Regla categoria D1 omitida: ' + err);
    return '';
  }
}

function categoriasPresupuestoD1_(cat, chatId) {
  try {
    const cleanCat = String(cat || 'otro');
    const scopeChatId = String(chatId || PropertiesService.getScriptProperties().getProperty('dashboard_chat_id') || '');
    const cache = CacheService.getScriptCache();
    const cacheKey = 'budget_rule_v2_' + Utilities.base64EncodeWebSafe([scopeChatId, cleanCat].join('|')).slice(0, 150);
    const cached = cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const result = d1ApiRequest_('/api/rules/budget/keys', {
      chat_id: scopeChatId,
      category: cleanCat,
    });

    const keys = result && result.ok && result.keys ? result.keys : [];
    if (keys.length) cache.put(cacheKey, JSON.stringify(keys), 600);
    return keys;
  } catch (err) {
    Logger.log('Regla presupuesto D1 omitida: ' + err);
    return [];
  }
}

function listarReglasD1_(chatId) {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('d1_api_url');
  const adminKey = props.getProperty('d1_admin_key');
  if (!apiUrl || !adminKey) throw new Error('Faltan d1_api_url o d1_admin_key');

  const url = apiUrl.replace(/\/$/, '') + '/api/rules?chat_id=' + encodeURIComponent(String(chatId));
  const resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { 'x-admin-key': adminKey },
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const body = JSON.parse(resp.getContentText() || '{}');
  if (code < 200 || code >= 300 || body.ok === false) {
    throw new Error(body.error || ('HTTP ' + code));
  }

  return body;
}

function guardarReglaCategoriaD1_(chatId, keyword, category) {
  return d1ApiRequest_('/api/rules/category', {
    chat_id: String(chatId),
    keyword: keyword,
    category: category,
    priority: 200,
  });
}

function eliminarReglaCategoriaD1_(chatId, keyword) {
  return d1ApiRequest_('/api/rules/category/delete', {
    chat_id: String(chatId),
    keyword: keyword,
  });
}

function guardarReglaPresupuestoD1_(chatId, budgetCategory, includedCategory) {
  return d1ApiRequest_('/api/rules/budget', {
    chat_id: String(chatId),
    budget_category: budgetCategory,
    included_category: includedCategory,
  });
}

function eliminarReglaPresupuestoD1_(chatId, budgetCategory, includedCategory) {
  return d1ApiRequest_('/api/rules/budget/delete', {
    chat_id: String(chatId),
    budget_category: budgetCategory,
    included_category: includedCategory,
  });
}

function d1ApiRequest_(path, payload) {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('d1_api_url');
  const adminKey = props.getProperty('d1_admin_key');

  if (!apiUrl || !adminKey) {
    throw new Error('Faltan d1_api_url o d1_admin_key');
  }

  const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + path, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-admin-key': adminKey },
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const body = JSON.parse(resp.getContentText() || '{}');
  if (code < 200 || code >= 300 || body.ok === false) {
    throw new Error(body.error || ('HTTP ' + code));
  }

  return body;
}

function d1ApiGet_(path) {
  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('d1_api_url');
  const adminKey = props.getProperty('d1_admin_key');

  if (!apiUrl || !adminKey) {
    throw new Error('Faltan d1_api_url o d1_admin_key');
  }

  const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + path, {
    method: 'get',
    headers: { 'x-admin-key': adminKey },
    muteHttpExceptions: true,
  });

  const code = resp.getResponseCode();
  const body = JSON.parse(resp.getContentText() || '{}');
  if (code < 200 || code >= 300 || body.ok === false) {
    throw new Error(body.error || ('HTTP ' + code));
  }

  return body;
}

function leerDashboardD1_(chatId) {
  try {
    return d1ApiGet_('/api/dashboard?chat_id=' + encodeURIComponent(String(chatId)));
  } catch (err) {
    Logger.log('Dashboard D1 omitido: ' + err);
    return null;
  }
}

function leerTransaccionesD1_(chatId, limit) {
  try {
    const cleanLimit = Math.max(1, Math.min(Number(limit || 500), 500));
    const result = d1ApiGet_(
      '/api/transactions?chat_id=' + encodeURIComponent(String(chatId)) +
      '&limit=' + encodeURIComponent(String(cleanLimit))
    );
    return result && result.ok && result.transacciones ? result.transacciones : [];
  } catch (err) {
    Logger.log('Transacciones D1 omitidas: ' + err);
    return null;
  }
}

function cmdD1Estado(chatId) {
  if (!esAdminD1_(chatId)) {
    return sendMessage(chatId, 'No autorizado.');
  }

  const props = PropertiesService.getScriptProperties();
  const apiUrl = props.getProperty('d1_api_url');
  const adminKey = props.getProperty('d1_admin_key');

  if (!apiUrl || !adminKey) {
    return sendMessage(
      chatId,
      '⚠️ *D1 no está configurado*\n\nEnvia `d1 configurar` y luego registra un gasto de prueba.',
      true
    );
  }

  try {
    const resp = UrlFetchApp.fetch(apiUrl.replace(/\/$/, '') + '/health', {
      method: 'get',
      muteHttpExceptions: true,
    });
    const code = resp.getResponseCode();
    const body = JSON.parse(resp.getContentText() || '{}');

    return sendMessage(
      chatId,
      `✅ *D1 configurado*\n\n` +
      `Worker: HTTP ${code}\n` +
      `Transacciones en D1: ${body.transactions || 0}\n` +
      `Fijos en D1: ${body.fixedExpenses || 0}`,
      true
    );
  } catch (err) {
    return sendMessage(
      chatId,
      '⚠️ D1 está configurado, pero no pude conectar con el Worker.\n\n' + String(err),
      true
    );
  }
}

function cmdConfigurarD1(chatId) {
  if (!esAdminD1_(chatId)) {
    return sendMessage(chatId, 'No autorizado.');
  }

  configurarD1Worker();
  return sendMessage(
    chatId,
    '✅ *D1 configurado*\n\nAhora registra un gasto y luego pulsa *Actualizar* en el dashboard.',
    true
  );
}

function esAdminD1_(chatId) {
  const props = PropertiesService.getScriptProperties();
  const adminChatId = props.getProperty('dashboard_chat_id') || '1538086276';
  return String(chatId).trim() === String(adminChatId).trim();
}

function crearIdTransaccionD1_(tx) {
  return [
    'tx',
    tx.chatId,
    tx.fecha,
    tx.hora,
    tx.tipo,
    String(tx.cat || 'otro').toLowerCase(),
    Number(tx.monto),
    tx.desc,
  ].join(':').slice(0, 180);
}
