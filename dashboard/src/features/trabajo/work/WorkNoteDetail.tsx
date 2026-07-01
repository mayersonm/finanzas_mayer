import { useMemo, useState } from 'react';
import { Badge, Card, Text, Title } from '@tremor/react';
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCalendarLine,
  RiDeleteBinLine,
  RiEditLine,
  RiTimeLine,
} from '@remixicon/react';
import type { WorkItem, WorkPriority, WorkStatus, WorkTimelineEvent } from '../../../types/dashboard';

const statusLabels: Record<WorkStatus, string> = { todo: 'Todo', in_progress: 'En progreso', done: 'Done' };
const priorityLabels: Record<WorkPriority, string> = { low: 'Baja', medium: 'Media', high: 'Alta' };

interface WorkNoteDetailProps {
  item: WorkItem;
  onBack: () => void;
  onEdit: (item: WorkItem) => void;
  onDelete: (item: WorkItem) => void;
  onAddTimeline: (date: string, message: string) => void;
  savingTimeline: boolean;
}

export function WorkNoteDetail({ item, onBack, onEdit, onDelete, onAddTimeline, savingTimeline }: WorkNoteDetailProps) {
  const [hitoDate, setHitoDate] = useState(todayInputDate());
  const [hitoMessage, setHitoMessage] = useState('');

  const timeline = useMemo(
    () => [...(item.timeline || [])].sort((a, b) => eventTime(b) - eventTime(a)),
    [item.timeline],
  );

  const submitHito = () => {
    if (!hitoMessage.trim()) return;
    onAddTimeline(hitoDate || todayInputDate(), hitoMessage.trim());
    setHitoMessage('');
  };

  return (
    <section className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-10 items-center gap-2 rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
        >
          <RiArrowLeftLine className="h-4 w-4" /> Volver al tablero
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onEdit(item)}
            className="inline-flex h-10 items-center gap-2 rounded-tremor-default border border-slate-700 bg-slate-900/70 px-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800"
          >
            <RiEditLine className="h-4 w-4" /> Editar
          </button>
          <button
            type="button"
            onClick={() => onDelete(item)}
            className="inline-flex h-10 items-center gap-2 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20"
          >
            <RiDeleteBinLine className="h-4 w-4" /> Eliminar
          </button>
        </div>
      </div>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="mb-3 flex flex-wrap gap-1.5">
          <Badge color={statusTone(item.status)}>{statusLabels[item.status]}</Badge>
          <Badge color={priorityTone(item.priority)}>{priorityLabels[item.priority]}</Badge>
          {item.blockers ? <Badge color="rose">Bloqueado</Badge> : null}
          {item.dueDate ? <Badge color={dueDateTone(item.dueDate)}>Vence {formatDate(item.dueDate)}</Badge> : null}
        </div>
        <Title className="break-words text-2xl">{item.title}</Title>
        {item.description ? <Text className="mt-2 whitespace-pre-line text-base text-slate-300">{item.description}</Text> : null}

        {item.tags?.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-slate-800 bg-slate-900/40 px-2 py-1 text-xs font-semibold text-slate-400">#{tag}</span>
            ))}
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          <DetailBlock title="Notas" value={item.notes} empty="Sin notas." />
          <DetailBlock title="Bloqueantes" value={item.blockers} empty="Sin bloqueantes." tone={item.blockers ? 'rose' : 'slate'} />
        </div>
      </Card>

      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RiTimeLine className="h-4 w-4 text-emerald-300" />
            <Title className="text-base">Línea de tiempo</Title>
          </div>
          <Badge color="slate">{timeline.length}</Badge>
        </div>

        <div className="mb-4 grid gap-2 rounded-tremor-default bg-slate-900/40 p-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-400">
            Fecha
            <input className="form-input" type="date" value={hitoDate} onChange={(event) => setHitoDate(event.target.value)} />
          </label>
          <label className="grid gap-1 text-xs font-semibold uppercase text-slate-400">
            Hito / nota
            <input className="form-input" value={hitoMessage} onChange={(event) => setHitoMessage(event.target.value)} placeholder="Ej: Se envió propuesta, falta respuesta" />
          </label>
          <button
            type="button"
            onClick={submitHito}
            disabled={savingTimeline || !hitoMessage.trim()}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            <RiAddLine className="h-4 w-4" /> Agregar
          </button>
        </div>

        {timeline.length ? (
          <div className="grid gap-3">
            {timeline.map((event) => <TimelineRow key={event.id} event={event} />)}
          </div>
        ) : (
          <div className="rounded-tremor-default border border-dashed border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-500">
            Todavía no hay hitos registrados.
          </div>
        )}
      </Card>
    </section>
  );
}

function DetailBlock({ title, value, empty, tone = 'slate' }: { title: string; value?: string; empty: string; tone?: 'slate' | 'rose' }) {
  const toneClass = tone === 'rose'
    ? 'border border-rose-500/25 bg-rose-500/10 text-rose-100'
    : 'bg-slate-900/40 text-slate-300';

  return (
    <section className={`rounded-tremor-default p-4 ${toneClass}`}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{title}</h3>
      <p className="mt-3 whitespace-pre-line text-sm leading-6">{value || empty}</p>
    </section>
  );
}

function TimelineRow({ event }: { event: WorkTimelineEvent }) {
  return (
    <div className="grid gap-3 rounded-tremor-default bg-slate-950/40 p-3 sm:grid-cols-[7rem_minmax(0,1fr)]">
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

function eventTime(event?: WorkTimelineEvent) {
  if (!event) return 0;
  return Math.max(parseDateTime(event.eventDate), parseDateTime(event.createdAt));
}

function parseDateTime(value?: string) {
  if (!value) return 0;
  const time = new Date(value.includes('T') ? value : `${value}T00:00:00`).getTime();
  return Number.isNaN(time) ? 0 : time;
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
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
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

function todayInputDate() {
  return new Date().toISOString().slice(0, 10);
}
