import { cn } from '@/lib/utils';

export type NovaHeroAvatarProps = {
  className?: string;
};

export function NovaHeroAvatar({ className }: NovaHeroAvatarProps) {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="Assistant NOVA"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('h-full w-full', className)}
    >
      <defs>
        <linearGradient
          id="nova-hero-body"
          x1="20"
          y1="12"
          x2="100"
          y2="110"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4d97ff" />
          <stop offset="0.55" stopColor="#1677ff" />
          <stop offset="1" stopColor="#071552" />
        </linearGradient>
        <radialGradient
          id="nova-hero-glow"
          cx="0.32"
          cy="0.22"
          r="0.85"
        >
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <filter
          id="nova-hero-shadow"
          x="-40%"
          y="-40%"
          width="180%"
          height="180%"
        >
          <feDropShadow
            dx="0"
            dy="5"
            stdDeviation="5"
            floodColor="#071552"
            floodOpacity="0.28"
          />
        </filter>
      </defs>

      {/* soft halo backdrop */}
      <circle cx="60" cy="60" r="54" fill="#eaf3ff" opacity="0.55" />

      {/* glossy 3D body */}
      <rect
        x="16"
        y="12"
        width="88"
        height="96"
        rx="34"
        fill="url(#nova-hero-body)"
        filter="url(#nova-hero-shadow)"
      />
      <rect x="16" y="12" width="88" height="96" rx="34" fill="url(#nova-hero-glow)" />

      {/* specular highlight */}
      <ellipse
        cx="42"
        cy="34"
        rx="21"
        ry="12"
        fill="#ffffff"
        opacity="0.28"
        transform="rotate(-20 42 34)"
      />

      {/* friendly eyes */}
      <ellipse
        cx="50"
        cy="58"
        rx="8"
        ry="9.5"
        fill="#ffffff"
        transform="rotate(-8 50 58)"
      />
      <ellipse
        cx="70"
        cy="58"
        rx="8"
        ry="9.5"
        fill="#ffffff"
        transform="rotate(8 70 58)"
      />
      <circle cx="51" cy="59.5" r="3.4" fill="#071552" />
      <circle cx="69" cy="59.5" r="3.4" fill="#071552" />
      <circle cx="52.4" cy="58" r="1.2" fill="#ffffff" />
      <circle cx="70.4" cy="58" r="1.2" fill="#ffffff" />

      {/* soft blush */}
      <ellipse cx="39" cy="71" rx="6" ry="4" fill="#ffffff" opacity="0.18" />
      <ellipse cx="81" cy="71" rx="6" ry="4" fill="#ffffff" opacity="0.18" />

      {/* warm smile */}
      <path
        d="M47 74.5c4.5 5.5 13 7.5 20 4.5 3-1.5 5-3.5 6.5-6"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />

      {/* NOVA sparkle accent */}
        <path
          d="M97 24l1.6 4.4 4.4 1.6-4.4 1.6L97 36l-1.6-4.4L91 30l4.4-1.6z"
          fill="#ffffff"
          opacity="0.95"
        />
    </svg>
  );
}
