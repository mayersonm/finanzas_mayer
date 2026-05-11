import {
  Badge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@tremor/react';
import { formatDate, formatMoney } from '../../lib/formatters';
import type { Transaction } from '../../types/dashboard';
import { EmptyState } from '../common/EmptyState';

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) return <EmptyState>Sin movimientos registrados.</EmptyState>;

  return (
    <Table className="mt-4">
      <TableHead>
        <TableRow>
          <TableHeaderCell>Fecha</TableHeaderCell>
          <TableHeaderCell>Detalle</TableHeaderCell>
          <TableHeaderCell>Categoria</TableHeaderCell>
          <TableHeaderCell className="text-right">Monto</TableHeaderCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {transactions.map((tx, index) => {
          const isIncome = tx.tipo === 'ingreso';

          return (
            <TableRow key={tx.id || `${tx.fecha}-${tx.desc}-${index}`}>
              <TableCell>
                <div className="whitespace-nowrap">
                  <p className="text-slate-200">{formatDate(tx.fecha)}</p>
                  <p className="text-xs text-slate-500">{tx.hora || '00:00'}</p>
                </div>
              </TableCell>
              <TableCell>
                <div className="min-w-[12rem]">
                  <p className="font-semibold text-slate-100">{tx.desc}</p>
                  <Badge className="mt-1" color={isIncome ? 'emerald' : 'rose'}>
                    {tx.tipo}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="capitalize">{tx.cat}</TableCell>
              <TableCell className={`text-right font-mono font-semibold ${isIncome ? 'text-emerald-300' : 'text-rose-300'}`}>
                {isIncome ? '+' : '-'}
                {formatMoney(tx.monto)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
