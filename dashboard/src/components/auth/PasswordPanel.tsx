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
  twoFactorStatus,
  twoFactorSetup,
  twoFactorCode,
  twoFactorPassword,
  twoFactorLoading,
  twoFactorMessage,
  twoFactorError,
  onTwoFactorSetup,
  onTwoFactorEnable,
  onTwoFactorDisable,
  onTwoFactorCodeChange,
  onTwoFactorPasswordChange,
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
  twoFactorStatus: { enabled: boolean; pending: boolean } | null;
  twoFactorSetup: { secret: string; otpauthUrl: string } | null;
  twoFactorCode: string;
  twoFactorPassword: string;
  twoFactorLoading: boolean;
  twoFactorMessage: string;
  twoFactorError: string;
  onTwoFactorSetup: () => void;
  onTwoFactorEnable: () => void;
  onTwoFactorDisable: () => void;
  onTwoFactorCodeChange: (value: string) => void;
  onTwoFactorPasswordChange: (value: string) => void;
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

      <div className="mt-6 border-t border-slate-800 pt-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100">Doble factor 2FA</h3>
            <p className="mt-1 text-sm text-slate-400">
              {twoFactorStatus?.enabled ? 'Activo para el login del dashboard.' : 'Protege el login con codigo temporal.'}
            </p>
          </div>
          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${twoFactorStatus?.enabled ? 'bg-emerald-500/15 text-emerald-200' : 'bg-slate-800 text-slate-300'}`}>
            {twoFactorStatus?.enabled ? 'Activo' : 'Inactivo'}
          </span>
        </div>

        {twoFactorSetup ? (
          <div className="mt-4 grid gap-3 rounded-tremor-default border border-emerald-500/25 bg-emerald-500/10 p-3">
            <p className="text-sm font-semibold text-emerald-100">Agrega este secreto en Google Authenticator o Authy.</p>
            <div className="rounded-tremor-default border border-slate-700 bg-slate-900 p-3 font-mono text-xs text-slate-100 break-all">
              {twoFactorSetup.secret}
            </div>
            <details className="text-xs text-slate-400">
              <summary className="cursor-pointer font-semibold text-slate-200">URI otpauth</summary>
              <div className="mt-2 break-all rounded-tremor-default bg-slate-900 p-2">{twoFactorSetup.otpauthUrl}</div>
            </details>
          </div>
        ) : null}

        <div className="mt-4 grid gap-3">
          {twoFactorStatus?.enabled ? (
            <input
              autoComplete="current-password"
              type="password"
              value={twoFactorPassword}
              onChange={(event) => onTwoFactorPasswordChange(event.target.value)}
              placeholder="Clave actual para desactivar"
              className="h-10 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
            />
          ) : null}
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            value={twoFactorCode}
            onChange={(event) => onTwoFactorCodeChange(event.target.value)}
            placeholder={twoFactorStatus?.enabled ? 'Codigo 2FA actual' : 'Codigo para activar'}
            className="h-10 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500 sm:h-11"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {!twoFactorStatus?.enabled ? (
              <>
                <button type="button" className="h-10 rounded-tremor-default border border-slate-700 px-4 text-sm font-semibold text-slate-200 transition hover:bg-slate-900 disabled:opacity-60" disabled={twoFactorLoading} onClick={onTwoFactorSetup}>
                  Generar 2FA
                </button>
                <button type="button" className="h-10 rounded-tremor-default bg-emerald-500 px-4 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-60" disabled={twoFactorLoading || !twoFactorSetup || twoFactorCode.length !== 6} onClick={onTwoFactorEnable}>
                  Activar 2FA
                </button>
              </>
            ) : (
              <button type="button" className="h-10 rounded-tremor-default border border-rose-500/35 bg-rose-500/10 px-4 text-sm font-semibold text-rose-100 transition hover:bg-rose-500/15 disabled:opacity-60 sm:col-span-2" disabled={twoFactorLoading || !twoFactorPassword || twoFactorCode.length !== 6} onClick={onTwoFactorDisable}>
                Desactivar 2FA
              </button>
            )}
          </div>
        </div>

        {twoFactorMessage ? (
          <div className="mt-3 rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {twoFactorMessage}
          </div>
        ) : null}
        {twoFactorError ? (
          <div className="mt-3 rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {twoFactorError}
          </div>
        ) : null}
      </div>
    </section>
  );
}
