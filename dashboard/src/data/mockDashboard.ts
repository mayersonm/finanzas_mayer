import type { DashboardData } from '../types/dashboard';

export const MOCK_DASHBOARD: DashboardData = {
  balance: 5350,
  ingresos: 6500,
  gastos: 1150,
  ingresosMes: 6500,
  gastosMes: 1150,
  balanceMes: 5350,
  movimientos: 12,
  mes: 'Mayo',
  mesKey: '2026-05',
  transacciones: [
    { fecha: '2026-05-08', hora: '09:00', tipo: 'ingreso', desc: 'Salario', cat: 'salario', monto: 6500 },
    { fecha: '2026-05-08', hora: '13:20', tipo: 'gasto', desc: 'Almuerzo', cat: 'comida', monto: 60 },
    { fecha: '2026-05-07', hora: '18:30', tipo: 'gasto', desc: 'Taxi', cat: 'transporte', monto: 35 },
    { fecha: '2026-05-06', hora: '20:10', tipo: 'gasto', desc: 'Internet', cat: 'servicios', monto: 120 },
    { fecha: '2026-05-04', hora: '21:00', tipo: 'gasto', desc: 'Netflix', cat: 'entretenimiento', monto: 45 },
  ],
  categorias: [
    { cat: 'Comida', monto: 420, color: '#22c55e' },
    { cat: 'Servicios', monto: 320, color: '#f59e0b' },
    { cat: 'Transporte', monto: 210, color: '#3b82f6' },
    { cat: 'Entretenimiento', monto: 120, color: '#ec4899' },
    { cat: 'Salud', monto: 80, color: '#8b5cf6' },
  ],
  meses: [
    { mes: 'Dic', key: '2025-12', ingresos: 4200, gastos: 2800 },
    { mes: 'Ene', key: '2026-01', ingresos: 4500, gastos: 3100 },
    { mes: 'Feb', key: '2026-02', ingresos: 5000, gastos: 2600 },
    { mes: 'Mar', key: '2026-03', ingresos: 4800, gastos: 3400 },
    { mes: 'Abr', key: '2026-04', ingresos: 5200, gastos: 2900 },
    { mes: 'May', key: '2026-05', ingresos: 6500, gastos: 1150 },
  ],
  presupuestos: [
    { cat: 'Comida', limite: 500, gasto: 420 },
    { cat: 'Servicios', limite: 350, gasto: 320 },
    { cat: 'Transporte', limite: 300, gasto: 210 },
  ],
  fijos: [
    { nombre: 'Alquiler', monto: 1500, cat: 'Servicios', color: '#f59e0b', estado: 'pendiente' },
    { nombre: 'Internet', monto: 120, cat: 'Servicios', color: '#f59e0b', estado: 'pagado', pagadoMes: true },
  ],
  gastosReales: {
    totalFijos: 1620,
    totalPresupuesto: 950,
    total: 2570,
  },
  metas: [
    { nombre: 'Viaje', objetivo: 3000, ahorrado: 1200 },
    { nombre: 'Laptop', objetivo: 5000, ahorrado: 800 },
  ],
  emailConfig: {
    configured: true,
    daily: 'ma***@gmail.com',
    monthly: 'ma***@gmail.com',
    yearly: 'ma***@gmail.com',
  },
  source: 'demo',
};
