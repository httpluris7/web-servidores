/**
 * Iconos de línea del panel, en SVG inline (sin librería, como el resto del
 * proyecto). Trazo `currentColor` y grosor uniforme para que hereden el color
 * del contexto y encajen con el aire técnico del sitio.
 *
 * Server-safe: sin "use client", se pueden usar en Server Components.
 */

export type IconName =
  | "gauge"
  | "info"
  | "globe"
  | "layers"
  | "power"
  | "sliders"
  | "archive"
  | "clock"
  | "disk"
  | "shield"
  | "shieldGear"
  | "chart"
  | "network"
  | "terminal"
  | "refresh"
  | "bell"
  | "activity"
  | "camera"
  | "history"
  | "play"
  | "square"
  | "rotate"
  | "key"
  | "copy"
  | "check"
  | "eye"
  | "eyeOff"
  | "chevron"
  | "menu"
  | "arrowLeft";

const P: Record<IconName, React.ReactNode> = {
  gauge: <><path d="M12 13a3 3 0 1 0-3-3" /><path d="M12 13 15 9" /><path d="M4 18a9 9 0 1 1 16 0" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5" /><path d="M12 8h.01" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></>,
  power: <><path d="M12 4v7" /><path d="M7 7a7 7 0 1 0 10 0" /></>,
  sliders: <><path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" /><path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" /></>,
  archive: <><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" /><path d="M10 12h4" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  disk: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="12" cy="12" r="3" /><path d="M12 4v3" /></>,
  shield: <><path d="M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3Z" /></>,
  shieldGear: <><path d="M12 3 5 6v5c0 4 3 7 7 8 4-1 7-4 7-8V6l-7-3Z" /><circle cx="12" cy="11" r="2" /><path d="M12 7v1M12 14v1M15 11h-1M10 11H9" /></>,
  chart: <><path d="M4 4v16h16" /><path d="M7 15l3-4 3 2 4-6" /></>,
  network: <><circle cx="6" cy="18" r="2" /><circle cx="18" cy="18" r="2" /><circle cx="12" cy="5" r="2" /><path d="M12 7v4M12 11 6.5 16M12 11l5.5 5" /></>,
  terminal: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="m7 9 3 3-3 3" /><path d="M13 15h4" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14-4L4 9" /><path d="M4 5v4h4" /><path d="M4 13a8 8 0 0 0 14 4l2-2" /><path d="M20 19v-4h-4" /></>,
  bell: <><path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  activity: <><path d="M3 12h4l2 6 4-12 2 6h6" /></>,
  camera: <><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3" /></>,
  history: <><path d="M4 12a8 8 0 1 0 3-6L4 9" /><path d="M4 4v5h5" /><path d="M12 8v4l3 2" /></>,
  play: <><path d="m8 5 11 7-11 7V5Z" /></>,
  square: <><rect x="6" y="6" width="12" height="12" rx="1" /></>,
  rotate: <><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="m11 11 9-9" /><path d="m17 4 2 2" /><path d="m14 7 2 2" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></>,
  check: <><path d="m5 12 5 5 9-11" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="M3 3l18 18" /><path d="M10.6 6.2A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.3 4M6.3 8.3A17 17 0 0 0 2 12s3.5 7 10 7a10.8 10.8 0 0 0 3.7-.6" /><path d="M9.5 10.5a3 3 0 0 0 4 4" /></>,
  chevron: <><path d="m6 9 6 6 6-6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  arrowLeft: <><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></>,
};

export function Icon({
  name,
  className,
  size = 18,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {P[name]}
    </svg>
  );
}
