import type { FormEvent } from 'react';
import { ShieldIcon } from '../common/AppIcons';

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
  return (
    <main className="grid min-h-screen place-items-center px-3 py-5 sm:px-4 sm:py-8">
      <section className="w-full max-w-md rounded-tremor-default border border-slate-800 bg-slate-950/80 p-5 shadow-2xl shadow-black/30 sm:p-6">
        <div className="mb-5 flex items-center justify-between gap-3 sm:mb-6 sm:gap-4">
          <div className="grid h-11 w-11 place-items-center rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 text-sm font-black text-emerald-200 sm:h-12 sm:w-12">
            MF
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">D1 en vivo</span>
            <span className="rounded-full bg-cyan-500/15 px-2.5 py-1 text-xs font-semibold text-cyan-200">Privado</span>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-200">
          <ShieldIcon className="h-4 w-4" aria-hidden="true" />
          Acceso seguro
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-100 sm:text-2xl">Mayeson Finanzas</h1>
        <p className="mt-2 text-sm text-slate-400">Dashboard personal para revisar gastos, compromisos y metas.</p>

        <form className="mt-6 space-y-4 sm:mt-7" onSubmit={onSubmit}>
          {!requires2fa ? (
            <>
              <label className="block text-sm font-semibold text-slate-200" htmlFor="email">
                Usuario
              </label>
              <input
                id="email"
                autoComplete="username"
                autoFocus
                type="email"
                value={email}
                onChange={(event) => onEmailChange(event.target.value)}
                placeholder="tu correo"
                className="block h-10 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
              />
              <label className="block text-sm font-semibold text-slate-200" htmlFor="password">
                Clave privada
              </label>
              <input
                id="password"
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Ingresa tu clave"
                className="block h-10 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
              />
            </>
          ) : (
            <>
              <div className="rounded-tremor-default border border-emerald-500/25 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                Clave correcta. Ingresa el codigo de tu app 2FA para terminar.
              </div>
              <label className="block text-sm font-semibold text-slate-200" htmlFor="otpCode">
                Codigo 2FA
              </label>
              <input
                id="otpCode"
                autoComplete="one-time-code"
                autoFocus
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={(event) => onOtpCodeChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                className="block h-11 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-center text-lg font-semibold tracking-[0.25em] text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
              />
            </>
          )}
          {error ? (
            <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <button
            className="h-11 w-full rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={requires2fa ? otpCode.trim().length !== 6 || loading : !email.trim() || !password.trim() || loading}
          >
            {loading ? 'Validando...' : requires2fa ? 'Validar 2FA' : 'Entrar'}
          </button>
          {requires2fa ? (
            <button
              type="button"
              className="h-10 w-full rounded-tremor-default border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
              onClick={onReset2fa}
            >
              Cambiar usuario
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}
