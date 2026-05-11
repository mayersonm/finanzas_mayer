import type { FormEvent } from 'react';
import { Badge, Button, Card, Text, Title } from '@tremor/react';
import { RiShieldKeyholeLine } from '@remixicon/react';

export function LoginScreen({
  password,
  error,
  loading,
  onPasswordChange,
  onSubmit,
}: {
  password: string;
  error: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <Card className="w-full max-w-md rounded-tremor-default border-slate-800 bg-slate-950/80 p-6 shadow-2xl shadow-black/30">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-tremor-default border border-emerald-500/30 bg-emerald-500/10 text-sm font-black text-emerald-200">
            MF
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Badge color="emerald">D1 en vivo</Badge>
            <Badge color="cyan">Privado</Badge>
          </div>
        </div>

        <Badge color="emerald" icon={RiShieldKeyholeLine}>
          Acceso seguro
        </Badge>
        <Title className="mt-4 text-2xl">Mayeson Finanzas</Title>
        <Text className="mt-2">Dashboard personal para revisar gastos, compromisos y metas.</Text>

        <form className="mt-7 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="password">
            Clave privada
          </label>
          <input
            id="password"
            autoComplete="current-password"
            autoFocus
            type="password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            placeholder="Ingresa tu clave"
            className="block h-11 w-full rounded-tremor-default border-slate-700 bg-slate-900 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500"
          />
          {error ? (
            <div className="rounded-tremor-default border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          ) : null}
          <Button className="w-full" color="emerald" loading={loading} loadingText="Validando..." disabled={!password.trim()}>
            Entrar
          </Button>
        </form>
      </Card>
    </main>
  );
}
