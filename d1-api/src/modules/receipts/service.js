import { corsResponse, httpError } from '../../shared/http.js';
import { parseAmount } from '../../shared/money.js';
import { normalizeCurrency } from '../../shared/normalizers.js';
import { classifyCategory } from '../../shared/categories.js';
import { formatMonth } from '../../shared/dates.js';
import { sha256Hex } from '../../shared/crypto.js';
import { cleanBase64, base64ToBytes, imageExtension, normalizeImageContentType, safeFileName, safeHeaderFileName, safeObjectSegment } from '../../shared/files.js';

export async function uploadReceipt(env, payload) {
  const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
  const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
  const imageBase64 = String(payload.image_base64 || payload.imageBase64 || '').trim();
  const contentType = normalizeImageContentType(payload.content_type || payload.contentType || payload.mimeType);
  const fileName = safeFileName(payload.file_name || payload.fileName || `recibo.${imageExtension(contentType)}`);

  if (!chatId) throw httpError(400, 'chat_id requerido');
  if (!transactionId) throw httpError(400, 'transaction_id requerido');
  if (!imageBase64) throw httpError(400, 'image_base64 requerido');

  const cleanedBase64 = cleanBase64(imageBase64);
  const bytes = base64ToBytes(cleanedBase64);
  if (!bytes.byteLength) throw httpError(400, 'Imagen vacia');
  if (bytes.byteLength > 10 * 1024 * 1024) throw httpError(413, 'Imagen demasiado grande');

  const txDate = String(payload.fecha || payload.tx_date || '').slice(0, 10);
  const txTime = String(payload.hora || payload.tx_time || '').slice(0, 5);
  const type = String(payload.tipo || payload.type || 'gasto').toLowerCase() === 'ingreso' ? 'ingreso' : 'gasto';
  const description = String(payload.desc || payload.description || '').trim();
  const category = (await classifyCategory(env, chatId, payload.cat || payload.category || 'otro', description)).category;
  const amount = parseAmount(payload.monto || payload.amount || 0);
  const receiptId = String(payload.id || `receipt_${(await sha256Hex(`${chatId}|${transactionId}|${fileName}`)).slice(0, 32)}`).slice(0, 180);
  const month = txDate.slice(0, 7) || formatMonth(new Date());
  const r2Key = `receipts/${safeObjectSegment(chatId)}/${month}/${safeObjectSegment(receiptId)}.${imageExtension(contentType)}`;
  let storage = 'd1';
  let storedR2Key = null;
  let storedBase64 = cleanedBase64;
  let storageWarning = '';

  if (env.RECEIPTS_BUCKET) {
    try {
      await env.RECEIPTS_BUCKET.put(r2Key, bytes, {
        httpMetadata: {
          contentType,
        },
        customMetadata: {
          chat_id: chatId,
          transaction_id: transactionId,
        },
      });
      storage = 'r2';
      storedR2Key = r2Key;
      storedBase64 = null;
    } catch (error) {
      storageWarning = `R2 no disponible, guardado en D1: ${error.message || String(error)}`;
      await logReceiptError(env, {
        ...payload,
        id: receiptId,
        chat_id: chatId,
        transaction_id: transactionId,
        file_name: fileName,
        content_type: contentType,
        size: bytes.byteLength,
        r2_key: r2Key,
      }, 'r2_put', error);
    }
  }

  await env.DB.prepare(`
    INSERT INTO receipts (
      id, transaction_id, chat_id, storage, r2_key, image_base64, file_name, content_type, size,
      telegram_file_id, telegram_file_path, tx_date, tx_time, type,
      description, category, amount, currency, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(transaction_id) DO UPDATE SET
      storage = excluded.storage,
      r2_key = excluded.r2_key,
      image_base64 = excluded.image_base64,
      file_name = excluded.file_name,
      content_type = excluded.content_type,
      size = excluded.size,
      telegram_file_id = excluded.telegram_file_id,
      telegram_file_path = excluded.telegram_file_path,
      tx_date = excluded.tx_date,
      tx_time = excluded.tx_time,
      type = excluded.type,
      description = excluded.description,
      category = excluded.category,
      amount = excluded.amount,
      currency = excluded.currency,
      updated_at = CURRENT_TIMESTAMP
  `).bind(
    receiptId,
    transactionId,
    chatId,
    storage,
    storedR2Key,
    storedBase64,
    fileName,
    contentType,
    bytes.byteLength,
    String(payload.telegram_file_id || payload.telegramFileId || ''),
    String(payload.telegram_file_path || payload.telegramFilePath || ''),
    txDate,
    txTime,
    type,
    description,
    category,
    amount || null,
    normalizeCurrency(payload.currency || payload.moneda),
  ).run();

  return {
    ok: true,
    receipt: {
      id: receiptId,
      transactionId,
      fileName,
      contentType,
      size: bytes.byteLength,
      storage,
      warning: storageWarning,
    },
  };
}

