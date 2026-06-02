import { RiAlarmWarningLine, RiBankCardLine, RiCalendarCheckLine, RiFlagLine, RiLoopLeftLine, RiMoneyDollarCircleLine, RiTargetLine } from '@remixicon/react';
import { Badge, Card, ProgressBar, Text, Title, type Color } from '@tremor/react';
import { EmptyState } from '../../components/common/EmptyState';
import { formatDate, formatMoney } from '../../lib/formatters';
import type { CalendarEvent, DashboardData, FinancialCalendar, WeeklyGoal } from '../../types/dashboard';

const WEEK_DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

export function CalendarSection({ data }: { data: DashboardData }) {
  const calendar = data.calendario || fallbackCalendar(data);
  const weekly = data.objetivoSemanal || fallbackWeeklyGoal(data);
  const closure = data.cierreAutomatico;
  const eventsByDate = groupEventsByDate(calendar.events);
  const days = calendarDays(calendar);
  const nextEvents = calendar.events.slice(0, 8);
  const weeklyColor = weeklyTone(weekly.status);
  const closureColor = closureTone(closure?.status || 'waiting');

  return (
    <section className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)_minmax(280px,0.8fr)]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Title>Calendario financiero</Title>
              <Text>{calendar.label} - ciclo {calendar.cycleRange}</Text>
            </div>
            <Badge color="cyan">{calendar.events.length} eventos</Badge>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <CalendarMini label="Fijos" value={calendar.summary.fijos} />
            <CalendarMini label="Deudas" value={calendar.summary.deudas} />
            <CalendarMini label="Credito" value={calendar.summary.credito} />
            <CalendarMini label="Alertas" value={calendar.summary.alertas} />
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start gap-3">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-tremor-default ${weeklyColor.icon}`}>
              <RiTargetLine className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Title>Objetivo semanal</Title>
                <Badge color={weeklyColor.badge}>{weekly.status}</Badge>
              </div>
              <Text>{weekly.range}</Text>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">Usado</span>
              <span className="font-mono font-semibold text-slate-100">{formatMoney(weekly.spent)} / {formatMoney(weekly.target)}</span>
            </div>
            <ProgressBar className="mt-2" value={weekly.progressPct} color={weeklyColor.progress} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <CalendarMini label="Queda" value={formatMoney(weekly.remaining)} />
            <CalendarMini label="Diario" value={formatMoney(weekly.dailyRemaining)} />
          </div>
          <Text className="mt-3">{weekly.message}</Text>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-tremor-default bg-emerald-500/15 text-emerald-200">
              <RiLoopLeftLine className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Title>Regla de cierre</Title>
                <Badge color={closureColor}>{closure?.status || 'waiting'}</Badge>
              </div>
              <Text>{closure?.targetCycleRange || calendar.cycleRange}</Text>
            </div>
          </div>
          <div className="mt-4 rounded-tremor-default border border-slate-800 bg-slate-900/50 p-3">
            <p className="text-sm font-semibold text-slate-100">{closure?.title || 'Cierre programado'}</p>
            <p className="mt-1 text-sm text-slate-400">{closure?.message || `Cierre ${formatDate(calendar.cycleClose)}.`}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <CalendarMini label="Ahorro sugerido" value={formatMoney(closure?.suggestedSavings || 0)} />
            <CalendarMini label="Para gastar" value={formatMoney(closure?.availableToSpend || data.dineroLibre?.availableToSpend || 0)} />
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-3 sm:!p-5">
          <div className="overflow-x-auto">
            <div className="min-w-[46rem]">
              <div className="grid grid-cols-7 gap-2">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="px-2 py-1 text-center text-xs font-semibold uppercase text-slate-500">
                    {day}
                  </div>
                ))}
                {Array.from({ length: days.offset }).map((_, index) => (
                  <div key={`empty-${index}`} className="min-h-[7rem] rounded-tremor-default border border-slate-800/60 bg-slate-900/20" />
                ))}
                {days.items.map((day) => {
                  const events = eventsByDate[day.date] || [];
                  const isToday = day.date === calendar.today;
                  return (
                    <div key={day.date} className={`min-h-[7rem] rounded-tremor-default border p-2 ${isToday ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <span className={`text-sm font-semibold ${isToday ? 'text-emerald-200' : 'text-slate-200'}`}>{day.day}</span>
                        {events.length ? <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-300">{events.length}</span> : null}
                      </div>
                      <div className="space-y-1">
                        {events.slice(0, 3).map((event) => <EventPill key={event.id} event={event} />)}
                        {events.length > 3 ? <p className="text-[0.68rem] text-slate-500">+{events.length - 3} mas</p> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>

        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Title>Proximos eventos</Title>
              <Text>Ordenado por fecha real</Text>
            </div>
            <Badge color={nextEvents.length ? 'cyan' : 'emerald'}>{nextEvents.length || 'OK'}</Badge>
          </div>
          <div className="mt-4 grid gap-2">
            {nextEvents.length ? (
              nextEvents.map((event) => <EventRow key={event.id} event={event} />)
            ) : (
              <EmptyState>Sin eventos este mes.</EmptyState>
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

function CalendarMini({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 truncate font-mono text-sm font-semibold text-slate-100">{value}</p>
    </div>
  );
}

function EventPill({ event }: { event: CalendarEvent }) {
  const tone = eventTone(event.type);
  return (
    <div className={`min-w-0 rounded border px-2 py-1 ${tone.pill}`}>
      <div className="flex items-center gap-1.5">
        <EventIcon event={event} className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-[0.68rem] font-semibold">{event.title}</span>
      </div>
      {event.amount ? <p className="mt-0.5 truncate font-mono text-[0.68rem]">{formatMoney(event.amount, event.currency)}</p> : null}
    </div>
  );
}

function EventRow({ event }: { event: CalendarEvent }) {
  const tone = eventTone(event.type);
  return (
    <div className={`rounded-tremor-default border p-3 ${tone.row}`}>
      <div className="flex items-start gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-tremor-default ${tone.icon}`}>
          <EventIcon event={event} className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-100">{event.title}</p>
              <Text className="mt-0.5">{formatDate(event.date)}{event.description ? ` - ${event.description}` : ''}</Text>
            </div>
            {event.amount ? <span className="shrink-0 font-mono text-sm font-semibold text-slate-100">{formatMoney(event.amount, event.currency)}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventIcon({ event, className }: { event: CalendarEvent; className: string }) {
  if (event.type === 'deuda') return <RiMoneyDollarCircleLine className={className} aria-hidden="true" />;
  if (event.type === 'credito') return <RiBankCardLine className={className} aria-hidden="true" />;
  if (event.type === 'cierre') return <RiCalendarCheckLine className={className} aria-hidden="true" />;
  if (event.type === 'alerta') return <RiAlarmWarningLine className={className} aria-hidden="true" />;
  if (event.type === 'objetivo') return <RiTargetLine className={className} aria-hidden="true" />;
  return <RiFlagLine className={className} aria-hidden="true" />;
}

function eventTone(type: string) {
  if (type === 'deuda') {
    return {
      pill: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
      row: 'border-rose-500/25 bg-rose-500/10',
      icon: 'bg-rose-500/15 text-rose-200',
    };
  }
  if (type === 'credito') {
    return {
      pill: 'border-sky-500/30 bg-sky-500/10 text-sky-200',
      row: 'border-sky-500/25 bg-sky-500/10',
      icon: 'bg-sky-500/15 text-sky-200',
    };
  }
  if (type === 'cierre') {
    return {
      pill: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
      row: 'border-emerald-500/25 bg-emerald-500/10',
      icon: 'bg-emerald-500/15 text-emerald-200',
    };
  }
  if (type === 'alerta') {
    return {
      pill: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
      row: 'border-amber-500/25 bg-amber-500/10',
      icon: 'bg-amber-500/15 text-amber-200',
    };
  }
  if (type === 'objetivo') {
    return {
      pill: 'border-violet-500/30 bg-violet-500/10 text-violet-200',
      row: 'border-violet-500/25 bg-violet-500/10',
      icon: 'bg-violet-500/15 text-violet-200',
    };
  }
  return {
    pill: 'border-slate-700 bg-slate-900/60 text-slate-200',
    row: 'border-slate-800 bg-slate-900/40',
    icon: 'bg-slate-800 text-slate-200',
  };
}

function weeklyTone(status: string): { badge: Color; progress: Color; icon: string } {
  if (status === 'over') return { badge: 'rose', progress: 'rose', icon: 'bg-rose-500/15 text-rose-200' };
  if (status === 'tight') return { badge: 'amber', progress: 'amber', icon: 'bg-amber-500/15 text-amber-200' };
  if (status === 'empty') return { badge: 'slate', progress: 'slate', icon: 'bg-slate-800 text-slate-200' };
  return { badge: 'emerald', progress: 'emerald', icon: 'bg-emerald-500/15 text-emerald-200' };
}

function closureTone(status: string): Color {
  if (status === 'due') return 'amber';
  if (status === 'soon') return 'cyan';
  if (status === 'closed') return 'emerald';
  return 'slate';
}

function groupEventsByDate(events: CalendarEvent[]) {
  return events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
    if (!acc[event.date]) acc[event.date] = [];
    acc[event.date].push(event);
    return acc;
  }, {});
}

function calendarDays(calendar: FinancialCalendar) {
  const start = parseDate(calendar.start);
  const end = parseDate(calendar.end);
  const offset = (start.getUTCDay() + 6) % 7;
  const items: Array<{ date: string; day: number }> = [];

  for (let time = start.getTime(); time <= end.getTime(); time += 86400000) {
    const date = new Date(time);
    items.push({ date: dateKey(date), day: date.getUTCDate() });
  }

  return { offset, items };
}

function parseDate(value: string) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(year || 2026, (month || 1) - 1, day || 1));
}

function dateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function fallbackCalendar(data: DashboardData): FinancialCalendar {
  const monthKey = data.mesKey || '2026-05';
  return {
    monthKey,
    label: data.mes || 'Mes',
    start: `${monthKey}-01`,
    end: `${monthKey}-31`,
    today: data.updatedAt?.slice(0, 10) || `${monthKey}-01`,
    cycleStart: data.cycleStart || `${monthKey}-23`,
    cycleEnd: data.cycleEnd || `${monthKey}-22`,
    cycleClose: data.cierre?.closeDate || data.cycleEnd || `${monthKey}-23`,
    cycleRange: data.cycleRange || data.cierre?.range || monthKey,
    events: [],
    summary: { fijos: 0, deudas: 0, credito: 0, alertas: 0 },
  };
}

function fallbackWeeklyGoal(data: DashboardData): WeeklyGoal {
  const available = Math.max(data.dineroLibre?.availableToSpend || 0, 0);
  return {
    status: available > 0 ? 'ok' : 'empty',
    label: 'Objetivo semanal',
    range: data.cycleRange || '',
    start: data.cycleStart || '',
    end: data.cycleEnd || '',
    daysLeft: 1,
    target: available,
    spent: 0,
    remaining: available,
    over: 0,
    dailyRemaining: available,
    progressPct: 0,
    message: available > 0 ? `Puedes gastar hasta ${formatMoney(available)} esta semana.` : 'Sin datos suficientes para calcular la semana.',
  };
}
