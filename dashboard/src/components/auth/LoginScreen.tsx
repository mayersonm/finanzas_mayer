import type { FormEvent } from 'react';
import { RiShieldKeyholeLine } from '@remixicon/react';

export function LoginScreen({
  password,
  email,
  name,
  mode,
  error,
  loading,
  onPasswordChange,
  onEmailChange,
  onNameChange,
  onModeChange,
  onGoogleLogin,
  onSubmit,
}: {
  password: string;
  email: string;
  name: string;
  mode: 'login' | 'register';
  error: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onModeChange: (value: 'login' | 'register') => void;
  onGoogleLogin: () => void;
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
          <RiShieldKeyholeLine className="h-4 w-4" />
          Acceso seguro
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-100 sm:text-2xl">Finanzas personales</h1>
        <p className="mt-2 text-sm text-slate-400">
          {mode === 'login' ? 'Entra con Google o con tu correo.' : 'Crea tu usuario y luego vincula Telegram con tu correo.'}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2 rounded-tremor-default border border-slate-800 bg-slate-900/50 p-1">
          <button type="button" className={`rounded-tremor-default px-3 py-2 text-sm font-semibold ${mode === 'login' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`} onClick={() => onModeChange('login')}>
            Login
          </button>
          <button type="button" className={`rounded-tremor-default px-3 py-2 text-sm font-semibold ${mode === 'register' ? 'bg-emerald-500 text-slate-950' : 'text-slate-300'}`} onClick={() => onModeChange('register')}>
            Registro
          </button>
        </div>

        <button
          type="button"
          className="mt-4 h-11 w-full rounded-tremor-default border border-slate-700 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
          onClick={onGoogleLogin}
        >
          Continuar con Google
        </button>

        <form className="mt-6 space-y-4 sm:mt-7" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="email">
            {mode === 'login' ? 'Correo o clave admin' : 'Correo'}
          </label>
          <input
            id="email"
            autoComplete="email"
            autoFocus
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder="tu@gmail.com"
            className="block h-10 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
          />
          {mode === 'register' ? (
            <>
              <label className="block text-sm font-semibold text-slate-200" htmlFor="name">
                Nombre
              </label>
              <input
                id="name"
                autoComplete="name"
                type="text"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Tu nombre"
                className="block h-10 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
              />
            </>
          ) : null}
          <label className="block text-sm font-semibold text-slate-200" htmlFor="password">
            Clave
          </label>
          <input
            id="password"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder={mode === 'register' ? 'Minimo 12 caracteres' : 'Ingresa tu clave'}
            className="block h-10 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
          />
          {error ? (
            <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <button
            className="h-11 w-full rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!password.trim() || loading}
          >
            {loading ? 'Validando...' : mode === 'register' ? 'Crear usuario' : 'Entrar'}
          </button>
          <p className="text-xs leading-5 text-slate-500">
            Para vincular Telegram: abre el bot y envia `perfil Tu Nombre {email || 'tu@gmail.com'}`.
          </p>
        </form>
      </section>
    </main>
  );
}
