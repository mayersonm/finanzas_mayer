import { useState, type FormEvent } from 'react';
import { RiEyeLine, RiEyeOffLine } from '@remixicon/react';
import { FundsIcon, ShieldIcon, SparklesIcon, WalletIcon } from '../common/AppIcons';

const FEATURES = [
  { icon: WalletIcon, title: 'Caja y compromisos', desc: 'Saldo real, fijos y deudas en un solo lugar.' },
  { icon: FundsIcon, title: 'Patrimonio e inversiones', desc: 'Sigue tu valor neto y tus cortes en el tiempo.' },
  { icon: SparklesIcon, title: 'Asesor con IA', desc: 'Decisiones de gasto y ahorro segun tu ciclo.' },
];

export function LoginScreen({
  email,
  password,
  otpCode,
  requires2fa,
  error,
  loading,
  onEmailChange,
  onPasswordChange,
  onOtpCodeChange,
  onReset2fa,
  onSubmit,
}: {
  email: string;
  password: string;
  otpCode: string;
  requires2fa: boolean;
  error: string;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onOtpCodeChange: (value: string) => void;
  onReset2fa: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const canSubmit = requires2fa ? otpCode.trim().length === 6 && !loading : Boolean(email.trim() && password.trim()) && !loading;

  return (
    <main className="grid min-h-screen w-full bg-slate-950 lg:grid-cols-2">
      {/* Panel de marca */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-emerald-600/25 via-slate-950 to-cyan-600/20 p-10 lg:flex xl:p-12">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" aria-hidden="true" />

        <div className="relative flex w-full flex-col justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 text-base font-black text-emerald-200 shadow-lg shadow-emerald-500/10">
              MF
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Mayeson</p>
              <p className="text-lg font-bold text-slate-100">Finanzas</p>
            </div>
          </div>

          <div className="my-10 max-w-md">
            <h2 className="text-3xl font-bold leading-tight text-slate-50 xl:text-4xl">
              Tu dinero, claro y bajo control.
            </h2>
            <p className="mt-4 text-base text-slate-300/90">
              Dashboard personal para revisar gastos, compromisos, patrimonio y metas con un cierre de ciclo inteligente.
            </p>

            <div className="mt-8 grid gap-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-3.5 backdrop-blur-sm">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{title}</p>
                    <p className="mt-0.5 text-sm text-slate-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Pill icon={<ShieldIcon className="h-3.5 w-3.5" aria-hidden="true" />}>Acceso seguro</Pill>
            <Pill>D1 en vivo</Pill>
            <Pill>Privado</Pill>
          </div>
        </div>
      </aside>

      {/* Panel de formulario */}
      <section className="flex items-center justify-center px-4 py-8 sm:px-6 sm:py-10">
        <div className="w-full max-w-md">
          {/* Marca compacta para movil */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/40 bg-emerald-500/15 text-sm font-black text-emerald-200">
              MF
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300/80">Mayeson</p>
              <p className="text-base font-bold text-slate-100">Finanzas</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
            <ShieldIcon className="h-4 w-4" aria-hidden="true" />
            {requires2fa ? 'Verificacion en dos pasos' : 'Acceso seguro'}
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-50 sm:text-3xl">
            {requires2fa ? 'Confirma tu identidad' : 'Bienvenido de vuelta'}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {requires2fa
              ? 'Ingresa el codigo de tu app de autenticacion para terminar.'
              : 'Inicia sesion para revisar tus finanzas.'}
          </p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            {!requires2fa ? (
              <>
                <Field label="Usuario" htmlFor="email">
                  <input
                    id="email"
                    autoComplete="username"
                    autoFocus
                    type="email"
                    value={email}
                    onChange={(event) => onEmailChange(event.target.value)}
                    placeholder="tu correo"
                    className="block h-12 w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  />
                </Field>

                <Field label="Clave privada" htmlFor="password">
                  <div className="relative">
                    <input
                      id="password"
                      autoComplete="current-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => onPasswordChange(event.target.value)}
                      placeholder="Ingresa tu clave"
                      className="block h-12 w-full rounded-xl border border-slate-700/80 bg-slate-900/60 px-4 pr-12 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Ocultar clave' : 'Mostrar clave'}
                      className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-800 hover:text-slate-200"
                    >
                      {showPassword ? <RiEyeOffLine className="h-5 w-5" /> : <RiEyeLine className="h-5 w-5" />}
                    </button>
                  </div>
                </Field>
              </>
            ) : (
              <>
                <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                  Clave correcta. Ingresa el codigo de tu app 2FA para terminar.
                </div>
                <Field label="Codigo 2FA" htmlFor="otpCode">
                  <input
                    id="otpCode"
                    autoComplete="one-time-code"
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="------"
                    className="block h-14 w-full rounded-xl border border-slate-700/80 bg-slate-900/60 text-center text-2xl font-semibold tracking-[0.5em] text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30"
                  />
                </Field>
              </>
            )}

            {error ? (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">
                {error}
              </div>
            ) : null}

            <button
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canSubmit}
            >
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                  Validando...
                </>
              ) : requires2fa ? 'Validar codigo' : 'Entrar'}
            </button>

            {requires2fa ? (
              <button
                type="button"
                className="h-11 w-full rounded-xl border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
                onClick={onReset2fa}
              >
                Cambiar usuario
              </button>
            ) : null}
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-200" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Pill({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-slate-200">
      {icon}
      {children}
    </span>
  );
}
