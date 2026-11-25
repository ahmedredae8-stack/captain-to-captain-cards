// src/components/CosmeticFrame.tsx
import React from "react";
import { getTheme, LUXURY_THEMES } from "@/lib/luxuryCosmetics";

type Props = {
  themeId?: string;
  themeIndex?: number;
  size?: number;
  className?: string;
  children?: React.ReactNode;
};

export function CosmeticFrame({
  themeId,
  themeIndex = 0,
  size = 64,
  className = "",
  children,
}: Props) {
  const theme = themeId ? getTheme(themeId) : LUXURY_THEMES[themeIndex % LUXURY_THEMES.length]!;
  const idx = LUXURY_THEMES.indexOf(theme);
  const G = `url(#lux-g${idx >= 0 ? idx : 0})`;
  const c = theme.f;
  const o = theme.o;

  const ring = (k?: string) => {
    if (k === 'o') {
      return <polygon points="100,12 162,38 188,100 162,162 100,188 38,162 12,100 38,38" fill="none" stroke={c[1]} strokeWidth="6" />;
    }
    if (k === 'h') {
      return (
        <>
          <polygon points="100,22 168,61 168,139 100,178 32,139 32,61" fill="none" stroke={G} strokeWidth="13" />
          <polygon points="100,32 160,67 160,133 100,168 40,133 40,67" fill="none" stroke={c[0]} strokeWidth="2" />
        </>
      );
    }
    return (
      <>
        <circle cx="100" cy="100" r="76" fill="none" stroke={G} strokeWidth="13" />
        <circle cx="100" cy="100" r="82.5" fill="none" stroke={c[0]} strokeWidth="1.5" />
      </>
    );
  };

  const renderShape = () => {
    switch (o) {
      case "crown":
        return (
          <>
            {ring()}
            <circle className="sp" cx="100" cy="100" r="88" fill="none" stroke={G} strokeWidth="4" strokeDasharray=".1 9" strokeLinecap="round" />
            <path d="M70 30 L62 8 L84 22 L100 0 L116 22 L138 8 L130 30Z" fill={G} stroke="#7a4a00" strokeWidth="1.2" strokeLinejoin="round" />
          </>
        );
      case "neon":
        return (
          <>
            <polygon points="100,18 158,42 182,100 158,158 100,182 42,158 18,100 42,42" fill="none" stroke="#ff2bd6" strokeWidth="1.5" />
            {ring('o')}
            <polygon points="100,6 168,34 194,100 168,166 100,194 32,166 6,100 32,34" fill="none" stroke={G} strokeWidth="7" />
          </>
        );
      case "ruby":
        return (
          <>
            {ring()}
            <polygon points="100,10 109,22 100,34 91,22" fill={G} stroke="#f2b934" strokeWidth="1.5" />
            <polygon points="14,100 26,109 38,100 26,91" fill={G} stroke="#f2b934" strokeWidth="1.5" />
            <polygon points="186,100 174,109 162,100 174,91" fill={G} stroke="#f2b934" strokeWidth="1.5" />
            <polygon points="100,170 114,185 100,200 86,185" fill={G} stroke="#f2b934" strokeWidth="2" />
          </>
        );
      case "em":
        return (
          <>
            {ring('h')}
            <polygon points="100,5 118,20 100,35 82,20" fill={G} stroke="#f2b934" strokeWidth="2" />
            <polygon points="100,165 118,180 100,195 82,180" fill={G} stroke="#f2b934" strokeWidth="2" />
          </>
        );
      case "ice":
        return (
          <>
            <circle cx="100" cy="100" r="76" fill="none" stroke={G} strokeWidth="11" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
              <polygon key={a} points="100,6 108,30 100,44 92,30" fill={G} stroke={c[2]} strokeWidth="0.8" transform={`rotate(${a} 100 100)`} />
            ))}
          </>
        );
      case "cosmic":
        return (
          <>
            {ring()}
            <g className="sp" style={{ animationDuration: "16s" }}>
              <circle cx="172" cy="38" r="10" fill={G} stroke="#f5d0ff" />
              <ellipse cx="172" cy="38" rx="16" ry="4" fill="none" stroke="#f5d0ff" strokeWidth="1.5" transform="rotate(-25 172 38)" />
            </g>
          </>
        );
      case "fire":
        return (
          <>
            {ring()}
            {[-58, -29, 0, 29, 58].map((a) => (
              <path key={a} d="M100 4 C116 26 124 34 117 52 C112 45 107 43 100 49 C93 43 88 45 83 52 C76 34 84 26 100 4Z" fill={G} stroke="#ffb347" strokeWidth="1" transform={`rotate(${a} 100 100)`} />
            ))}
          </>
        );
      case "pink":
        return (
          <>
            {ring()}
            <path d="M40 56 C30 28 36 8 48 6 C64 12 82 26 90 40Z M160 56 C170 28 164 8 152 6 C136 12 118 26 110 40Z" fill={G} stroke="#fff" strokeWidth="1.5" />
            <circle cx="100" cy="188" r="7" fill={G} stroke="#fff" strokeWidth="1.5" />
          </>
        );
      default:
        return ring();
    }
  };

  return (
    <div className={`relative inline-flex items-center justify-center flex-none ${className}`} style={{ width: size, height: size }}>
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="fx" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={`lux-g${idx >= 0 ? idx : 0}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={c[0]} />
            <stop offset="0.45" stopColor={c[1]} />
            <stop offset="0.75" stopColor={c[2]} />
            <stop offset="1" stopColor={c[0]} />
          </linearGradient>
        </defs>
      </svg>
      <div className="relative z-10 overflow-hidden rounded-full flex items-center justify-center" style={{ width: `${Math.round(size * 0.68)}px`, height: `${Math.round(size * 0.68)}px` }}>
        {children}
      </div>
      <svg viewBox="0 0 200 200" className="absolute inset-0 pointer-events-none z-20 overflow-visible" style={{ width: size, height: size }}>
        <g filter="url(#fx)">{renderShape()}</g>
      </svg>
    </div>
  );
}
