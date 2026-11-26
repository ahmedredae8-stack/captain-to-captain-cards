// src/components/TopHud.tsx
import React, { useEffect, useState, useMemo, type CSSProperties, type ReactNode } from "react";
import { getEquippedFrame, getTheme, LuxuryTheme, THEMES, clampTheme } from "@/lib/luxuryCosmetics";
import { useEquippedFrame } from "@/lib/equippedFrame";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import { CaptainAvatar } from "@/components/GameSprite";

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
}: {
  icon: string;
  value: number;
  color: string;
  label: string;
  onPlus?: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        height: 42,
        padding: onPlus ? "0 6px 0 12px" : "0 12px",
        borderRadius: 16,
        border: `2px solid ${color}`,
        color,
        background: "rgba(15, 23, 42, 0.75)",
        boxShadow: "inset 0 0 14px rgba(255,255,255,.08)",
      }}
    >
      <span style={{ fontSize: 18 }} aria-hidden="true">
        {icon}
      </span>
      <span style={{ fontSize: 15, fontWeight: 900, minWidth: 44 }}>{fmt(value)}</span>
      {onPlus && (
        <button
          type="button"
          onClick={onPlus}
          aria-label={`شحن ${label}`}
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            border: 0,
            cursor: "pointer",
            font: "900 16px/1 inherit",
            color: "#10131f",
            background: `linear-gradient(#fff,${color})`,
          }}
        >
          +
        </button>
      )}
    </div>
  );
}

