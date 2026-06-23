import type { ComponentType } from 'react';
import {
  RiBankCardLine,
  RiBookOpenLine,
  RiBriefcaseLine,
  RiBusLine,
  RiGamepadLine,
  RiHeartPulseLine,
  RiLightbulbLine,
  RiLineChartLine,
  RiMoneyDollarCircleLine,
  RiMore2Line,
  RiPriceTag3Line,
  RiShoppingBag3Line,
  RiShoppingCart2Line,
} from '@remixicon/react';

type IconType = ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;

export interface CategoryVisual {
  Icon: IconType;
  badge: string;
}

// Identidad visual por categoria: icono + clases de color (fondo translucido + texto).
const MAP: Record<string, CategoryVisual> = {
  supermercado: { Icon: RiShoppingCart2Line, badge: 'bg-lime-500/15 text-lime-300' },
  transporte: { Icon: RiBusLine, badge: 'bg-blue-500/15 text-blue-300' },
  servicios: { Icon: RiLightbulbLine, badge: 'bg-amber-500/15 text-amber-300' },
  entretenimiento: { Icon: RiGamepadLine, badge: 'bg-pink-500/15 text-pink-300' },
  salud: { Icon: RiHeartPulseLine, badge: 'bg-violet-500/15 text-violet-300' },
  ropa: { Icon: RiShoppingBag3Line, badge: 'bg-teal-500/15 text-teal-300' },
  educacion: { Icon: RiBookOpenLine, badge: 'bg-orange-500/15 text-orange-300' },
  salario: { Icon: RiMoneyDollarCircleLine, badge: 'bg-cyan-500/15 text-cyan-300' },
  freelance: { Icon: RiBriefcaseLine, badge: 'bg-fuchsia-500/15 text-fuchsia-300' },
  deudas: { Icon: RiBankCardLine, badge: 'bg-rose-500/15 text-rose-300' },
  inversion: { Icon: RiLineChartLine, badge: 'bg-emerald-500/15 text-emerald-300' },
  venta: { Icon: RiPriceTag3Line, badge: 'bg-sky-500/15 text-sky-300' },
  otro: { Icon: RiMore2Line, badge: 'bg-slate-500/15 text-slate-300' },
};

function normalize(value: string) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();
}

export function categoryVisual(cat: string): CategoryVisual {
  return MAP[normalize(cat)] || { Icon: RiMore2Line, badge: 'bg-slate-500/15 text-slate-300' };
}
