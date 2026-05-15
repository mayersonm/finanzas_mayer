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