export async function logReceiptError(env, payload = {}, stage = 'unknown', error = null, extra = {}) {
  try {
    if (!env.DB) return;

    const chatId = String(payload.chat_id || payload.chatId || env.DEFAULT_CHAT_ID || '').trim();
    const transactionId = String(payload.transaction_id || payload.transactionId || '').trim();
    const receiptId = String(payload.id || payload.receipt_id || payload.receiptId || '').trim();
    const message = error instanceof Error
      ? error.message
      : String(error || 'Error desconocido');
    const details = {
      stage,
      name: error?.name || '',
      status: error?.status || '',
      stack: error?.stack ? String(error.stack).slice(0, 1200) : '',
      fileName: payload.file_name || payload.fileName || '',
      contentType: payload.content_type || payload.contentType || payload.mimeType || '',
      size: payload.size || '',
      telegramFileId: payload.telegram_file_id || payload.telegramFileId || '',
      telegramFilePath: payload.telegram_file_path || payload.telegramFilePath || '',
      r2Key: payload.r2_key || payload.r2Key || '',
      extra,
    };
    const id = `receipt_error:${Date.now()}:${crypto.randomUUID()}`.slice(0, 180);

    await env.DB.prepare(`
      INSERT INTO receipt_error_logs (
        id, chat_id, transaction_id, receipt_id, stage, message, details_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(
      id,
      chatId,
      transactionId,
      receiptId,
      String(stage || 'unknown').slice(0, 80),
      message.slice(0, 1000),
      JSON.stringify(details),
    ).run();
  } catch (_ignored) {
    // El log nunca debe romper el registro del recibo.
  }
}

export async function receiptFile(env, receiptId) {
  const row = await env.DB.prepare(`
    SELECT storage, r2_key, image_base64, file_name, content_type
    FROM receipts
    WHERE id = ?
  `).bind(receiptId).first();

  if (!row) throw httpError(404, 'Recibo no encontrado');

  if (row.storage === 'r2') {
    if (!env.RECEIPTS_BUCKET) throw httpError(500, 'RECEIPTS_BUCKET no configurado');

    const object = await env.RECEIPTS_BUCKET.get(row.r2_key);
    if (!object) throw httpError(404, 'Archivo no encontrado');

    return corsResponse(object.body, 200, {
      'content-type': row.content_type || 'application/octet-stream',
      'cache-control': 'private, max-age=60',
      'content-disposition': `inline; filename="${safeHeaderFileName(row.file_name || 'recibo')}"`,
    });
  }

  if (!row.image_base64) throw httpError(404, 'Imagen no disponible');

  return corsResponse(base64ToBytes(row.image_base64), 200, {
    'content-type': row.content_type || 'application/octet-stream',
    'cache-control': 'private, max-age=60',
    'content-disposition': `inline; filename="${safeHeaderFileName(row.file_name || 'recibo')}"`,
  });
}
