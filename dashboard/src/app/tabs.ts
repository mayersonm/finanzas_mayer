import {
  RiBankCardLine,
  RiDashboardLine,
  RiFileList3Line,
  RiFundsBoxLine,
  RiSettings3Line,
  RiWallet3Line,
} from '@remixicon/react';
import type { DashboardTab } from '../types/dashboard';

export const tabs: DashboardTab[] = [
  { id: 'inicio', label: 'Inicio', icon: RiDashboardLine },
  { id: 'movimientos', label: 'Movimientos', icon: RiFileList3Line },
  { id: 'compromisos', label: 'Compromisos', icon: RiBankCardLine },
  { id: 'analisis', label: 'Analisis', icon: RiFundsBoxLine },
  { id: 'metas', label: 'Metas', icon: RiWallet3Line },
  { id: 'configuracion', label: 'Config', icon: RiSettings3Line },
];
