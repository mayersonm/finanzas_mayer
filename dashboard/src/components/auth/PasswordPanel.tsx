import type { FormEvent } from 'react';

export function PasswordPanel({
  currentPassword,
  newPassword,
  confirmPassword,
  error,
  success,
  loading,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSubmit,
  onClose,
}: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  error: string;
  success: string;
  loading: boolean;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  return (
    <section className="mb-4 ml-auto max-w-xl rounded-tremor-default border border-slate-800 bg-slate-950/80 p-4 sm:mb-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100">Cambiar clave</h2>
          <p className="mt-1 text-sm text-slate-400">Usa minimo 12 caracteres para la nueva clave.</p>
        </div>
        <button type="button" className="rounded-tremor-default border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:bg-slate-900" onClick={onClose}>
          Cerrar
        </button>
      </div>

      <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
        <input
          autoComplete="current-password"
          type="password"
          value={currentPassword}
          onChange={(event) => onCurrentPasswordChange(event.target.value)}
          placeholder="Clave actual"
          className="h-10 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
        />
        <input
          autoComplete="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          placeholder="Nueva clave"
          className="h-10 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
        />
        <input
          autoComplete="new-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          placeholder="Repetir nueva clave"
          className="h-10 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
        />
        {error ? (
          <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {success}
          </div>
        ) : null}
        <button
          type="submit"
          className="h-11 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
          disabled={loading}
        >
          {loading ? 'Guardando...' : 'Guardar clave'}
        </button>
      </form>
    </section>
  );
}
