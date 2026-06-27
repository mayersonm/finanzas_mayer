import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import { RiAddLine, RiCloseLine, RiSave3Line } from '@remixicon/react';
import { apiRequest } from '../../../app/apiClient';
import type { WorkItem, WorkPriority, WorkStatus, WorkSummary } from '../../../types/dashboard';
import { WorkNoteDetail } from './WorkNoteDetail';

interface Draft {
  id?: string;
  title: string;
  description: string;
  notes: string;
  blockers: string;
  status: WorkStatus;
  priority: WorkPriority;
  dueDate: string;
  tags: string;
}

interface TimelineDraft {
  date: string;
  message: string;
}

type WorkResponse = {
  ok?: boolean;
  items?: WorkItem[];
  summary?: WorkSummary;
  error?: string;
};

const columns: Array<{ id: WorkStatus; title: string; subtitle: string; tone: 'slate' | 'amber' | 'emerald' }> = [
  { id: 'todo', title: 'Pendientes', subtitle: 'Nuevas notas por trabajar', tone: 'slate' },
  { id: 'in_progress', title: 'En progreso', subtitle: 'Notas en desarrollo', tone: 'amber' },
  { id: 'done', title: 'Completadas', subtitle: 'Notas terminadas', tone: 'emerald' },
];

const priorityLabels: Record<WorkPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const emptyDraft: Draft = {
  title: '',
  description: '',
  notes: '',
  blockers: '',
  status: 'todo',
  priority: 'medium',
  dueDate: '',
  tags: '',
};