export function TopHud({
  name = "القبطان",
  title,
  avatar = 0,
  avatarUrl = null,
  avatarNode,
  level = 1,
  xpPct,
  rank = "أميرال الأسطول",
  coins = 0,
  rubies = 0,
  diamonds = 0,
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
  onOpenFrameShop,
  onOpenRewards,
  hasReward = true,
  hasNewGift,
}: Props) {
  const equippedHookIndex = useEquippedFrame();
  const [frameIndex, setFrameIndex] = useState<number>(() => propFrameIndex ?? getEquippedFrame() ?? equippedHookIndex);

  useEffect(() => {
    if (typeof propFrameIndex === "number") {
      setFrameIndex(propFrameIndex);
    } else {
      setFrameIndex(getEquippedFrame() ?? equippedHookIndex);
    }
  }, [propFrameIndex, equippedHookIndex]);

  useEffect(() => {
    setFrameIndex(propFrameIndex ?? getEquippedFrame() ?? equippedHookIndex);
    const handler = (e: any) => {
      if (typeof e.detail?.index === "number") {
        setFrameIndex(e.detail.index);
      }
    };
    window.addEventListener("c2c:frame_changed", handler);
    return () => window.removeEventListener("c2c:frame_changed", handler);
  }, [propFrameIndex, equippedHookIndex]);

  const activeIndex = clampTheme(frameIndex);
  const theme: LuxuryTheme = useMemo(() => getTheme(activeIndex) ?? THEMES[activeIndex], [activeIndex]);

  const resolvedGold = gold ?? coins;
  const resolvedRuby = ruby ?? rubies;
  const resolvedDiamond = diamond ?? diamonds;
  const showGiftBadge = hasNewGift ?? hasReward;

  const R = 36;
  const C = 2 * Math.PI * R;
  const normalizedPct = typeof xpPct === "number" ? Math.min(100, Math.max(0, xpPct)) : null;

  const barStyle: CSSProperties = {
    background: `linear-gradient(rgba(255,255,255,.1),rgba(255,255,255,0) 40%), linear-gradient(135deg, ${theme.c[0]}ee, ${theme.c[1]}ee)`,
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderColor: theme.bd,
    boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 22px ${theme.gl}, inset 0 1px 0 rgba(255,255,255,.2)`,
  };

  return (
    <header
      dir="rtl"
      className="fixed top-2.5 left-0 right-0 z-40 flex items-center justify-between px-3 sm:px-6 py-2 mx-auto max-w-7xl font-['Cairo'] select-none pointer-events-none"
    >
      {/* Right Section: Captain Profile Pill */}
      <div
        className="pointer-events-auto flex items-center gap-2.5 sm:gap-3.5 px-3 py-1.5 rounded-full border shadow-2xl backdrop-blur-md transition-all duration-300"
        style={barStyle}
      >
        <div
          className="relative cursor-pointer flex items-center justify-center"
          onClick={onAvatarClick || onOpenFrameShop || onOpenStore}
          title="تغيير الإطار / إعدادات الحساب"
        >
          <CosmeticFrame themeIndex={activeIndex} size={56}>
            {avatarNode ?? (
              <div className="w-full h-full bg-[#141b2d] flex items-center justify-center">
                <CaptainAvatar seed={avatar} url={avatarUrl} className="w-full h-full object-cover" />
              </div>
            )}
          </CosmeticFrame>

          {normalizedPct !== null && (
            <svg
              viewBox="0 0 80 80"
              width={64}
              height={64}
              style={{
                position: "absolute",
                inset: -4,
                pointerEvents: "none",
                transform: "rotate(-90deg)",
              }}
              aria-hidden="true"
            >
              <circle cx={40} cy={40} r={R} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth={3} />
              <circle
                cx={40}
                cy={40}
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
            className="absolute -bottom-1 -left-1 px-1.5 py-0.2 text-[9px] font-black rounded-full border border-amber-200"
            style={{
              background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`,
              color: theme.p[2],
            }}
          >
            Lv {level}
          </span>
        </div>

        <div className="flex flex-col text-right">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] sm:text-[15px] font-black tracking-wide text-white drop-shadow">
              {name}
            </span>
            <span
              className="text-[10px] sm:text-[11px] font-extrabold px-1.5 py-0.5 rounded shadow-sm"
              style={{
                background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`,
                color: theme.p[2],
              }}
            >
              {theme.r}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-300 opacity-90">
            {title || rank}
          </span>
        </div>
      </div>

      {/* Left Section: Resources Capsules & Action Buttons */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5 flex-wrap">
        {/* Gold Capsule */}
        <LuxuryCapsule
          icon="🪙"
          value={resolvedGold}
          color="#ffd45a"
          label="الذهب"
          onPlus={onTopUp ? () => onTopUp("gold") : onOpenStore}
        />

        {/* Rubies Capsule */}
        <LuxuryCapsule
          icon="♦️"
          value={resolvedRuby}
          color="#ff6b8a"
          label="الياقوت"
          onPlus={onTopUp ? () => onTopUp("ruby") : onOpenStore}
        />

        {/* Diamonds Capsule */}
        <LuxuryCapsule
          icon="💎"
          value={resolvedDiamond}
          color="#5ee0ff"
          label="الألماس"
          onPlus={onTopUp ? () => onTopUp("diamond") : onOpenStore}
        />

        {/* Fish Counter */}
        {typeof fishFound === "number" && typeof fishTotal === "number" && (
          <div
            title="الأسماك المكتشفة"
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border shadow-md backdrop-blur-sm text-xs sm:text-sm font-black text-white"
            style={{
              background: "rgba(15, 23, 42, 0.75)",
              borderColor: "rgba(255, 255, 255, 0.35)",
            }}
          >
            <span aria-hidden="true">🐟</span>
            <span>
              {fishFound}/{fishTotal}
            </span>
          </div>
        )}

        {/* Frame Shop Quick Button */}
        {onOpenFrameShop && (
          <button
            type="button"
            onClick={onOpenFrameShop}
            title="متجر الإطارات الفاخرة"
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-sky-400/50 bg-sky-950/60 hover:bg-sky-900/80 text-sky-200 transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            👑
          </button>
        )}

        {/* Rewards / Gift Button */}
        {(onGiftClick || onOpenRewards) && (
          <button
            type="button"
            onClick={onGiftClick || onOpenRewards}
            aria-label="المكافآت والهدايا"
            className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-amber-400/60 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            🎁
            {showGiftBadge && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}

export default TopHud;
