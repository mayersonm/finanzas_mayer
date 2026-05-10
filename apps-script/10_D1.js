// ---- CLOUDFLARE D1 -----------------------------------------
// Escritura doble: Sheets sigue como respaldo y D1 recibe la copia principal.
//
// Script Properties:
//   d1_api_url   = https://tu-worker.workers.dev
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

    return true;
  } catch (err) {
    Logger.log('Error guardarTransaccionD1: ' + err);
    return false;
  }
}

function crearIdTransaccionD1_(tx) {
  const raw = [
    tx.chatId,
    tx.fecha,
    tx.hora,
    tx.tipo,
    tx.cat,
    tx.monto,
    tx.desc,
    tx.source || 'telegram',
  ].join('|');

  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    raw,
    Utilities.Charset.UTF_8
  );

  return 'tx_' + digest
    .map(function (byte) {
      const value = byte < 0 ? byte + 256 : byte;
      return value.toString(16).padStart(2, '0');
    })
    .join('')
    .slice(0, 32);
}
