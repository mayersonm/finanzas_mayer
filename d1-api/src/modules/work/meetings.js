import { httpError, safeJsonParse } from '../../shared/http.js';
import { getChatId } from '../../shared/request.js';

const MEETING_STATUSES = new Set(['scheduled', 'completed', 'cancelled']);
const FOLLOWUP_STATUSES = new Set(['open', 'done', 'cancelled']);
const PRIORITIES = new Set(['low', 'medium', 'high']);

export async function listWorkMeetings(env, params) {
  const chatId = getChatId(env, params);
  const rows = await env.DB.prepare(`
    SELECT id, title, meeting_date, start_time, participants, agenda, notes, outcome, status, tags, created_at, updated_at
    FROM work_meetings
    WHERE chat_id = ? AND active = 1
    ORDER BY meeting_date DESC, start_time DESC, updated_at DESC
  `).bind(chatId).all();

  const meetings = (rows.results || []).map(meetingShape);
  const followups = await listFollowupsForChat(env, chatId);
  const followupsByMeeting = groupFollowupsByMeeting(followups);

  const items = meetings.map((meeting) => ({
    ...meeting,
    followups: followupsByMeeting.get(meeting.id) || [],
  }));

  return {
    ok: true,
    meetings: items,
    followups,
    summary: buildMeetingsSummary(items, followups),
    updatedAt: new Date().toISOString(),
  };
}

