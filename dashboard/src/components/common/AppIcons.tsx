import type { SVGProps } from 'react';

export type AppIcon = (props: SVGProps<SVGSVGElement>) => JSX.Element;

function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export const DashboardIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M4 5h6v6H4z" />
    <path d="M14 5h6v4h-6z" />
    <path d="M14 13h6v6h-6z" />
    <path d="M4 15h6v4H4z" />
  </Icon>
);

export const FileListIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M7 4h8l3 3v13H7z" />
    <path d="M15 4v4h4" />
    <path d="M10 11h6" />
    <path d="M10 15h6" />
    <path d="M10 19h3" />
  </Icon>
);

export const CardIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h16v10H4z" />
    <path d="M4 10h16" />
    <path d="M7 15h4" />
  </Icon>
);

export const CoinsIcon: AppIcon = (props) => (
  <Icon {...props}>
    <ellipse cx="9" cy="7" rx="5" ry="3" />
    <path d="M4 7v4c0 1.7 2.2 3 5 3s5-1.3 5-3V7" />
    <path d="M10 17c.9 1 2.7 1.7 5 1.7 2.8 0 5-1.3 5-3v-4" />
    <path d="M14 10.5c2.8 0 5 1.3 5 3" />
  </Icon>
);

export const CalendarIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M6 4v3" />
    <path d="M18 4v3" />
    <path d="M4 8h16" />
    <path d="M5 6h14v14H5z" />
    <path d="M8 12h3" />
    <path d="M14 12h2" />
    <path d="M8 16h3" />
  </Icon>
);

export const ScaleIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M12 4v16" />
    <path d="M6 7h12" />
    <path d="M8 7l-4 7h8z" />
    <path d="M16 7l-4 7h8z" />
  </Icon>
);

export const LineChartIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M4 19h16" />
    <path d="M5 16l4-5 4 3 6-8" />
    <path d="M17 6h2v2" />
  </Icon>
);

export const FundsIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M4 17V7" />
    <path d="M4 17h16" />
    <path d="M7 14l3-4 4 2 4-6" />
    <path d="M17 6h2v2" />
  </Icon>
);

export const WalletIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M4 7h14a2 2 0 0 1 2 2v8H6a2 2 0 0 1-2-2z" />
    <path d="M16 12h4" />
    <path d="M7 7V5h9" />
  </Icon>
);

export const SettingsIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    <path d="M4 12h2" />
    <path d="M18 12h2" />
    <path d="M12 4v2" />
    <path d="M12 18v2" />
    <path d="M6.3 6.3l1.4 1.4" />
    <path d="M16.3 16.3l1.4 1.4" />
    <path d="M17.7 6.3l-1.4 1.4" />
    <path d="M7.7 16.3l-1.4 1.4" />
  </Icon>
);

export const RefreshIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M20 11a8 8 0 0 0-13.7-5.6L4 7.7" />
    <path d="M4 4v3.7h3.7" />
    <path d="M4 13a8 8 0 0 0 13.7 5.6L20 16.3" />
    <path d="M20 20v-3.7h-3.7" />
  </Icon>
);

export const DatabaseIcon: AppIcon = (props) => (
  <Icon {...props}>
    <ellipse cx="12" cy="5" rx="7" ry="3" />
    <path d="M5 5v6c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
    <path d="M5 11v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
  </Icon>
);

export const SaveIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M5 4h11l3 3v13H5z" />
    <path d="M8 4v6h7V4" />
    <path d="M8 20v-6h8v6" />
  </Icon>
);

export const LockIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M7 10V8a5 5 0 0 1 10 0v2" />
    <path d="M6 10h12v10H6z" />
    <path d="M12 14v2" />
  </Icon>
);

export const LogoutIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M10 5H5v14h5" />
    <path d="M14 8l4 4-4 4" />
    <path d="M18 12H9" />
  </Icon>
);

export const MoonIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M20 14.2A7.8 7.8 0 0 1 9.8 4a8 8 0 1 0 10.2 10.2z" />
  </Icon>
);

export const SunIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="M4.9 4.9l1.4 1.4" />
    <path d="M17.7 17.7l1.4 1.4" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="M4.9 19.1l1.4-1.4" />
    <path d="M17.7 6.3l1.4-1.4" />
  </Icon>
);

export const ShieldIcon: AppIcon = (props) => (
  <Icon {...props}>
    <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
    <path d="M9.5 12l1.7 1.7 3.4-3.7" />
  </Icon>
);
