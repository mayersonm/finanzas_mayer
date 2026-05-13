// ---- WEBHOOK: recibe mensajes de Telegram ------------------ \\



function doPost(e) {
  const lock = LockService.getScriptLock();

  try {
    lock.tryLock(500);

    const update   = JSON.parse(e.postData.contents);
    const updateId = String(update.update_id);
    const cache    = CacheService.getScriptCache();

    if (cache.get(updateId)) {
      Logger.log('Duplicado ignorado: ' + updateId);
      return ok();
    }

    cache.put(updateId, '1', 21600);

    const msg = update.message || update.edited_message;
    if (!msg) return ok(); // ← solo bloquea si no hay mensaje, ya no bloquea fotos

    const chatId = String(msg.chat.id);

    // ── Foto de recibo ───────────────────────────────────
    if (msg.photo) {
      procesarFotoRecibo(chatId, msg);
      return ok();
    }

    // ── Texto normal ─────────────────────────────────────
    if (msg.text) {
      handleMessage(chatId, msg.text.trim());
    }

  } catch (err) {
    Logger.log('Error en doPost: ' + err);
  } finally {
    try { lock.releaseLock(); } catch(e) {}
  }

  return ok();
}


function doGet(e) {
  if (e && e.parameter && e.parameter.action) {
    return handleDashboardApi(e);
  }

  return ContentService.createTextOutput('BOT ACTIVO');
}


function ok() {
  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}