export function WorkSection({ authToken, chatId }: { authToken?: string | null; chatId?: string }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [summary, setSummary] = useState<WorkSummary>({ total: 0, todo: 0, in_progress: 0, done: 0, blocked: 0, highPriority: 0 });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<'board' | 'detail'>('board');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [selectedDetailId, setSelectedDetailId] = useState('');
  const [timelineDraft, setTimelineDraft] = useState<TimelineDraft>(() => ({ date: todayInputDate(), message: '' }));
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [draggingId, setDraggingId] = useState('');
  const [dropTarget, setDropTarget] = useState<WorkStatus | ''>('');

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');

    try {
      const result = await apiRequest<WorkResponse>('work-items', { token: authToken, query: { chat_id: chatId } });
      const nextItems = normalizeItems(result.items || []);
      setItems(nextItems);
      setSummary(result.summary || summarize(nextItems));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar Mi Trabajo');
    } finally {
      setLoading(false);
    }
  }, [authToken, chatId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedDetailId && items.length > 0) {
      setSelectedDetailId(items[0].id);
    }
  }, [items, selectedDetailId]);

  const boardItems = useMemo(() => {
    return columns.reduce((acc, column) => {
      acc[column.id] = items
        .filter((item) => item.status === column.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
      return acc;
    }, {} as Record<WorkStatus, WorkItem[]>);
  }, [items]);

  const persistOrder = useCallback(async (nextItems: WorkItem[]) => {
    if (!authToken) return;
    try {
      await apiRequest('work-items/reorder', {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: { items: nextItems.map((item) => ({ id: item.id, status: item.status, sortOrder: item.sortOrder })) },
      });
    } catch {
      // ignore persist errors to keep UI responsive
    }
  }, [authToken, chatId]);

  const moveItem = useCallback(async (targetStatus: WorkStatus, beforeId?: string) => {
    if (!draggingId) return;
    const dragged = items.find((item) => item.id === draggingId);
    if (!dragged) return;

    const nextItems = items.map((item) => ({ ...item }));
    const withinTarget = nextItems.filter((item) => item.status === targetStatus && item.id !== draggingId);
    const targetIndex = beforeId ? withinTarget.findIndex((item) => item.id === beforeId) : withinTarget.length;

    const reorderedTarget = [
      ...withinTarget.slice(0, targetIndex),
      { ...dragged, status: targetStatus },
      ...withinTarget.slice(targetIndex),
    ];

    const ordered = nextItems
      .filter((item) => item.id !== draggingId && item.status !== targetStatus)
      .concat(reorderedTarget)
      .map((item) => ({ ...item, sortOrder: item.status === targetStatus ? reorderedTarget.findIndex((row) => row.id === item.id) : item.sortOrder }));

    setItems(ordered);
    setSummary(summarize(ordered));
    setDraggingId('');
    setDropTarget('');
    await persistOrder(ordered);
  }, [draggingId, items, persistOrder]);

  // Cambio de estado directo desde la tarjeta (funciona en tactil, a diferencia
  // del drag & drop). Manda el item al final de la columna destino.
  const changeStatus = useCallback(async (item: WorkItem, targetStatus: WorkStatus) => {
    if (item.status === targetStatus) return;
    const others = items.filter((row) => row.id !== item.id);
    const targetCount = others.filter((row) => row.status === targetStatus).length;
    const ordered = others.concat({ ...item, status: targetStatus, sortOrder: targetCount });
    setItems(ordered);
    setSummary(summarize(ordered));
    await persistOrder(ordered);
  }, [items, persistOrder]);

  const startEdit = (item: WorkItem) => {
    setDraft({
      id: item.id,
      title: item.title,
      description: item.description || '',
      notes: item.notes || '',
      blockers: item.blockers || '',
      status: item.status,
      priority: item.priority,
      dueDate: item.dueDate || '',
      tags: (item.tags || []).join(', '),
    });
    setShowForm(true);
    setMessage('');
    setError('');
    setTimelineDraft({ date: todayInputDate(), message: '' });
  };

  const startNew = () => {
    setDraft(emptyDraft);
    setTimelineDraft({ date: todayInputDate(), message: '' });
    setMessage('');
    setError('');
    setShowForm(true);
  };

  const openDetails = (item: WorkItem) => {
    setSelectedDetailId(item.id);
    setMode('detail');
    setMessage('');
    setError('');
  };

  const resetDraft = () => {
    setDraft(emptyDraft);
    setTimelineDraft({ date: todayInputDate(), message: '' });
    setMessage('');
    setError('');
    setShowForm(false);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = draftToPayload(draft, chatId);
      const result = await apiRequest<{ item?: WorkItem }>(draft.id ? `work-items/${encodeURIComponent(draft.id)}` : 'work-items', {
        method: draft.id ? 'PATCH' : 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: payload,
      });

      setMessage(draft.id ? 'Apunte actualizado.' : 'Apunte guardado.');
      setDraft(emptyDraft);
      setShowForm(false);
      if (result.item?.id) setSelectedDetailId(result.item.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el apunte');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item: WorkItem) => {
    if (!authToken) return;
    const ok = window.confirm(`Eliminar "${item.title}"?`);
    if (!ok) return;

    setSaving(true);
    setMessage('');
    setError('');
    try {
      await apiRequest(`work-items/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        token: authToken,
        query: { chat_id: chatId },
      });
      const nextItems = items.filter((row) => row.id !== item.id);
      setItems(nextItems);
      setSummary(summarize(nextItems));
      if (selectedDetailId === item.id) setSelectedDetailId('');
      setMessage('Apunte eliminado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  };

  const addTimelineNote = async () => {
    if (!authToken || !draft.id || !timelineDraft.message.trim()) return;
    setSavingTimeline(true);
    setMessage('');
    setError('');

    try {
      await apiRequest(`work-items/${encodeURIComponent(draft.id)}/timeline`, {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: { eventDate: timelineDraft.date || todayInputDate(), message: timelineDraft.message },
      });
      setTimelineDraft({ date: todayInputDate(), message: '' });
      setMessage('Hito agregado a la línea de tiempo.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar a la línea de tiempo');
    } finally {
      setSavingTimeline(false);
    }
  };

  const overdueCount = useMemo(
    () => items.filter((item) => item.status !== 'done' && (daysBetweenToday(item.dueDate) ?? 1) < 0).length,
    [items],
  );
  const addTimelineForItem = async (itemId: string, date: string, message: string) => {
    if (!authToken || !itemId || !message.trim()) return;
    setSavingTimeline(true);
    setMessage('');
    setError('');
    try {
      await apiRequest(`work-items/${encodeURIComponent(itemId)}/timeline`, {
        method: 'POST',
        token: authToken,
        query: { chat_id: chatId },
        body: { eventDate: date || todayInputDate(), message },
      });
      setMessage('Hito agregado a la línea de tiempo.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar a la línea de tiempo');
    } finally {
      setSavingTimeline(false);
    }
  };

  const donePct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;
  const selectedItem = items.find((item) => item.id === selectedDetailId) || null;

  if (mode === 'detail' && selectedItem) {
    return (
      <WorkNoteDetail
        item={selectedItem}
        onBack={() => setMode('board')}
        onEdit={(it) => { startEdit(it); setMode('board'); }}
        onDelete={(it) => { void remove(it); setMode('board'); }}
        onAddTimeline={(date, message) => void addTimelineForItem(selectedItem.id, date, message)}
        savingTimeline={savingTimeline}
      />
    );
  }

  return (
    <section className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge color="emerald">Mi Libreta</Badge>
              <Badge color={summary.blocked ? 'rose' : 'slate'}>{summary.blocked} bloqueante{summary.blocked === 1 ? '' : 's'}</Badge>
            </div>
            <Title>Notas de trabajo</Title>
            <Text>Tu tablero de pendientes. Arrastra las tarjetas entre columnas.</Text>
            {!showForm ? (
              <button
                type="button"
                className="mt-3 inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                onClick={startNew}
              >
                <RiAddLine className="h-4 w-4" />
                Nuevo apunte
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5 xl:min-w-[40rem]">
            <SummaryTile label="Total" value={summary.total} />
            <SummaryTile label="En progreso" value={summary.in_progress} tone="amber" />
            <SummaryTile label="Vencidas" value={overdueCount} tone="rose" />
            <SummaryTile label="Hecho" value={`${donePct}%`} tone="emerald" />
            <SummaryTile label="Alta prioridad" value={summary.highPriority} tone="rose" />
          </div>
        </div>
        {error ? <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        {message ? <div className="mt-4 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}
      </Card>

      <div className={`grid gap-4 ${showForm ? 'xl:grid-cols-[22rem_minmax(0,1fr)]' : ''}`}>
        {showForm ? (
          <Card className="rounded-tremor-default border-slate-800 bg-slate-900/95 !p-4 sm:!p-5 shadow-slate-950/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Title className="text-base">{draft.id ? 'Editar apunte' : 'Nuevo apunte'}</Title>
                <Text>Registra tu nota rápida y luego muévela en el tablero.</Text>
              </div>
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 text-slate-200" onClick={resetDraft} title="Cerrar">
                <RiCloseLine className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={save}>
              <Field label="Título">
                <input className="form-input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ej: Revisar reporte de ventas" required />
              </Field>
              <Field label="Notas">
                <textarea className="form-input min-h-[10rem] !h-auto py-3" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Apuntes, decisiones, links, ideas" />
              </Field>
              <Field label="Resumen breve">
                <textarea className="form-input min-h-[5rem] !h-auto py-2" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Resumen rápido del pendiente" />
              </Field>
              <Field label="Bloqueantes">
                <textarea className="form-input min-h-[4.75rem] !h-auto py-2" value={draft.blockers} onChange={(event) => setDraft((current) => ({ ...current, blockers: event.target.value }))} placeholder="Qué falta para avanzar" />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Estado">
                  <select className="form-input" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as WorkStatus }))}>
                    <option value="todo">Todo</option>
                    <option value="in_progress">En progreso</option>
                    <option value="done">Done</option>
                  </select>
                </Field>
                <Field label="Prioridad">
                  <select className="form-input" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as WorkPriority }))}>
                    <option value="low">Baja</option>
                    <option value="medium">Media</option>
                    <option value="high">Alta</option>
                  </select>
                </Field>
              </div>
              <Field label="Fecha objetivo">
                <input className="form-input" type="date" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} />
              </Field>
              <Field label="Etiquetas">
                <input className="form-input" value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="backend, correo, urgente" />
              </Field>

              {draft.id ? (
                <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
                  <p className="text-xs font-semibold uppercase text-slate-400">Línea de tiempo</p>
                  <div className="mt-3 grid gap-3">
                    <Field label="Fecha">
                      <input className="form-input" type="date" value={timelineDraft.date} onChange={(event) => setTimelineDraft((current) => ({ ...current, date: event.target.value }))} />
                    </Field>
                    <Field label="Hito / nota">
                      <textarea className="form-input min-h-[4.5rem] !h-auto py-2" value={timelineDraft.message} onChange={(event) => setTimelineDraft((current) => ({ ...current, message: event.target.value }))} placeholder="Ej: Se envió propuesta, falta respuesta" />
                    </Field>
                    <button type="button" className="inline-flex h-9 items-center justify-center gap-2 rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60" disabled={savingTimeline || !timelineDraft.message.trim()} onClick={() => void addTimelineNote()}>
                      <RiAddLine className="h-4 w-4" />
                      Agregar hito
                    </button>
                  </div>
                </div>
              ) : null}

              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
                {draft.id ? <RiSave3Line className="h-4 w-4" /> : <RiAddLine className="h-4 w-4" />}
                {draft.id ? 'Guardar cambios' : 'Guardar apunte'}
              </button>
            </form>
          </Card>
        ) : null}

        <Card className="rounded-tremor-default border-slate-800 bg-slate-900/95 !p-4 sm:!p-5 shadow-slate-950/10">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <Title className="text-base">Tablero</Title>
                <Text>Arrastra las tarjetas para moverlas entre columnas.</Text>
              </div>
              <Badge color="slate">{loading ? 'Actualizando…' : `${items.length} apunte${items.length === 1 ? '' : 's'}`}</Badge>
            </div>
            <div className="grid gap-3 xl:grid-cols-3">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className={`rounded-tremor-default border p-4 transition ${dropTarget === column.id ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-800 bg-slate-950/80'}`}
                  onDragOver={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    setDropTarget(column.id);
                  }}
                  onDragLeave={() => setDropTarget('')}
                  onDrop={(event: DragEvent<HTMLDivElement>) => {
                    event.preventDefault();
                    void moveItem(column.id);
                  }}
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{column.title}</p>
                      <p className="text-xs text-slate-500">{column.subtitle}</p>
                    </div>
                    <Badge color={column.tone}>{boardItems[column.id].length}</Badge>
                  </div>
                  <div className="space-y-3">
                    {boardItems[column.id].length ? boardItems[column.id].map((item) => {
                      const due = dueInfo(item);
                      const aging = agingLabel(item);
                      return (
                      <article
                        key={item.id}
                        draggable
                        className={`rounded-tremor-default border p-3 transition hover:border-slate-700 hover:bg-slate-900/70 ${draggingId === item.id ? 'opacity-60 ring-2 ring-emerald-400/50' : 'bg-slate-900/90 border-slate-800 cursor-grab'}`}
                        onDragStart={(event) => {
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('text/plain', item.id);
                          setDraggingId(item.id);
                        }}
                        onDragEnd={() => {
                          setDraggingId('');
                          setDropTarget('');
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void moveItem(column.id, item.id);
                        }}
                      >
                        <button type="button" className="text-left w-full" onClick={() => openDetails(item)}>
                          <p className="text-sm font-semibold text-slate-100 line-clamp-2">{item.title}</p>
                          <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem] text-slate-400">
                            <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5">{priorityLabels[item.priority]}</span>
                            {due ? (
                              <span className={`rounded-full px-2 py-0.5 font-semibold ${dueToneClass(due.tone)}`}>{due.label}</span>
                            ) : null}
                            {aging ? (
                              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-amber-200">{aging}</span>
                            ) : null}
                          </div>
                        </button>
                        <div className="mt-3 flex items-center gap-1.5 border-t border-slate-800 pt-2">
                          <span className="text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-slate-500">Mover a</span>
                          <select
                            value={item.status}
                            aria-label="Cambiar estado"
                            draggable={false}
                            className="ml-auto rounded-tremor-default border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs font-semibold text-slate-200 focus:border-emerald-400/60 focus:outline-none"
                            onClick={(event) => event.stopPropagation()}
                            onPointerDown={(event) => event.stopPropagation()}
                            onChange={(event) => void changeStatus(item, event.target.value as WorkStatus)}
                          >
                            <option value="todo">Pendientes</option>
                            <option value="in_progress">En progreso</option>
                            <option value="done">Completadas</option>
                          </select>
                        </div>
                      </article>
                      );
                    }) : (
                      <div className="rounded-tremor-default border border-dashed border-slate-800 bg-slate-900/80 p-4 text-center text-sm text-slate-500">
                        Sin notas en esta columna
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
        </Card>
      </div>
    </section>
  );
}

function SummaryTile({ label, value, tone = 'slate' }: { label: string; value: number | string; tone?: 'slate' | 'amber' | 'emerald' | 'rose' }) {
  const color = {
    slate: 'text-slate-100',
    amber: 'text-amber-200',
    emerald: 'text-emerald-200',
    rose: 'text-rose-200',
  }[tone];

  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-semibold uppercase text-slate-400">
      {label}
      {children}
    </label>
  );
}

function draftToPayload(draft: Draft, chatId?: string) {
  return {
    chat_id: chatId,
    title: draft.title,
    description: draft.description,
    notes: draft.notes,
    blockers: draft.blockers,
    status: draft.status,
    priority: draft.priority,
    dueDate: draft.dueDate,
    tags: draft.tags.split(',').map((tag) => tag.trim()).filter(Boolean),
  };
}

function normalizeItems(items: WorkItem[]) {
  return items.map((item) => ({
    ...item,
    status: normalizeStatus(item.status),
    priority: normalizePriority(item.priority),
    sortOrder: Number(item.sortOrder || 0),
    tags: item.tags || [],
    timeline: item.timeline || [],
  }));
}

function summarize(items: WorkItem[]): WorkSummary {
  return items.reduce<WorkSummary>((acc, item) => {
    acc.total += 1;
    acc[item.status] += 1;
    if (item.blockers) acc.blocked += 1;
    if (item.priority === 'high') acc.highPriority += 1;
    return acc;
  }, { total: 0, todo: 0, in_progress: 0, done: 0, blocked: 0, highPriority: 0 });
}

function normalizeStatus(value: string): WorkStatus {
  return value === 'in_progress' || value === 'done' ? value : 'todo';
}

function normalizePriority(value: string): WorkPriority {
  return value === 'high' || value === 'low' ? value : 'medium';
}

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}

function parseDueDate(value?: string): Date | null {
  const match = (value || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

// Dias entre hoy y la fecha objetivo (negativo = vencida).
function daysBetweenToday(value?: string): number | null {
  const date = parseDueDate(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((date.getTime() - today.getTime()) / 86400000);
}

function dueInfo(item: WorkItem): { label: string; tone: 'rose' | 'amber' | 'slate' } | null {
  if (item.status === 'done') return null;
  const days = daysBetweenToday(item.dueDate);
  if (days === null) return null;
  if (days < 0) return { label: `Vencida ${Math.abs(days)}d`, tone: 'rose' };
  if (days === 0) return { label: 'Vence hoy', tone: 'amber' };
  if (days <= 3) return { label: `Vence en ${days}d`, tone: 'amber' };
  if (days <= 7) return { label: `Vence en ${days}d`, tone: 'slate' };
  const key = (item.dueDate || '').slice(0, 10);
  return { label: `Vence ${key.slice(8, 10)}/${key.slice(5, 7)}`, tone: 'slate' };
}

function dueToneClass(tone: 'rose' | 'amber' | 'slate'): string {
  if (tone === 'rose') return 'border border-rose-500/40 bg-rose-500/15 text-rose-200';
  if (tone === 'amber') return 'border border-amber-500/40 bg-amber-500/15 text-amber-200';
  return 'border border-slate-700 bg-slate-950/80 text-slate-300';
}

// "Sin avanzar Nd": dias desde la ultima actualizacion para items en progreso.
function agingLabel(item: WorkItem): string | null {
  if (item.status !== 'in_progress') return null;
  const ref = item.updatedAt || item.createdAt;
  if (!ref) return null;
  const date = new Date(ref.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((Date.now() - date.getTime()) / 86400000);
  return days >= 2 ? `Sin avanzar ${days}d` : null;
}
