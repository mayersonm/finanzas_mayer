import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent, type ReactNode } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import {
  RiAddLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiEditLine,
  RiErrorWarningLine,
  RiSave3Line,
} from '@remixicon/react';
import { apiEndpoint } from '../../app/api';
import { EmptyState } from '../../components/common/EmptyState';
import type { WorkItem, WorkPriority, WorkStatus, WorkSummary } from '../../types/dashboard';

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

type WorkResponse = {
  ok?: boolean;
  items?: WorkItem[];
  summary?: WorkSummary;
  error?: string;
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

const columns: Array<{
  id: WorkStatus;
  title: string;
  subtitle: string;
  tone: 'slate' | 'amber' | 'emerald';
}> = [
  { id: 'todo', title: 'Todo', subtitle: 'Ideas y pendientes por tomar', tone: 'slate' },
  { id: 'in_progress', title: 'En progreso', subtitle: 'Lo que estas moviendo ahora', tone: 'amber' },
  { id: 'done', title: 'Done', subtitle: 'Cerrado y listo para revisar', tone: 'emerald' },
];

const statusLabels: Record<WorkStatus, string> = {
  todo: 'Todo',
  in_progress: 'En progreso',
  done: 'Done',
};

const priorityLabels: Record<WorkPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

export function WorkSection({ authToken, chatId }: { authToken?: string | null; chatId?: string }) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [summary, setSummary] = useState<WorkSummary>({ total: 0, todo: 0, in_progress: 0, done: 0, blocked: 0, highPriority: 0 });
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState('');
  const [dropTarget, setDropTarget] = useState<WorkStatus | ''>('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const board = useMemo(() => {
    return columns.reduce<Record<WorkStatus, WorkItem[]>>((acc, column) => {
      acc[column.id] = items
        .filter((item) => item.status === column.id)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
      return acc;
    }, { todo: [], in_progress: [], done: [] });
  }, [items]);

  const load = useCallback(async () => {
    if (!authToken) return;
    setLoading(true);
    setError('');

    try {
      const url = new URL(apiEndpoint('work-items'));
      if (chatId) url.searchParams.set('chat_id', chatId);
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as WorkResponse;
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo cargar Mi Trabajo');
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
    setMessage('');
    setError('');
  };

  const resetDraft = () => {
    setDraft(emptyDraft);
    setMessage('');
    setError('');
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authToken) return;
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const payload = draftToPayload(draft, chatId);
      const url = draft.id
        ? new URL(apiEndpoint(`work-items/${encodeURIComponent(draft.id)}`))
        : new URL(apiEndpoint('work-items'));
      if (chatId) url.searchParams.set('chat_id', chatId);

      const response = await fetch(url.toString(), {
        method: draft.id ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok?: boolean; item?: WorkItem; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo guardar');

      setMessage(draft.id ? 'Trabajo actualizado.' : 'Trabajo creado.');
      setDraft(emptyDraft);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el trabajo');
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
      const url = new URL(apiEndpoint(`work-items/${encodeURIComponent(item.id)}`));
      if (chatId) url.searchParams.set('chat_id', chatId);
      const response = await fetch(url.toString(), {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const result = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo eliminar');
      const nextItems = items.filter((row) => row.id !== item.id);
      setItems(nextItems);
      setSummary(summarize(nextItems));
      setMessage('Trabajo eliminado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo eliminar');
    } finally {
      setSaving(false);
    }
  };

  const persistOrder = useCallback(async (nextItems: WorkItem[]) => {
    if (!authToken) return;
    const url = new URL(apiEndpoint('work-items/reorder'));
    if (chatId) url.searchParams.set('chat_id', chatId);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: nextItems.map((item) => ({
          id: item.id,
          status: item.status,
          sortOrder: item.sortOrder,
        })),
      }),
    });
    const result = await response.json() as { ok?: boolean; error?: string };
    if (!response.ok || result.ok === false) throw new Error(result.error || 'No se pudo reordenar');
  }, [authToken, chatId]);

  const moveItem = useCallback(async (targetStatus: WorkStatus, beforeId?: string) => {
    if (!draggingId || !authToken) return;

    const currentItem = items.find((item) => item.id === draggingId);
    if (!currentItem || currentItem.id === beforeId) {
      setDraggingId('');
      setDropTarget('');
      return;
    }

    const withoutDragged = items.filter((item) => item.id !== draggingId);
    const targetItems = withoutDragged.filter((item) => item.status === targetStatus);
    const moved = { ...currentItem, status: targetStatus };
    const insertIndex = beforeId ? Math.max(0, targetItems.findIndex((item) => item.id === beforeId)) : targetItems.length;
    const nextTarget = [
      ...targetItems.slice(0, insertIndex),
      moved,
      ...targetItems.slice(insertIndex),
    ].map((item, index) => ({ ...item, sortOrder: index + 1 }));

    const nextItems = columns.flatMap((column) => {
      if (column.id === targetStatus) return nextTarget;
      return withoutDragged
        .filter((item) => item.status === column.id)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item, index) => ({ ...item, sortOrder: index + 1 }));
    });

    setDraggingId('');
    setDropTarget('');
    setItems(nextItems);
    setSummary(summarize(nextItems));

    try {
      await persistOrder(nextItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo reordenar');
      await load();
    }
  }, [authToken, draggingId, items, load, persistOrder]);

  const donePct = summary.total > 0 ? Math.round((summary.done / summary.total) * 100) : 0;

  return (
    <section className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge color="emerald">Mi Trabajo</Badge>
              <Badge color={summary.blocked ? 'rose' : 'slate'}>{summary.blocked} bloqueante{summary.blocked === 1 ? '' : 's'}</Badge>
            </div>
            <Title>Tablero de trabajo</Title>
            <Text>Apuntes, pendientes, bloqueantes y avances en un Kanban simple.</Text>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[34rem]">
            <SummaryTile label="Total" value={summary.total} />
            <SummaryTile label="En progreso" value={summary.in_progress} tone="amber" />
            <SummaryTile label="Hecho" value={`${donePct}%`} tone="emerald" />
            <SummaryTile label="Alta prioridad" value={summary.highPriority} tone="rose" />
          </div>
        </div>
        {error ? <div className="mt-4 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div> : null}
        {message ? <div className="mt-4 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">{message}</div> : null}
      </Card>

      <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Title className="text-base">{draft.id ? 'Editar apunte' : 'Nuevo apunte'}</Title>
              <Text>Captura la tarea y lo que la bloquea.</Text>
            </div>
            {draft.id ? (
              <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-tremor-default border border-slate-700 bg-slate-900/70 text-slate-200" onClick={resetDraft} title="Cancelar edicion">
                <RiCloseLine className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <form className="mt-4 grid gap-3" onSubmit={save}>
            <Field label="Titulo">
              <input className="form-input" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Ej: Revisar reporte de ventas" required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              <Field label="Estado">
                <select className="form-input" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as WorkStatus }))}>
                  {columns.map((column) => <option key={column.id} value={column.id}>{column.title}</option>)}
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
            <Field label="Descripcion">
              <textarea className="form-input min-h-[4.75rem] !h-auto py-2" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Contexto rapido del pendiente" />
            </Field>
            <Field label="Notas">
              <textarea className="form-input min-h-[5.5rem] !h-auto py-2" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} placeholder="Apuntes, decisiones, links, ideas" />
            </Field>
            <Field label="Bloqueantes">
              <textarea className="form-input min-h-[4.75rem] !h-auto py-2" value={draft.blockers} onChange={(event) => setDraft((current) => ({ ...current, blockers: event.target.value }))} placeholder="Que falta para avanzar" />
            </Field>
            <Field label="Etiquetas">
              <input className="form-input" value={draft.tags} onChange={(event) => setDraft((current) => ({ ...current, tags: event.target.value }))} placeholder="backend, correo, urgente" />
            </Field>

            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={saving || !authToken}>
              {draft.id ? <RiSave3Line className="h-4 w-4" /> : <RiAddLine className="h-4 w-4" />}
              {draft.id ? 'Guardar cambios' : 'Crear apunte'}
            </button>
          </form>
        </Card>

        <div className="grid gap-3 lg:grid-cols-3">
          {columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={column}
              items={board[column.id]}
              loading={loading}
              active={dropTarget === column.id}
              draggingId={draggingId}
              onDragStart={(id) => setDraggingId(id)}
              onDragEnd={() => {
                setDraggingId('');
                setDropTarget('');
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDropTarget(column.id);
              }}
              onDrop={(beforeId) => void moveItem(column.id, beforeId)}
              onEdit={startEdit}
              onDelete={(item) => void remove(item)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function KanbanColumn({
  column,
  items,
  loading,
  active,
  draggingId,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onEdit,
  onDelete,
}: {
  column: (typeof columns)[number];
  items: WorkItem[];
  loading: boolean;
  active: boolean;
  draggingId: string;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (beforeId?: string) => void;
  onEdit: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
}) {
  const toneClass = {
    slate: 'border-slate-800 bg-slate-950/60',
    amber: 'border-amber-500/30 bg-amber-500/10',
    emerald: 'border-emerald-500/30 bg-emerald-500/10',
  }[column.tone];

  return (
    <div
      className={`flex min-h-[30rem] flex-col rounded-tremor-default border p-3 transition ${toneClass} ${active ? 'ring-2 ring-emerald-400/50' : ''}`}
      onDragOver={onDragOver}
      onDrop={(event) => {
        event.preventDefault();
        onDrop();
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-100">{column.title}</h2>
            <Badge color={column.tone}>{items.length}</Badge>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{column.subtitle}</p>
        </div>
      </div>

      <div className="grid flex-1 content-start gap-3">
        {items.length ? items.map((item) => (
          <WorkCard
            key={item.id}
            item={item}
            dragging={draggingId === item.id}
            onDragStart={() => onDragStart(item.id)}
            onDragEnd={onDragEnd}
            onDropBefore={() => onDrop(item.id)}
            onEdit={() => onEdit(item)}
            onDelete={() => onDelete(item)}
          />
        )) : (
          <EmptyState>{loading ? 'Cargando...' : 'Suelta aqui un apunte.'}</EmptyState>
        )}
      </div>
    </div>
  );
}

function WorkCard({
  item,
  dragging,
  onDragStart,
  onDragEnd,
  onDropBefore,
  onEdit,
  onDelete,
}: {
  item: WorkItem;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropBefore: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const blocked = Boolean(item.blockers);
  const priorityTone = item.priority === 'high' ? 'rose' : item.priority === 'medium' ? 'amber' : 'slate';
  const dueTone = dueDateTone(item.dueDate);

  return (
    <article
      draggable
      className={`group rounded-tremor-default border border-slate-800 bg-slate-950/70 p-3 shadow-sm transition hover:border-slate-700 hover:bg-slate-900/80 ${dragging ? 'opacity-50 ring-2 ring-emerald-400/50' : ''}`}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', item.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onDropBefore();
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100">{item.title}</p>
          {item.description ? <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-400">{item.description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
          <button type="button" className="grid h-8 w-8 place-items-center rounded-tremor-default border border-slate-700 bg-slate-900/70 text-slate-200" onClick={onEdit} title="Editar">
            <RiEditLine className="h-4 w-4" />
          </button>
          <button type="button" className="grid h-8 w-8 place-items-center rounded-tremor-default border border-rose-500/30 bg-rose-500/10 text-rose-200" onClick={onDelete} title="Eliminar">
            <RiDeleteBinLine className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge color={priorityTone}>{priorityLabels[item.priority]}</Badge>
        <Badge color={blocked ? 'rose' : 'emerald'}>{blocked ? 'Bloqueado' : statusLabels[item.status]}</Badge>
        {item.dueDate ? <Badge color={dueTone}>{formatDate(item.dueDate)}</Badge> : null}
      </div>

      {item.blockers ? (
        <div className="mt-3 rounded-tremor-default border border-rose-500/25 bg-rose-500/10 p-2 text-xs leading-5 text-rose-200">
          <span className="mb-1 flex items-center gap-1 font-semibold">
            <RiErrorWarningLine className="h-3.5 w-3.5" />
            Bloqueante
          </span>
          <p className="line-clamp-3">{item.blockers}</p>
        </div>
      ) : null}

      {item.notes ? (
        <div className="mt-3 rounded-tremor-default border border-slate-800 bg-slate-900/40 p-2 text-xs leading-5 text-slate-400">
          <span className="mb-1 flex items-center gap-1 font-semibold text-slate-200">
            <RiCheckboxCircleLine className="h-3.5 w-3.5 text-emerald-300" />
            Notas
          </span>
          <p className="line-clamp-4 whitespace-pre-line">{item.notes}</p>
        </div>
      ) : null}

      {item.tags?.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-slate-800 bg-slate-900/40 px-2 py-0.5 text-[0.68rem] font-semibold text-slate-400">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}
    </article>
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

function dueDateTone(value?: string) {
  if (!value) return 'slate';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 'slate';
  const days = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'rose';
  if (days <= 2) return 'amber';
  return 'slate';
}

function formatDate(value?: string) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
}
