import { useMemo, useState } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import {
  RiCalendarLine,
  RiDeleteBinLine,
  RiEditLine,
  RiSearchLine,
  RiTimeLine,
} from '@remixicon/react';
import type { WorkItem, WorkPriority, WorkStatus, WorkTimelineEvent } from '../../types/dashboard';

type DetailFilter = 'all' | WorkStatus | 'blocked';

interface WorkDetailViewProps {
  items: WorkItem[];
  loading: boolean;
  selectedItemId: string;
  onSelectItem: (id: string) => void;
  onEdit: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
}

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

const filters: Array<{ id: DetailFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'todo', label: 'Todo' },
  { id: 'in_progress', label: 'En progreso' },
  { id: 'done', label: 'Done' },
  { id: 'blocked', label: 'Bloqueados' },
];

export function WorkDetailView({
  items,
  loading,
  selectedItemId,
  onSelectItem,
  onEdit,
  onDelete,
}: WorkDetailViewProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DetailFilter>('all');

  const filteredItems = useMemo(() => {
    const needle = normalizeSearch(query);

    return items
      .filter((item) => {
        if (filter === 'blocked') return Boolean(item.blockers);
        if (filter === 'all') return true;
        return item.status === filter;
      })
      .filter((item) => {
        if (!needle) return true;
        return searchableText(item).includes(needle);
      })
      .sort((a, b) => {
        const priorityDelta = priorityRank(b.priority) - priorityRank(a.priority);
        if (priorityDelta !== 0) return priorityDelta;
        return lastActivityTime(b) - lastActivityTime(a);
      });
  }, [filter, items, query]);

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId)
    || items.find((item) => item.id === selectedItemId)
    || filteredItems[0]
    || null;

  const selectedTimeline = useMemo(() => {
    return [...(selectedItem?.timeline || [])].sort((a, b) => eventTime(b) - eventTime(a));
  }, [selectedItem]);

  return (
    <div className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div>
            <Title className="text-lg">Detalle de trabajo</Title>
            <Text>Busca por titulo, nota, bloqueante, etiqueta o hito.</Text>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(18rem,1fr)_auto]">
            <label className="relative block">
              <RiSearchLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="form-input pl-9"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar en trabajo"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`h-10 rounded-tremor-default border px-3 text-xs font-semibold transition ${
                    filter === item.id
                      ? 'border-emerald-400/70 bg-emerald-500/15 text-emerald-100'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-900/70 hover:text-slate-100'
                  }`}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="work-window notepad-paper grid gap-4">
        <div className="work-window__titlebar">
          <div className="window-dots">
            <span />
            <span />
            <span />
          </div>
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Panel de notas</p>
        </div>

        <div className="grid gap-4 p-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <Card className="rounded-tremor-default border-slate-800 bg-slate-950/60 !p-0">
            <div className="border-b border-slate-800 p-4">
              <p className="text-sm font-semibold text-slate-100">{filteredItems.length} apunte{filteredItems.length === 1 ? '' : 's'}</p>
              <p className="mt-1 text-xs text-slate-500">{loading ? 'Actualizando...' : 'Ordenado por prioridad y actividad'}</p>
            </div>

            <div className="max-h-[calc(100vh-18rem)] min-h-[22rem] overflow-y-auto p-2">
              {filteredItems.length ? filteredItems.map((item) => {
                const active = selectedItem?.id === item.id;
                const lastEvent = getLastEvent(item.timeline || []);

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`mb-2 block w-full rounded-tremor-default border p-3 text-left transition ${
                      active
                        ? 'border-emerald-400/70 bg-emerald-500/15'
                        : 'border-slate-800 bg-slate-900/30 hover:border-slate-700 hover:bg-slate-900/60'
                    }`}
                    onClick={() => onSelectItem(item.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="line-clamp-2 text-sm font-semibold leading-5 text-slate-100">{item.title}</p>
                      <Badge color={item.blockers ? 'rose' : statusTone(item.status)}>{item.blockers ? 'Bloqueado' : statusLabels[item.status]}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge color={priorityTone(item.priority)}>{priorityLabels[item.priority]}</Badge>
                      {item.dueDate ? <Badge color={dueDateTone(item.dueDate)}>{formatDate(item.dueDate)}</Badge> : null}
                    </div>
                    {lastEvent ? (
                      <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-500">
                        {formatDate(lastEvent.eventDate)} · {lastEvent.message}
                      </p>
                    ) : null}
                  </button>
                );
              }) : (
                <div className="grid min-h-[18rem] place-items-center rounded-tremor-default border border-dashed border-slate-800 bg-slate-900/20 p-6 text-center text-sm text-slate-500">
                  No hay apuntes con ese filtro.
                </div>
              )}
            </div>
          </Card>
        </div>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-5">
          {selectedItem ? (
            <article className="grid gap-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    <Badge color={statusTone(selectedItem.status)}>{statusLabels[selectedItem.status]}</Badge>
                    <Badge color={priorityTone(selectedItem.priority)}>{priorityLabels[selectedItem.priority]}</Badge>
                    {selectedItem.blockers ? <Badge color="rose">Bloqueado</Badge> : null}
                    {selectedItem.dueDate ? <Badge color={dueDateTone(selectedItem.dueDate)}>{formatDate(selectedItem.dueDate)}</Badge> : null}
                  </div>
                  <Title className="break-words text-xl">{selectedItem.title}</Title>
                  {selectedItem.description ? <Text className="mt-2 whitespace-pre-line">{selectedItem.description}</Text> : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-xs font-semibold text-slate-200 transition hover:bg-slate-800"
                    onClick={() => onEdit(selectedItem)}
                  >
                    <RiEditLine className="h-4 w-4" />
                    Editar
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                    onClick={() => onDelete(selectedItem)}
                  >
                    <RiDeleteBinLine className="h-4 w-4" />
                    Eliminar
                  </button>
                </div>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <DetailBlock title="Notas" value={selectedItem.notes} empty="Sin notas." />
                <DetailBlock title="Bloqueantes" value={selectedItem.blockers} empty="Sin bloqueantes." tone={selectedItem.blockers ? 'rose' : 'slate'} />
              </div>

              {selectedItem.tags?.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedItem.tags.map((tag) => (
                    <span key={tag} className="rounded-full border border-slate-800 bg-slate-900/40 px-2 py-1 text-xs font-semibold text-slate-400">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <section className="rounded-tremor-default border border-slate-800 bg-slate-900/30 p-4">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <RiTimeLine className="h-4 w-4 text-emerald-300" />
                    <h3 className="text-sm font-semibold text-slate-100">Linea de tiempo</h3>
                  </div>
                  <Badge color="slate">{selectedTimeline.length}</Badge>
                </div>

                {selectedTimeline.length ? (
                  <div className="grid gap-3">
                    {selectedTimeline.map((event) => (
                      <TimelineRow key={event.id} event={event} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-tremor-default border border-dashed border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
                    Todavia no hay hitos registrados.
                  </div>
                )}
              </section>
            </article>
          ) : (
            <div className="grid min-h-[26rem] place-items-center rounded-tremor-default border border-dashed border-slate-800 bg-slate-900/20 p-6 text-center text-sm text-slate-500">
              Crea un apunte para ver su detalle.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function DetailBlock({
  title,
  value,
  empty,
  tone = 'slate',
}: {
  title: string;
  value?: string;
  empty: string;
  tone?: 'slate' | 'rose';
}) {
  const toneClass = tone === 'rose'
    ? 'border-rose-500/25 bg-rose-500/10 text-rose-100'
    : 'border-slate-800 bg-slate-900/30 text-slate-300';

  return (
    <section className={`rounded-tremor-default border p-4 ${toneClass}`}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      <p className="mt-3 whitespace-pre-line text-sm leading-6">{value || empty}</p>
    </section>
  );
}

function TimelineRow({ event }: { event: WorkTimelineEvent }) {
  return (
    <div className="grid gap-3 rounded-tremor-default border border-slate-800 bg-slate-950/45 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
        <RiCalendarLine className="h-4 w-4" />
        {formatDate(event.eventDate)}
      </div>
      <div className="min-w-0 border-slate-800 sm:border-l sm:pl-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{timelineTypeLabel(event.type)}</p>
        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-300">{event.message}</p>
      </div>
    </div>
  );
}

function searchableText(item: WorkItem) {
  return normalizeSearch([
    item.title,
    item.description,
    item.notes,
    item.blockers,
    item.status,
    item.priority,
    ...(item.tags || []),
    ...(item.timeline || []).flatMap((event) => [event.message, event.type, event.eventDate]),
  ].filter(Boolean).join(' '));
}

function normalizeSearch(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function getLastEvent(events: WorkTimelineEvent[]) {
  return [...events].sort((a, b) => eventTime(b) - eventTime(a))[0];
}

function lastActivityTime(item: WorkItem) {
  const timelineTime = getLastEvent(item.timeline || []);
  return Math.max(eventTime(timelineTime), parseDateTime(item.updatedAt), parseDateTime(item.createdAt));
}

function eventTime(event?: WorkTimelineEvent) {
  if (!event) return 0;
  return Math.max(parseDateTime(event.eventDate), parseDateTime(event.createdAt));
}

function parseDateTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value.includes('T') ? value : `${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function priorityRank(priority: WorkPriority) {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function statusTone(status: WorkStatus) {
  if (status === 'done') return 'emerald';
  if (status === 'in_progress') return 'amber';
  return 'slate';
}

function priorityTone(priority: WorkPriority) {
  if (priority === 'high') return 'rose';
  if (priority === 'medium') return 'amber';
  return 'slate';
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
  return date.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function timelineTypeLabel(type: string) {
  if (type === 'created') return 'Creado';
  if (type === 'status') return 'Estado';
  if (type === 'notes') return 'Notas';
  if (type === 'blocker') return 'Bloqueo';
  if (type === 'unblocked') return 'Desbloqueo';
  if (type === 'due_date') return 'Fecha';
  if (type === 'updated') return 'Cambio';
  return 'Nota';
}
