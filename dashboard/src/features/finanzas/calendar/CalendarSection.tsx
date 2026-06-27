import { useEffect, useMemo, useState } from 'react';
import {
  RiAlarmWarningLine,
  RiArrowLeftSLine,
  RiArrowRightSLine,
  RiBankCardLine,
  RiCalendarCheckLine,
  RiFlagLine,
  RiLoopLeftLine,
  RiMoneyDollarCircleLine,
  RiTargetLine,
} from '@remixicon/react';
import { Badge, Card, ProgressBar, Text, Title, type Color } from '@tremor/react';
import { apiRequest } from '../../../app/apiClient';
import { EmptyState } from '../../../components/common/EmptyState';
import { formatDate, formatMoney } from '../../../lib/formatters';
import type { CalendarEvent, DashboardData, FinancialCalendar, WeeklyGoal } from '../../../types/dashboard';

const WEEK_DAYS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

export function CalendarSection({ data, authToken, chatId }: { data: DashboardData; authToken?: string | null; chatId?: string }) {
  const baseCalendar = data.calendario || fallbackCalendar(data);
  const [selectedMonth, setSelectedMonth] = useState(baseCalendar.monthKey);
  const [historyCalendar, setHistoryCalendar] = useState<FinancialCalendar | null>(null);
  const [calendarCache, setCalendarCache] = useState<Record<string, FinancialCalendar>>({});
  const [loadingMonth, setLoadingMonth] = useState(false);
  const [monthError, setMonthError] = useState('');
  const calendar = historyCalendar?.monthKey === selectedMonth ? historyCalendar : baseCalendar;
  const weekly = selectedMonth === baseCalendar.monthKey ? data.objetivoSemanal || fallbackWeeklyGoal(data) : null;
  const closure = selectedMonth === baseCalendar.monthKey ? data.cierreAutomatico : undefined;
  const eventsByDate = groupEventsByDate(calendar.events);
  const dailyTotalsByDate = groupDailyTotals(calendar.dailyTotals || []);
  const days = calendarDays(calendar);
  const agenda = calendar.events.slice(0, 10);
  const monthSpend = calendar.summary.gastos ?? (calendar.dailyTotals || []).reduce((total, item) => total + Number(item.gastos || 0), 0);
  const isCurrentMonth = selectedMonth === currentMonthKey();
  const monthTitle = useMemo(() => monthLongLabel(selectedMonth), [selectedMonth]);

  useEffect(() => {
    if (selectedMonth === baseCalendar.monthKey) {
      setHistoryCalendar(null);
      setMonthError('');
      return;
    }

    if (!authToken) return;

    const cached = calendarCache[selectedMonth];
    if (cached) {
      setHistoryCalendar(cached);
      setMonthError('');
      return;
    }

    let cancelled = false;
    async function loadMonth() {
      setLoadingMonth(true);
      setMonthError('');
      try {
        const result = await apiRequest<{ calendario?: FinancialCalendar }>('calendar', {
          token: authToken,
          query: { calendar_month: selectedMonth, chat_id: chatId },
        });
        if (!result.calendario) throw new Error('No se pudo cargar el calendario');
        if (!cancelled) {
          setHistoryCalendar(result.calendario);
          setCalendarCache((current) => ({ ...current, [selectedMonth]: result.calendario as FinancialCalendar }));
        }
      } catch (error) {
        if (!cancelled) setMonthError(error instanceof Error ? error.message : 'No se pudo cargar el calendario');
      } finally {
        if (!cancelled) setLoadingMonth(false);
      }
    }

    void loadMonth();
    return () => {
      cancelled = true;
    };
  }, [authToken, baseCalendar.monthKey, calendarCache, chatId, selectedMonth]);

  return (
    <section className="grid gap-4">
      <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4 sm:!p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <Title>Calendario financiero</Title>
            <Text>{monthTitle} - ciclo {calendar.cycleRange}</Text>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MonthButton label="Anterior" onClick={() => setSelectedMonth((value) => addMonths(value, -1))}>
              <RiArrowLeftSLine className="h-4 w-4" aria-hidden="true" />
            </MonthButton>
            <button
              type="button"
              className="inline-flex h-10 min-w-[8rem] items-center justify-center rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 text-sm font-semibold text-slate-100"
              disabled
            >
              {loadingMonth ? 'Cargando' : monthLabelShort(selectedMonth)}
            </button>
            <MonthButton label="Siguiente" onClick={() => setSelectedMonth((value) => addMonths(value, 1))} disabled={isCurrentMonth}>
              <RiArrowRightSLine className="h-4 w-4" aria-hidden="true" />
            </MonthButton>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-tremor-default border border-emerald-500/35 bg-emerald-500/10 px-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15 disabled:cursor-default disabled:opacity-50"
              disabled={isCurrentMonth}
              onClick={() => setSelectedMonth(currentMonthKey())}
            >
              Hoy
            </button>
          </div>
        </div>
        {monthError ? (
          <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {monthError}
          </div>
        ) : null}
        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 text-sm sm:flex sm:flex-wrap sm:justify-end">
            <HeaderStat label="Gasto" value={formatMoney(monthSpend)} tone="rose" />
            <HeaderStat label="Fijos" value={calendar.summary.fijos} />
            <HeaderStat label="Deudas" value={calendar.summary.deudas} />
            <HeaderStat label="Credito" value={calendar.summary.credito} />
            <HeaderStat label="Alertas" value={calendar.summary.alertas} />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-3 sm:!p-4">
          <div className="overflow-x-auto">
            <div className="min-w-[44rem]">
              <div className="grid grid-cols-7 gap-1.5">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="rounded-tremor-default border border-slate-800 bg-slate-900/40 px-2 py-2 text-center text-xs font-semibold uppercase text-slate-500">
                    {day}
                  </div>
                ))}
                {Array.from({ length: days.offset }).map((_, index) => (
                  <div key={`empty-${index}`} className="min-h-[6.25rem] rounded-tremor-default border border-slate-800/60 bg-slate-900/20" />
                ))}
                {days.items.map((day) => (
                  <DayCell
                    key={day.date}
                    day={day}
                    daily={dailyTotalsByDate[day.date]}
                    events={eventsByDate[day.date] || []}
                    isToday={day.date === calendar.today}
                  />
                ))}
              </div>
            </div>
          </div>
        </Card>

        <aside className="grid gap-4">
          {weekly ? <WeeklyCard weekly={weekly} /> : <HistoryCard calendar={calendar} monthSpend={monthSpend} />}
          <ClosureCard closure={closure} calendar={calendar} data={data} />
          <AgendaCard events={agenda} />
        </aside>
      </div>
    </section>
  );
}

function MonthButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      className="inline-flex h-10 w-10 items-center justify-center rounded-tremor-default border border-slate-800 bg-slate-900/40 text-slate-100 transition hover:border-slate-700 hover:bg-slate-900/70 disabled:cursor-default disabled:opacity-40"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function HeaderStat({ label, value, tone = 'slate' }: { label: string; value: string | number; tone?: 'slate' | 'rose' }) {
  const valueClass = tone === 'rose' ? 'text-rose-200' : 'text-slate-100';
  return (
    <div className="rounded-tremor-default border border-slate-800 bg-slate-900/40 px-3 py-2">
      <p className="text-[0.68rem] font-medium uppercase text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate font-mono text-sm font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}

function DayCell({
  day,
  daily,
  events,
  isToday,
}: {
  day: { date: string; day: number };
  daily?: { gastos: number; ingresos: number; movimientos: number };
  events: CalendarEvent[];
  isToday: boolean;
}) {
  const hasSpend = Boolean(daily?.gastos);
  const hasIncome = Boolean(daily?.ingresos);

  return (
    <div className={`min-h-[6.25rem] rounded-tremor-default border p-2 transition ${isToday ? 'border-emerald-400/70 bg-emerald-500/10' : 'border-slate-800 bg-slate-900/40'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${isToday ? 'text-emerald-200' : 'text-slate-200'}`}>{day.day}</span>
        {events.length ? <span className="rounded-full bg-slate-800 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-300">{events.length}</span> : null}
      </div>

      <div className="mt-2 min-h-[2.1rem]">
        {hasSpend ? (
          <div className="rounded-tremor-default border border-rose-500/25 bg-rose-500/10 px-2 py-1">
            <p className="text-[0.64rem] font-semibold uppercase text-rose-200">Gasto</p>
            <p className="truncate font-mono text-[0.78rem] font-bold text-rose-200">{formatMoney(daily?.gastos || 0)}</p>
          </div>
        ) : (
          <p className="rounded-tremor-default border border-dashed border-slate-800/70 px-2 py-1.5 text-[0.68rem] text-slate-500">Sin gasto</p>
        )}
      </div>

      <div className="mt-2 flex min-h-4 items-center gap-1">
        {hasIncome ? <span className="h-2 w-2 rounded-full bg-emerald-400" title={`Ingreso ${formatMoney(daily?.ingresos || 0)}`} /> : null}
        {events.slice(0, 5).map((event) => (
          <span key={event.id} className={`h-2 w-2 rounded-full ${eventDot(event.type)}`} title={event.title} />
        ))}
      </div>
    </div>
  );
}

function WeeklyCard({ weekly }: { weekly: WeeklyGoal }) {
  const tone = weeklyTone(weekly.status);
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Title>Objetivo semanal</Title>
          <Text>{weekly.range}</Text>
        </div>
        <Badge color={tone.badge}>{weekly.status}</Badge>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-400">Usado</span>
          <span className="font-mono font-semibold text-slate-100">{formatMoney(weekly.spent)} / {formatMoney(weekly.target)}</span>
        </div>
        <ProgressBar className="mt-2" value={weekly.progressPct} color={tone.progress} />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <HeaderStat label="Queda" value={formatMoney(weekly.remaining)} />
        <HeaderStat label="Diario" value={formatMoney(weekly.dailyRemaining)} />
      </div>
      <Text className="mt-3">{weekly.message}</Text>
    </Card>
  );
}

function HistoryCard({ calendar, monthSpend }: { calendar: FinancialCalendar; monthSpend: number }) {
  const movementCount = (calendar.dailyTotals || []).reduce((total, item) => total + Number(item.movimientos || 0), 0);
  const income = (calendar.dailyTotals || []).reduce((total, item) => total + Number(item.ingresos || 0), 0);
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
      <Title>Historial del mes</Title>
      <Text>{calendar.start} - {calendar.end}</Text>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <HeaderStat label="Gastos" value={formatMoney(monthSpend)} tone="rose" />
        <HeaderStat label="Ingresos" value={formatMoney(income)} />
        <HeaderStat label="Mov." value={movementCount} />
        <HeaderStat label="Eventos" value={calendar.events.length} />
      </div>
    </Card>
  );
}

