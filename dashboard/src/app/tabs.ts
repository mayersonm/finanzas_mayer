import {
  RiBankCardLine,
  RiCalendarLine,
  RiCoinsLine,
  RiDashboardLine,
  RiFileList3Line,
  RiFundsBoxLine,
  RiLineChartLine,
  RiScales3Line,
  RiSettings3Line,
  RiWallet3Line,
} from '@remixicon/react';
import type { DashboardTab } from '../types/dashboard';

export const tabs: DashboardTab[] = [
  { id: 'inicio', label: 'Inicio', icon: RiDashboardLine },
  { id: 'movimientos', label: 'Movimientos', icon: RiFileList3Line },
  { id: 'compromisos', label: 'Compromisos', icon: RiBankCardLine },
  { id: 'dinero', label: 'Dinero Libre', icon: RiCoinsLine },
  { id: 'calendario', label: 'Calendario', icon: RiCalendarLine },
  { id: 'patrimonio', label: 'Patrimonio', icon: RiScales3Line },
  { id: 'inversiones', label: 'Inversiones', icon: RiLineChartLine },
  { id: 'analisis', label: 'Analisis', icon: RiFundsBoxLine },
  { id: 'metas', label: 'Metas', icon: RiWallet3Line },
  { id: 'configuracion', label: 'Config', icon: RiSettings3Line },
];
