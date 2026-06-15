import { httpError, safeJsonParse } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';

const STATUSES = new Set(['todo', 'in_progress', 'done']);
const PRIORITIES = new Set(['low', 'medium', 'high']);

export async function listWorkItems(env, params) {
  const chatId = getChatId(env, params);
  const rows = await env.DB.prepare(`
    SELECT id, title, description, notes, blockers, status, priority, due_date, tags, sort_order, created_at, updated_at
    FROM work_items
    WHERE chat_id = ? AND active = 1
    ORDER BY
      CASE status
        WHEN 'todo' THEN 1
        WHEN 'in_progress' THEN 2
        WHEN 'done' THEN 3
        ELSE 4
      END,
      sort_order ASC,
      updated_at DESC
  `).bind(chatId).all();

  const items = await attachTimeline(env, chatId, (rows.results || []).map(workItemShape));
  return {
    ok: true,
    items,
    summary: buildSummary(items),
    updatedAt: new Date().toISOString(),
  };
}

export async function createWorkItem(env, payload, params) {
  const chatId = getChatId(env, params);
  const item = normalizeWorkItem(payload, chatId);
  if (!item.title) throw httpError(400, 'Titulo requerido');

  const nextOrder = await nextSortOrder(env, chatId, item.status);
  const id = String(payload.id || makeId('work', chatId)).slice(0, 180);

  await env.DB.prepare(`
    INSERT INTO work_items (
      id, chat_id, title, description, notes, blockers, status, priority, due_date, tags, sort_order, active, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).bind(
    id,
    chatId,
    item.title,
    item.description,
    item.notes,
    item.blockers,
    item.status,
    item.priority,
    item.dueDate,
    JSON.stringify(item.tags),
    nextOrder,
  ).run();

  await insertTimelineEvent(env, {
    chatId,
    itemId: id,
    type: 'created',
    message: 'Apunte creado',
    eventDate: todayDate(),
  });

  const saved = await getWorkItem(env, chatId, id);
  return { ok: true, item: workItemShape(saved) };
}

export async function updateWorkItem(env, id, payload, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await getWorkItem(env, chatId, cleanId);
  if (!existing) throw httpError(404, 'Trabajo no encontrado');

  const current = workItemShape(existing);
  const normalized = normalizeWorkItem({ ...current, ...payload }, chatId);
  const sortOrder = Number.isFinite(Number(payload.sortOrder ?? payload.sort_order))
    ? Number(payload.sortOrder ?? payload.sort_order)
    : Number(existing.sort_order || 0);

  await env.DB.prepare(`
    UPDATE work_items
    SET title = ?,
        description = ?,
        notes = ?,
        blockers = ?,
        status = ?,
        priority = ?,
        due_date = ?,
        tags = ?,
        sort_order = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ? AND active = 1
  `).bind(
    normalized.title,
    normalized.description,
    normalized.notes,
    normalized.blockers,
    normalized.status,
    normalized.priority,
    normalized.dueDate,
    JSON.stringify(normalized.tags),
    sortOrder,
    cleanId,
    chatId,
  ).run();

  const event = describeUpdate(current, normalized);
  if (event) {
    await insertTimelineEvent(env, {
      chatId,
      itemId: cleanId,
      type: event.type,
      message: event.message,
      eventDate: todayDate(),
    });
  }

  const saved = await getWorkItem(env, chatId, cleanId);
  return { ok: true, item: workItemShape(saved) };
}

export async function reorderWorkItems(env, payload, params) {
  const chatId = getChatId(env, params);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { ok: true, updated: 0 };
  const ids = items.map((item) => String(item.id || '').trim()).filter(Boolean);
  const existingRows = ids.length ? await rowsByIds(env, chatId, ids) : [];
  const previousStatus = new Map(existingRows.map((row) => [row.id, normalizeStatus(row.status || 'todo')]));

  const updates = items.map((item, index) => {
    const id = String(item.id || '').trim();
    if (!id) throw httpError(400, 'id requerido');
    const status = normalizeStatus(item.status || 'todo');
    const sortOrder = Number.isFinite(Number(item.sortOrder ?? item.sort_order))
      ? Number(item.sortOrder ?? item.sort_order)
      : index + 1;
    return env.DB.prepare(`
      UPDATE work_items
      SET status = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND chat_id = ? AND active = 1
    `).bind(status, sortOrder, id, chatId);
  });

  const timelineUpdates = items
    .map((item) => {
      const id = String(item.id || '').trim();
      const status = normalizeStatus(item.status || 'todo');
      const previous = previousStatus.get(id);
      if (!previous || previous === status) return null;
      return timelineStatement(env, {
        chatId,
        itemId: id,
        type: 'status',
        message: `Movido de ${statusLabel(previous)} a ${statusLabel(status)}`,
        eventDate: todayDate(),
      });
    })
    .filter(Boolean);

  await env.DB.batch([...updates, ...timelineUpdates]);
  return { ok: true, updated: updates.length };
}

export async function addWorkItemTimelineEvent(env, id, payload, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await getWorkItem(env, chatId, cleanId);
  if (!existing) throw httpError(404, 'Trabajo no encontrado');

  const message = normalizeText(payload.message || payload.mensaje || payload.note || payload.nota || '', 900);
  if (!message) throw httpError(400, 'Mensaje requerido');

  const eventDate = normalizeDate(payload.eventDate || payload.event_date || payload.fecha || '') || todayDate();
  const event = {
    chatId,
    itemId: cleanId,
    type: normalizeText(payload.type || payload.tipo || 'note', 40) || 'note',
    message,
    eventDate,
  };
  await insertTimelineEvent(env, event);
  const saved = await latestTimelineEvent(env, chatId, cleanId);
  return { ok: true, event: timelineEventShape(saved) };
}

export async function deleteWorkItem(env, id, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  await env.DB.prepare(`
    UPDATE work_items
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).run();

  return { ok: true, deleted: true, id: cleanId };
}