export async function createWorkMeeting(env, payload, params) {
  const chatId = getChatId(env, params);
  const meeting = normalizeMeeting(payload);
  if (!meeting.title) throw httpError(400, 'Titulo requerido');
  if (!meeting.meetingDate) throw httpError(400, 'Fecha requerida');

  const id = String(payload.id || makeId('meeting', chatId)).slice(0, 180);

  await env.DB.prepare(`
    INSERT INTO work_meetings (
      id, chat_id, title, meeting_date, start_time, participants, agenda, notes, outcome, status, tags, active, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).bind(
    id,
    chatId,
    meeting.title,
    meeting.meetingDate,
    meeting.startTime,
    meeting.participants,
    meeting.agenda,
    meeting.notes,
    meeting.outcome,
    meeting.status,
    JSON.stringify(meeting.tags),
  ).run();

  const saved = await getMeeting(env, chatId, id);
  return { ok: true, meeting: { ...meetingShape(saved), followups: [] } };
}

export async function updateWorkMeeting(env, id, payload, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await getMeeting(env, chatId, cleanId);
  if (!existing) throw httpError(404, 'Reunion no encontrada');

  const current = meetingShape(existing);
  const normalized = normalizeMeeting({ ...current, ...payload });

  await env.DB.prepare(`
    UPDATE work_meetings
    SET title = ?,
        meeting_date = ?,
        start_time = ?,
        participants = ?,
        agenda = ?,
        notes = ?,
        outcome = ?,
        status = ?,
        tags = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ? AND active = 1
  `).bind(
    normalized.title,
    normalized.meetingDate,
    normalized.startTime,
    normalized.participants,
    normalized.agenda,
    normalized.notes,
    normalized.outcome,
    normalized.status,
    JSON.stringify(normalized.tags),
    cleanId,
    chatId,
  ).run();

  const saved = await getMeeting(env, chatId, cleanId);
  const followups = await listFollowupsForMeeting(env, chatId, cleanId);
  return { ok: true, meeting: { ...meetingShape(saved), followups } };
}

export async function deleteWorkMeeting(env, id, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  await env.DB.batch([
    env.DB.prepare(`
      UPDATE work_meetings
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND chat_id = ?
    `).bind(cleanId, chatId),
    env.DB.prepare(`
      UPDATE work_followups
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE meeting_id = ? AND chat_id = ?
    `).bind(cleanId, chatId),
  ]);

  return { ok: true, deleted: true, id: cleanId };
}

export async function createWorkFollowup(env, payload, params) {
  const chatId = getChatId(env, params);
  const followup = normalizeFollowup(payload);
  if (!followup.title) throw httpError(400, 'Titulo requerido');

  const meetingId = normalizeOptionalId(payload.meetingId || payload.meeting_id);
  if (meetingId) {
    const meeting = await getMeeting(env, chatId, meetingId);
    if (!meeting) throw httpError(404, 'Reunion no encontrada');
  }

  const id = String(payload.id || makeId('followup', chatId)).slice(0, 180);

  await env.DB.prepare(`
    INSERT INTO work_followups (
      id, chat_id, meeting_id, title, description, person, due_date, status, priority, active, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `).bind(
    id,
    chatId,
    meetingId,
    followup.title,
    followup.description,
    followup.person,
    followup.dueDate,
    followup.status,
    followup.priority,
  ).run();

  const saved = await getFollowup(env, chatId, id);
  return { ok: true, followup: followupShape(saved) };
}

export async function updateWorkFollowup(env, id, payload, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  const existing = await getFollowup(env, chatId, cleanId);
  if (!existing) throw httpError(404, 'Seguimiento no encontrado');

  const current = followupShape(existing);
  const normalized = normalizeFollowup({ ...current, ...payload });
  const meetingId = payload.meetingId !== undefined || payload.meeting_id !== undefined
    ? normalizeOptionalId(payload.meetingId ?? payload.meeting_id)
    : current.meetingId;

  if (meetingId) {
    const meeting = await getMeeting(env, chatId, meetingId);
    if (!meeting) throw httpError(404, 'Reunion no encontrada');
  }

  await env.DB.prepare(`
    UPDATE work_followups
    SET meeting_id = ?,
        title = ?,
        description = ?,
        person = ?,
        due_date = ?,
        status = ?,
        priority = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ? AND active = 1
  `).bind(
    meetingId,
    normalized.title,
    normalized.description,
    normalized.person,
    normalized.dueDate,
    normalized.status,
    normalized.priority,
    cleanId,
    chatId,
  ).run();

  const saved = await getFollowup(env, chatId, cleanId);
  return { ok: true, followup: followupShape(saved) };
}

export async function deleteWorkFollowup(env, id, params) {
  const chatId = getChatId(env, params);
  const cleanId = String(id || '').trim();
  if (!cleanId) throw httpError(400, 'id requerido');

  await env.DB.prepare(`
    UPDATE work_followups
    SET active = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND chat_id = ?
  `).bind(cleanId, chatId).run();

  return { ok: true, deleted: true, id: cleanId };
}

async function getMeeting(env, chatId, id) {
  return env.DB.prepare(`
    SELECT id, title, meeting_date, start_time, participants, agenda, notes, outcome, status, tags, created_at, updated_at
    FROM work_meetings
    WHERE id = ? AND chat_id = ? AND active = 1
  `).bind(id, chatId).first();
}

async function getFollowup(env, chatId, id) {
  return env.DB.prepare(`
    SELECT id, meeting_id, title, description, person, due_date, status, priority, created_at, updated_at
    FROM work_followups
    WHERE id = ? AND chat_id = ? AND active = 1
  `).bind(id, chatId).first();
}

async function listFollowupsForChat(env, chatId) {
  const rows = await env.DB.prepare(`
    SELECT id, meeting_id, title, description, person, due_date, status, priority, created_at, updated_at
    FROM work_followups
    WHERE chat_id = ? AND active = 1
    ORDER BY
      CASE status WHEN 'open' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
      due_date ASC,
      updated_at DESC
  `).bind(chatId).all();
  return (rows.results || []).map(followupShape);
}

async function listFollowupsForMeeting(env, chatId, meetingId) {
  const rows = await env.DB.prepare(`
    SELECT id, meeting_id, title, description, person, due_date, status, priority, created_at, updated_at
    FROM work_followups
    WHERE chat_id = ? AND meeting_id = ? AND active = 1
    ORDER BY
      CASE status WHEN 'open' THEN 1 WHEN 'done' THEN 2 ELSE 3 END,
      due_date ASC,
      updated_at DESC
  `).bind(chatId, meetingId).all();
  return (rows.results || []).map(followupShape);
}

function groupFollowupsByMeeting(followups) {
  const map = new Map();
  for (const followup of followups) {
    if (!followup.meetingId) continue;
    const current = map.get(followup.meetingId) || [];
    current.push(followup);
    map.set(followup.meetingId, current);
  }
  return map;
}

function buildMeetingsSummary(meetings, followups) {
  const today = todayDate();
  const openFollowups = followups.filter((item) => item.status === 'open');
  const overdueFollowups = openFollowups.filter((item) => item.dueDate && item.dueDate < today);
  const upcomingMeetings = meetings.filter((item) => item.status === 'scheduled' && item.meetingDate >= today);

  return {
    totalMeetings: meetings.length,
    upcomingMeetings: upcomingMeetings.length,
    openFollowups: openFollowups.length,
    overdueFollowups: overdueFollowups.length,
    completedMeetings: meetings.filter((item) => item.status === 'completed').length,
  };
}

function normalizeMeeting(raw) {
  return {
    title: normalizeText(raw.title || raw.titulo || '', 160),
    meetingDate: normalizeDate(raw.meetingDate || raw.meeting_date || raw.fecha || '') || todayDate(),
    startTime: normalizeTime(raw.startTime || raw.start_time || raw.hora || ''),
    participants: normalizeText(raw.participants || raw.participantes || '', 600),
    agenda: normalizeText(raw.agenda || '', 1200),
    notes: normalizeText(raw.notes || raw.notas || '', 2000),
    outcome: normalizeText(raw.outcome || raw.resultado || raw.acuerdos || '', 2000),
    status: normalizeMeetingStatus(raw.status || raw.estado || 'scheduled'),
    tags: normalizeTags(raw.tags || raw.etiquetas || []),
  };
}

function normalizeFollowup(raw) {
  return {
    title: normalizeText(raw.title || raw.titulo || '', 160),
    description: normalizeText(raw.description || raw.descripcion || '', 900),
    person: normalizeText(raw.person || raw.persona || raw.responsable || '', 120),
    dueDate: normalizeDate(raw.dueDate || raw.due_date || raw.fecha || ''),
    status: normalizeFollowupStatus(raw.status || raw.estado || 'open'),
    priority: normalizePriority(raw.priority || raw.prioridad || 'medium'),
  };
}

function meetingShape(row) {
  const tags = Array.isArray(row.tags) ? row.tags : safeJsonParse(row.tags, []);
  return {
    id: row.id,
    title: row.title || '',
    meetingDate: row.meeting_date || row.meetingDate || '',
    startTime: row.start_time || row.startTime || '',
    participants: row.participants || '',
    agenda: row.agenda || '',
    notes: row.notes || '',
    outcome: row.outcome || '',
    status: normalizeMeetingStatus(row.status || 'scheduled'),
    tags: normalizeTags(tags),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

function followupShape(row) {
  return {
    id: row.id,
    meetingId: row.meeting_id || row.meetingId || '',
    title: row.title || '',
    description: row.description || '',
    person: row.person || '',
    dueDate: row.due_date || row.dueDate || '',
    status: normalizeFollowupStatus(row.status || 'open'),
    priority: normalizePriority(row.priority || 'medium'),
    createdAt: row.created_at || row.createdAt || '',
    updatedAt: row.updated_at || row.updatedAt || '',
  };
}

function normalizeMeetingStatus(value) {
  const clean = String(value || '').trim().toLowerCase();
  return MEETING_STATUSES.has(clean) ? clean : 'scheduled';
}

function normalizeFollowupStatus(value) {
  const clean = String(value || '').trim().toLowerCase();
  return FOLLOWUP_STATUSES.has(clean) ? clean : 'open';
}

function normalizePriority(value) {
  const clean = String(value || '').trim().toLowerCase();
  return PRIORITIES.has(clean) ? clean : 'medium';
}

function normalizeOptionalId(value) {
  const clean = String(value || '').trim();
  return clean || '';
}

function normalizeText(value, max) {
  return String(value || '').trim().slice(0, max);
}

function normalizeDate(value) {
  const clean = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : '';
}

function normalizeTime(value) {
  const clean = String(value || '').trim();
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(clean) ? clean : '';
}

function normalizeTags(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return Array.from(new Set(
    list
      .map((tag) => String(tag || '').trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 8),
  ));
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function makeId(prefix, chatId) {
  const random = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now()}:${Math.random()}`;
  return `${prefix}:${chatId}:${random}`;
}
