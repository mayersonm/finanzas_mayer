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

  const items = (rows.results || []).map(workItemShape);
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
  const id = String(payload.id || crypto.randomUUID?.() || `work:${chatId}:${Date.now()}`).slice(0, 180);

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

  const saved = await getWorkItem(env, chatId, cleanId);
  return { ok: true, item: workItemShape(saved) };
}

export async function reorderWorkItems(env, payload, params) {
  const chatId = getChatId(env, params);
  const items = Array.isArray(payload.items) ? payload.items : [];
  if (!items.length) return { ok: true, updated: 0 };

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

  await env.DB.batch(updates);
  return { ok: true, updated: updates.length };
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
  };
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
