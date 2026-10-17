// Flat cartoon illustrations (design Part 9): navy outlines (~3px), palette fills. Decoration only.

const INK = "var(--ink)";
const stroke = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

export function VhsTape({ label = "EVIDENCE", reelClass = "", className = "" }: { label?: string; reelClass?: string; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 200 120" className={className}>
      <rect x="6" y="10" width="188" height="100" rx="8" fill="var(--ink)" {...stroke} />
      <rect x="26" y="20" width="148" height="34" rx="3" fill="var(--paper)" {...stroke} />
      <text x="100" y="43" textAnchor="middle" style={{ font: "20px var(--nf-marker)" }} fill="var(--marker)">
        {label}
      </text>
      <rect x="52" y="62" width="96" height="38" rx="5" fill="var(--paper-shade)" {...stroke} />
      {[76, 124].map((cx) => (
        <g key={cx} className={reelClass} style={{ transformOrigin: `${cx}px 81px` }}>
          <circle cx={cx} cy="81" r="13" fill="var(--paper)" {...stroke} />
          <path d={`M${cx} 70 V92 M${cx - 11} 81 H${cx + 11}`} {...stroke} />
        </g>
      ))}
    </svg>
  );
}

export function CrtTv({ screen = "static", className = "" }: { screen?: "static" | "blank"; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 220 200" className={className}>
      <path d="M80 20 L110 48 L140 14" fill="none" {...stroke} />
      <rect x="10" y="48" width="200" height="140" rx="22" fill="var(--tangerine)" {...stroke} />
      <rect x="28" y="64" width="132" height="108" rx="18" fill={screen === "static" ? "var(--paper-shade)" : "var(--sky)"} {...stroke} />
      {screen === "static" &&
        Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M40 ${80 + i * 10} h${40 + ((i * 37) % 70)}`} stroke={INK} strokeOpacity="0.35" strokeWidth="3" />
        ))}
      <circle cx="186" cy="92" r="9" fill="var(--butter)" {...stroke} />
      <circle cx="186" cy="122" r="9" fill="var(--leaf)" {...stroke} />
      <path d="M40 188 l-8 10 M180 188 l8 10" {...stroke} />
    </svg>
  );
}

export function CrumpledPaper({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 150" className={className}>
      <path d="M30 40 L62 18 L104 26 L138 52 L140 98 L112 132 L66 136 L28 112 L18 72 Z" fill="var(--paper)" {...stroke} />
      <path d="M62 18 L70 60 L30 40 M104 26 L70 60 L138 52 M70 60 L96 96 L140 98 M96 96 L66 136 M70 60 L46 92 L28 112 M46 92 L18 72 M96 96 L112 132" fill="none" {...stroke} strokeWidth={2} />
      <path d="M118 30 l12 -14 M128 40 l18 -8" stroke="var(--marker)" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EvidenceBag({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 170" className={className}>
      <path d="M20 30 H140 L134 160 H26 Z" fill="var(--paper)" fillOpacity="0.7" {...stroke} />
      <rect x="14" y="16" width="132" height="18" rx="3" fill="var(--marker)" {...stroke} />
      <rect x="38" y="52" width="84" height="28" rx="2" fill="var(--butter)" {...stroke} />
      <text x="80" y="71" textAnchor="middle" style={{ font: "800 13px var(--nf-ui)", letterSpacing: "0.1em" }} fill={INK}>
        EVIDENCE
      </text>
      <rect x="44" y="96" width="72" height="44" rx="5" fill="var(--ink)" {...stroke} />
      <circle cx="64" cy="118" r="8" fill="var(--paper)" />
      <circle cx="96" cy="118" r="8" fill="var(--paper)" />
    </svg>
  );
}