async function getWorkItem(env, chatId, id) {
  return env.DB.prepare(`
    SELECT id, title, description, notes, blockers, status, priority, due_date, tags, sort_order, created_at, updated_at
    FROM work_items
    WHERE id = ? AND chat_id = ? AND active = 1
  `).bind(id, chatId).first();
}

async function rowsByIds(env, chatId, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(`
    SELECT id, status
    FROM work_items
    WHERE chat_id = ? AND active = 1 AND id IN (${placeholders})
  `).bind(chatId, ...ids).all();
  return rows.results || [];
}

async function attachTimeline(env, chatId, items) {
  if (!items.length) return items;
  const ids = items.map((item) => item.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await env.DB.prepare(`
    SELECT id, work_item_id, type, message, event_date, created_at
    FROM work_item_timeline
    WHERE chat_id = ? AND work_item_id IN (${placeholders})
    ORDER BY event_date DESC, created_at DESC
    LIMIT 300
  `).bind(chatId, ...ids).all();

  const timelineByItem = new Map();
  for (const row of rows.results || []) {
    const itemId = row.work_item_id;
    const current = timelineByItem.get(itemId) || [];
    if (current.length < 8) current.push(timelineEventShape(row));
    timelineByItem.set(itemId, current);
  }

  return items.map((item) => ({
    ...item,
    timeline: timelineByItem.get(item.id) || fallbackTimeline(item),
  }));
}

async function latestTimelineEvent(env, chatId, itemId) {
  return env.DB.prepare(`
    SELECT id, work_item_id, type, message, event_date, created_at
    FROM work_item_timeline
    WHERE chat_id = ? AND work_item_id = ?
    ORDER BY event_date DESC, created_at DESC
    LIMIT 1
  `).bind(chatId, itemId).first();
}

async function insertTimelineEvent(env, event) {
  await timelineStatement(env, event).run();
}

function timelineStatement(env, event) {
  return env.DB.prepare(`
    INSERT INTO work_item_timeline (id, chat_id, work_item_id, type, message, event_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    makeId('work_event', event.chatId),
    event.chatId,
    event.itemId,
    event.type || 'note',
    event.message,
    event.eventDate || todayDate(),
  );
}

async function nextSortOrder(env, chatId, status) {
  const row = await env.DB.prepare(`
    SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order
    FROM work_items
    WHERE chat_id = ? AND status = ? AND active = 1
  `).bind(chatId, status).first();
  return Number(row?.next_order || 1);
}

function normalizeWorkItem(raw, _chatId) {
  return {
    title: normalizeText(raw.title || raw.titulo || '', 140),
    description: normalizeText(raw.description || raw.descripcion || '', 520),
    notes: normalizeText(raw.notes || raw.notas || '', 1200),
    blockers: normalizeText(raw.blockers || raw.bloqueantes || '', 800),
    status: normalizeStatus(raw.status || raw.estado || 'todo'),
    priority: normalizePriority(raw.priority || raw.prioridad || 'medium'),
    dueDate: normalizeDate(raw.dueDate || raw.due_date || raw.fechaObjetivo || ''),
    tags: normalizeTags(raw.tags || raw.etiquetas || []),
  };
}

function workItemShape(row) {
  const tags = Array.isArray(row.tags) ? row.tags : safeJsonParse(row.tags, []);
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    notes: row.notes || '',
    blockers: row.blockers || '',
    status: normalizeStatus(row.status || 'todo'),
    priority: normalizePriority(row.priority || 'medium'),
    dueDate: row.due_date || row.dueDate || '',
    tags: normalizeTags(tags),
    sortOrder: Number(row.sort_order || row.sortOrder || 0),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
    timeline: row.timeline || [],
  };
}

function timelineEventShape(row) {
  return {
    id: row.id,
    itemId: row.work_item_id || row.itemId || '',
    type: row.type || 'note',
    message: row.message || '',
    eventDate: row.event_date || row.eventDate || todayDate(),
    createdAt: row.created_at || row.createdAt || '',
  };
}

function fallbackTimeline(item) {
  const events = [];
  if (item.updatedAt) {
    events.push({
      id: `${item.id}:updated`,
      itemId: item.id,
      type: 'updated',
      message: 'Ultima actualizacion',
      eventDate: isoToDate(item.updatedAt),
      createdAt: item.updatedAt,
    });
  }
  if (item.createdAt) {
    events.push({
      id: `${item.id}:created`,
      itemId: item.id,
      type: 'created',
      message: 'Apunte creado',
      eventDate: isoToDate(item.createdAt),
      createdAt: item.createdAt,
    });
  }
  return events;
}

function buildSummary(items) {
  return items.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    if (item.blockers) acc.blocked += 1;
    if (item.priority === 'high') acc.highPriority += 1;
    return acc;
  }, { total: 0, todo: 0, in_progress: 0, done: 0, blocked: 0, highPriority: 0 });
}

function normalizeStatus(value) {
  const clean = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  return STATUSES.has(clean) ? clean : 'todo';
}

function normalizePriority(value) {
  const clean = String(value || '').trim().toLowerCase();
  return PRIORITIES.has(clean) ? clean : 'medium';
}

function normalizeText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function normalizeDate(value) {
  const clean = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : '';
}

function normalizeTags(value) {
  const list = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  return Array.from(new Set(
    list
      .map((tag) => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8),
  ));
}

function describeUpdate(current, next) {
  if (current.status !== next.status) {
    return {
      type: 'status',
      message: `Cambio de ${statusLabel(current.status)} a ${statusLabel(next.status)}`,
    };
  }

  if ((current.blockers || '') !== (next.blockers || '')) {
    return {
      type: next.blockers ? 'blocker' : 'unblocked',
      message: next.blockers ? 'Bloqueante actualizado' : 'Bloqueante resuelto',
    };
  }

  if ((current.notes || '') !== (next.notes || '')) {
    return { type: 'notes', message: 'Notas actualizadas' };
  }

  if ((current.dueDate || '') !== (next.dueDate || '')) {
    return { type: 'due_date', message: next.dueDate ? `Fecha objetivo ${next.dueDate}` : 'Fecha objetivo retirada' };
  }

  return { type: 'updated', message: 'Apunte actualizado' };
}

function statusLabel(status) {
  if (status === 'in_progress') return 'En progreso';
  if (status === 'done') return 'Done';
  return 'Todo';
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function isoToDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return todayDate();
  return date.toISOString().slice(0, 10);
}

function makeId(prefix, chatId) {
  const random = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}:${Math.random()}`;
  return `${prefix}:${chatId}:${random}`;
}
