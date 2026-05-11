import type { FormEvent } from 'react';
import { Button, Card, Text, Title } from '@tremor/react';

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
    <Card className="mb-5 ml-auto max-w-xl rounded-tremor-default border-slate-800 bg-slate-950/80">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Title>Cambiar clave</Title>
          <Text>Usa minimo 12 caracteres para la nueva clave.</Text>
        </div>
        <Button type="button" variant="light" color="slate" onClick={onClose}>
          Cerrar
        </Button>
      </div>

      <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
        <input
          autoComplete="current-password"
          type="password"
          value={currentPassword}
          onChange={(event) => onCurrentPasswordChange(event.target.value)}
          placeholder="Clave actual"
          className="h-11 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
        />
        <input
          autoComplete="new-password"
          type="password"
          value={newPassword}
          onChange={(event) => onNewPasswordChange(event.target.value)}
          placeholder="Nueva clave"
          className="h-11 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
        />
        <input
          autoComplete="new-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => onConfirmPasswordChange(event.target.value)}
          placeholder="Repetir nueva clave"
          className="h-11 rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
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
        <Button type="submit" color="emerald" loading={loading} loadingText="Guardando...">
          Guardar clave
        </Button>
      </form>
    </Card>
  );
}