function ClosureCard({ closure, calendar, data }: { closure: DashboardData['cierreAutomatico']; calendar: FinancialCalendar; data: DashboardData }) {
  const color = closureTone(closure?.status || 'waiting');
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-tremor-default bg-emerald-500/15 text-emerald-200">
          <RiLoopLeftLine className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <Title>Regla de cierre</Title>
              <Text>{closure?.targetCycleRange || calendar.cycleRange}</Text>
            </div>
            <Badge color={color}>{closure?.status || 'waiting'}</Badge>
          </div>
          <p className="mt-3 text-sm font-semibold text-slate-100">{closure?.title || 'Cierre programado'}</p>
          <p className="mt-1 text-sm text-slate-400">{closure?.message || `Cierre ${formatDate(calendar.cycleClose)}.`}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <HeaderStat label="Ahorro" value={formatMoney(closure?.suggestedSavings || 0)} />
        <HeaderStat label="Gasto" value={formatMoney(closure?.availableToSpend || data.dineroLibre?.availableToSpend || 0)} />
      </div>
    </Card>
  );
}

function AgendaCard({ events }: { events: CalendarEvent[] }) {
  return (
    <Card className="rounded-tremor-default border-slate-800 bg-slate-950/70 !p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Title>Agenda</Title>
          <Text>Eventos del mes</Text>
        </div>
        <Badge color={events.length ? 'cyan' : 'emerald'}>{events.length || 'OK'}</Badge>
      </div>
      <div className="mt-4 grid gap-2">
        {events.length ? events.map((event) => <EventRow key={event.id} event={event} />) : <EmptyState>Sin eventos este mes.</EmptyState>}
      </div>
    </Card>
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

function eventDot(type: string) {
  if (type === 'deuda') return 'bg-rose-400';
  if (type === 'credito') return 'bg-sky-400';
  if (type === 'cierre') return 'bg-emerald-400';
  if (type === 'alerta') return 'bg-amber-400';
  if (type === 'objetivo') return 'bg-violet-400';
  return 'bg-slate-400';
}

function eventTone(type: string) {
  if (type === 'deuda') return { row: 'border-rose-500/25 bg-rose-500/10', icon: 'bg-rose-500/15 text-rose-200' };
  if (type === 'credito') return { row: 'border-sky-500/25 bg-sky-500/10', icon: 'bg-sky-500/15 text-sky-200' };
  if (type === 'cierre') return { row: 'border-emerald-500/25 bg-emerald-500/10', icon: 'bg-emerald-500/15 text-emerald-200' };
  if (type === 'alerta') return { row: 'border-amber-500/25 bg-amber-500/10', icon: 'bg-amber-500/15 text-amber-200' };
  if (type === 'objetivo') return { row: 'border-violet-500/25 bg-violet-500/10', icon: 'bg-violet-500/15 text-violet-200' };
  return { row: 'border-slate-800 bg-slate-900/40', icon: 'bg-slate-800 text-slate-200' };
}

function weeklyTone(status: string): { badge: Color; progress: Color } {
  if (status === 'over') return { badge: 'rose', progress: 'rose' };
  if (status === 'tight') return { badge: 'amber', progress: 'amber' };
  if (status === 'empty') return { badge: 'slate', progress: 'slate' };
  return { badge: 'emerald', progress: 'emerald' };
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

function groupDailyTotals(items: NonNullable<FinancialCalendar['dailyTotals']>) {
  return items.reduce<Record<string, { gastos: number; ingresos: number; movimientos: number }>>((acc, item) => {
    acc[item.date] = {
      gastos: Number(item.gastos || 0),
      ingresos: Number(item.ingresos || 0),
      movimientos: Number(item.movimientos || 0),
    };
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
    cycleStart: data.cycleStart || `${monthKey}-22`,
    cycleEnd: data.cycleEnd || `${monthKey}-22`,
    cycleClose: data.cierre?.closeDate || data.cycleEnd || `${monthKey}-22`,
    cycleRange: data.cycleRange || data.cierre?.range || monthKey,
    events: [],
    dailyTotals: [],
    summary: { fijos: 0, deudas: 0, credito: 0, alertas: 0, gastos: 0 },
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

function currentMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(monthKey: string, offset: number) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || new Date().getFullYear(), (month || 1) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabelShort(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1, 1));
  return date.toLocaleDateString('es-PE', { month: 'short', year: 'numeric' });
}

function monthLongLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(Date.UTC(year || 2026, (month || 1) - 1, 1));
  return date.toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
}
