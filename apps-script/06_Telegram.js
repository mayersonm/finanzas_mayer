
function sendMessage(chatId, text, markdown = false) {
  const url     = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
  const payload = {
    chat_id    : chatId,
    text       : text,
    parse_mode : markdown ? 'Markdown' : undefined,
  };
  UrlFetchApp.fetch(url, {
    method      : 'post',
    contentType : 'application/json',
    payload     : JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

// ---- NUEVA: enviar archivo por Telegram -----------
function sendDocument(chatId, blob) {
  const url = `https://api.telegram.org/bot${TOKEN}/sendDocument`;
  UrlFetchApp.fetch(url, {
    method             : 'post',
    payload            : { chat_id: chatId, document: blob },
    muteHttpExceptions : true
  });
}