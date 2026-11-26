// src/components/TopHud.tsx
import React, { useEffect, useState, useMemo, type ReactNode } from "react";
import { THEMES, clampTheme, type LuxuryTheme } from "@/lib/luxuryCosmetics";
import { useEquippedFrame } from "@/lib/equippedFrame";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import { CAPTAINS } from "@/lib/art";

export type TopUpKind = "gold" | "ruby" | "diamond";

type Props = {
  name?: string;
  title?: string;
  avatar?: number;
  avatarUrl?: string | null;
  avatarNode?: ReactNode;
  level?: number;
  xpPct?: number;
  rank?: string;
  coins?: number;
  rubies?: number;
  diamonds?: number;
  gold?: number;
  ruby?: number;
  diamond?: number;
  fishFound?: number;
  fishTotal?: number;
  frameIndex?: number;
  onAvatarClick?: () => void;
  onGiftClick?: () => void;
  onTopUp?: (kind: TopUpKind) => void;
  onOpenStore?: () => void;
  onOpenFrameShop?: () => void;
  onOpenRewards?: () => void;
  hasReward?: boolean;
  hasNewGift?: boolean;
};

const fmt = (n: number) => n.toLocaleString("en-US");

function LuxuryCapsule({
  icon,
  value,
  color,
  label,
  onPlus,
  isAction,
  onClick,
  badge,
}: {
  icon: string;
  value?: number;
  color: string;
  label: string;
  onPlus?: () => void;
  isAction?: boolean;
  onClick?: () => void;
  badge?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      role={isAction ? "button" : undefined}
      tabIndex={isAction ? 0 : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        height: 40,
        padding: onPlus ? "0 6px 0 10px" : "0 12px",
        borderRadius: 16,
        border: `2px solid ${color}`,
        color,
        background: "rgba(13, 21, 42, 0.88)",
        boxShadow: `inset 0 0 14px rgba(255,255,255,.08), 0 4px 16px rgba(0,0,0,0.5), 0 0 10px ${color}33`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        cursor: isAction ? "pointer" : "default",
        position: "relative",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
      className={isAction ? "hover:scale-105 active:scale-95" : ""}
    >
      <span style={{ fontSize: 17 }} aria-hidden="true">
        {icon}
      </span>
      {typeof value === "number" ? (
        <span style={{ fontSize: 13, fontWeight: 900, minWidth: 40, color: "#fff" }}>
          {fmt(value)}
        </span>
      ) : (
        <span style={{ fontSize: 13, fontWeight: 900, color: "#fff", whiteSpace: "nowrap" }}>
          {label}
        </span>
      )}
      {onPlus && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPlus();
          }}
          aria-label={`شحن ${label}`}
          style={{
            width: 22,
            height: 22,
            borderRadius: "50%",
            border: 0,
            cursor: "pointer",
            font: "900 15px/1 inherit",
            color: "#10131f",
            background: `linear-gradient(#fff,${color})`,
            boxShadow: `0 2px 6px rgba(0,0,0,0.4), 0 0 8px ${color}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          +
        </button>
      )}
      {badge && (
        <span className="absolute -top-1 -right-1 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500 border border-white" />
        </span>
      )}
    </div>
  );
}

export function TopHud({
  name = "القبطان",
  avatar = 0,
  avatarUrl = null,
  avatarNode,
  level = 1,
  xpPct,
  coins,
  rubies,
  diamonds,
  gold,
  ruby,
  diamond,
  fishFound,
  fishTotal,
  frameIndex: propFrameIndex,
  onAvatarClick,
  onGiftClick,
  onTopUp,
  onOpenStore,
  onOpenRewards,
  hasReward = true,
  hasNewGift,
}: Props) {
  const equippedHookIndex = useEquippedFrame();
  const [frameIndex, setFrameIndex] = useState<number>(() => propFrameIndex ?? equippedHookIndex);

  useEffect(() => {
    if (typeof propFrameIndex === "number") {
      setFrameIndex(propFrameIndex);
    } else {
      setFrameIndex(equippedHookIndex);
    }
  }, [propFrameIndex, equippedHookIndex]);

  useEffect(() => {
    const handler = (e: any) => {
      if (typeof e?.detail?.index === "number") {
        setFrameIndex(e.detail.index);
      }
    };
    window.addEventListener("c2c:frame_changed", handler);
    return () => window.removeEventListener("c2c:frame_changed", handler);
  }, []);

  const activeIndex = clampTheme(frameIndex);
  const theme: LuxuryTheme = useMemo(() => THEMES[activeIndex] ?? THEMES[0], [activeIndex]);

  const resolvedGold = gold ?? coins ?? 100000;
  const resolvedRuby = ruby ?? rubies ?? 500;
  const resolvedDiamond = diamond ?? diamonds ?? 150;
  const showGiftBadge = hasNewGift ?? hasReward;

  const R = 42;
  const C = 2 * Math.PI * R;
  const normalizedPct = typeof xpPct === "number" ? Math.min(100, Math.max(0, xpPct)) : null;

  const resolvedAvatarSrc = avatarUrl || CAPTAINS[Math.abs(avatar) % CAPTAINS.length];

  return (
    <header
      dir="rtl"
      className="fixed top-2 left-0 right-0 z-40 flex items-center justify-between px-2.5 sm:px-6 py-1.5 mx-auto max-w-7xl font-['Cairo'] select-none pointer-events-none"
    >
      {/* القسم الأيمن: صورة القبطان بارزة وكبيرة بالإطار المجهز مع شريط الاسم الفخم */}
      <div className="pointer-events-auto flex items-center">
        <div
          className="relative cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-95"
          onClick={onAvatarClick || onOpenStore}
          title="تغيير الإطار / إعدادات الحساب"
        >
          <div className="relative flex items-center justify-center">
            {/* إطار فاخر رئيسي بمقاس 78 بكسل ليكون واضحاً ومهيباً */}
            <CosmeticFrame themeIndex={activeIndex} size={78}>
              {avatarNode ?? (
                <img
                  src={resolvedAvatarSrc}
                  alt={name}
                  draggable={false}
                  className="w-full h-full object-cover rounded-full"
                />
              )}
            </CosmeticFrame>

            {normalizedPct !== null && (
              <svg
                viewBox="0 0 92 92"
                width={84}
                height={84}
                style={{
                  position: "absolute",
                  inset: -3,
                  pointerEvents: "none",
                  transform: "rotate(-90deg)",
                }}
                aria-hidden="true"
              >
                <circle cx={46} cy={46} r={R} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth={3} />
                <circle
                  cx={46}
                  cy={46}
                  r={R}
                  fill="none"
                  stroke={theme.f[0]}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeDasharray={C}
                  strokeDashoffset={C * (1 - normalizedPct / 100)}
                />
              </svg>
            )}

            <span
              className="absolute -bottom-1 -left-1 px-1.5 py-0.5 text-[10px] font-black rounded-full border border-amber-200 shadow-md"
              style={{
                background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`,
                color: theme.p[2] || "#000",
              }}
            >
              Lv {level}
            </span>
          </div>

          {/* شريط اسم القبطان متناسق وكبير بما يكفي */}
          <div
            className="inline-flex items-center justify-center gap-1.5 px-3 py-0.5 mt-0.5 text-[11px] font-black rounded-full shadow-lg border border-white/30 backdrop-blur-md transition-all duration-300"
            style={{
              background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`,
              color: theme.p[2] || "#000",
              boxShadow: `0 4px 12px rgba(0,0,0,0.6), 0 0 12px ${theme.gl}`,
              minWidth: "85px",
              maxWidth: "135px",
            }}
          >
            <span className="truncate">{name}</span>
            <span className="text-[9px] opacity-90 px-1 py-0.2 rounded bg-black/25 text-white">
              {theme.r}
            </span>
          </div>
        </div>
      </div>

      {/* القسم الأيسر: خانات الموارد الثلاث + زر المكافأة */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {/* خانة الذهب */}
        <LuxuryCapsule
          icon="🪙"
          value={resolvedGold}
          color="#ffd45a"
          label="الذهب"
          onPlus={onTopUp ? () => onTopUp("gold") : onOpenStore}
        />

        {/* خانة الياقوت */}
        <LuxuryCapsule
          icon="♦️"
          value={resolvedRuby}
          color="#ff6b8a"
          label="الياقوت"
          onPlus={onTopUp ? () => onTopUp("ruby") : onOpenStore}
        />

        {/* خانة الألماس */}
        <LuxuryCapsule
          icon="💎"
          value={resolvedDiamond}
          color="#5ee0ff"
          label="الألماس"
          onPlus={onTopUp ? () => onTopUp("diamond") : onOpenStore}
        />

        {/* خانة المكافأة */}
        <LuxuryCapsule
          icon="🎁"
          color="#fbbf24"
          label="المكافأة"
          isAction
          badge={showGiftBadge}
          onClick={onGiftClick || onOpenRewards}
        />

        {/* عداد الأسماك إن وجد */}
        {typeof fishFound === "number" && typeof fishTotal === "number" && (
          <div
            title="الأسماك المكتشفة"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border shadow-md backdrop-blur-sm text-xs sm:text-sm font-black text-white"
            style={{
              background: "rgba(13, 21, 42, 0.85)",
              borderColor: "rgba(255, 255, 255, 0.35)",
            }}
          >
            <span aria-hidden="true">🐟</span>
            <span>
              {fishFound}/{fishTotal}
            </span>
          </div>
        )}
      </div>
    </header>
  );
}

export default TopHud;
