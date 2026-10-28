import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function base(size = 18, props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    ...props,
  };
}

/** Marken-Icon: versetzte Parallelogramme (stilisierter Blitz) */
export function BrandIcon({ size = 22, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...rest}>
      <path d="M13.4 1.6 L5.2 12.4 L10.6 12.4 L8.2 22.4 L16.9 10.2 L11.3 10.2 L14.6 1.6 Z" fillOpacity="0.95" />
      <path d="M19.2 4.2 L15.9 8.6 L18.4 8.6 L16.3 14.6 L21.2 7.4 L18.4 7.4 Z" fillOpacity="0.55" />
    </svg>
  );
}

export function PlusIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, rest)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function BulbIcon({ size = 18, filled = false, ...rest }: P & { filled?: boolean }) {
  if (filled) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...rest}>
        <path d="M12 2a7.5 7.5 0 0 0-4.6 13.4c.6.5 1 1.2 1.1 2l.1.6h6.8l.1-.6c.1-.8.5-1.5 1.1-2A7.5 7.5 0 0 0 12 2Z" />
        <path d="M9.5 20h5v1a1.5 1.5 0 0 1-1.5 1.5h-2A1.5 1.5 0 0 1 9.5 21v-1Z" />
      </svg>
    );
  }
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <path d="M9 18h6" />
      <path d="M10 21h4" />
      <path d="M12 3a6.5 6.5 0 0 0-4 11.6c.6.5 1 1.2 1.1 1.9l.1.5h5.6l.1-.5c.1-.7.5-1.4 1.1-1.9A6.5 6.5 0 0 0 12 3Z" />
    </svg>
  );
}

export function CubeIcon({ size = 14, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.6, ...rest })}>
      <path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9L12 2.5Z" />
      <path d="M3 7.5l9 5 9-5" />
      <path d="M12 12.5v9" />
    </svg>
  );
}

export function ChevronDownIcon({ size = 12, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 2.2, ...rest })}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ArrowUpIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 2.2, ...rest })}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );
}

export function StopIcon({ size = 16, ...rest }: P) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" {...rest}>
      <rect x="6" y="6" width="12" height="12" rx="2.5" />
    </svg>
  );
}

export function MicIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, rest)}>
      <rect x="9" y="2.5" width="6" height="11.5" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3.5" />
    </svg>
  );
}

export function SpeakerIcon({ size = 16, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <path d="M11 5 6.5 9H3v6h3.5L11 19V5Z" />
      <path d="M15 9a4.2 4.2 0 0 1 0 6" />
      <path d="M17.5 6.5a8 8 0 0 1 0 11" />
    </svg>
  );
}

export function CopyIcon({ size = 16, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function CheckIcon({ size = 16, ...rest }: P) {
  return (
    <svg {...base(size, rest)}>
      <path d="m4.5 12.5 5 5 10-11" />
    </svg>
  );
}

export function XIcon({ size = 16, ...rest }: P) {
  return (
    <svg {...base(size, rest)}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function TrashIcon({ size = 16, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <path d="M3 6h18" />
      <path d="M8 6V4a1.5 1.5 0 0 1 1.5-1.5h5A1.5 1.5 0 0 1 16 4v2" />
      <path d="M5.5 6 6.6 20a2 2 0 0 0 2 1.9h6.8a2 2 0 0 0 2-1.9L18.5 6" />
      <path d="M10 10.5v6M14 10.5v6" />
    </svg>
  );
}

export function GearIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.4 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.4-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1Z" />
    </svg>
  );
}

export function GraphIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="17" r="2.5" />
      <circle cx="12" cy="5.5" r="2.5" />
      <path d="M7.3 15.9 10.7 8M13.4 7.5l3.5 7.3M8.5 17.4l7-.2" />
    </svg>
  );
}

export function NoteIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <path d="M14 2.5H6.5A2 2 0 0 0 4.5 4.5v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8L14 2.5Z" />
      <path d="M14 2.5V8h5.5" />
      <path d="M9 13h6M9 16.5h4" />
    </svg>
  );
}

export function ImageIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="9" cy="9" r="1.8" />
      <path d="m3.5 17.5 5-5 4 4 3.5-3.5 4.5 4.5" />
    </svg>
  );
}

export function CameraIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <path d="M4 7.5h2.6l1.6-2.4A1.6 1.6 0 0 1 9.5 4.3h5a1.6 1.6 0 0 1 1.3.8l1.6 2.4H20a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 19.5H4A1.5 1.5 0 0 1 2.5 18V9A1.5 1.5 0 0 1 4 7.5Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export function KeyIcon({ size = 18, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <circle cx="8" cy="14" r="4.5" />
      <path d="m11.2 10.8 8-8M17 5.5l2.5 2.5M14.5 8 17 10.5" />
    </svg>
  );
}

export function MenuIcon({ size = 20, ...rest }: P) {
  return (
    <svg {...base(size, rest)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function RefreshIcon({ size = 14, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <path d="M20 11a8 8 0 1 0-2.2 6.3" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}

export function PencilIcon({ size = 16, ...rest }: P) {
  return (
    <svg {...base(size, { strokeWidth: 1.8, ...rest })}>
      <path d="M17 3.5a2.1 2.1 0 0 1 3 3L8 18.5l-4 1 1-4L17 3.5Z" />
    </svg>
  );
}
