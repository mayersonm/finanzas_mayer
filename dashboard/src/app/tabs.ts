import {
  CalendarIcon,
  CardIcon,
  CoinsIcon,
  DashboardIcon,
  FileListIcon,
  FundsIcon,
  LineChartIcon,
  ScaleIcon,
  SettingsIcon,
  SparklesIcon,
  WalletIcon,
} from '../components/common/AppIcons';
import type { DashboardTab } from '../types/dashboard';

export const tabs: DashboardTab[] = [
  { id: 'inicio', label: 'Inicio', icon: DashboardIcon },
  { id: 'movimientos', label: 'Movimientos', icon: FileListIcon },
  { id: 'compromisos', label: 'Compromisos', icon: CardIcon },
  { id: 'dinero', label: 'Dinero Libre', icon: CoinsIcon },
  { id: 'calendario', label: 'Calendario', icon: CalendarIcon },
  { id: 'patrimonio', label: 'Patrimonio', icon: ScaleIcon },
  { id: 'inversiones', label: 'Inversiones', icon: LineChartIcon },
  { id: 'ia', label: 'IA', icon: SparklesIcon },
  { id: 'analisis', label: 'Analisis', icon: FundsIcon },
  { id: 'metas', label: 'Metas', icon: WalletIcon },
  { id: 'configuracion', label: 'Config', icon: SettingsIcon },
];
