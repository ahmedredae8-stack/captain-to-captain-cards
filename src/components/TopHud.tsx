// src/components/TopHud.tsx
import React, { useEffect, useState, useMemo } from "react";
import { getEquippedFrame, getTheme, LuxuryTheme } from "@/lib/luxuryCosmetics";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import { CaptainAvatar } from "@/components/GameSprite";

type Props = {
  name?: string;
  avatar?: number;
  avatarUrl?: string | null;
  level?: number;
  rank?: string;
  coins?: number;
  rubies?: number;
  diamonds?: number;
  onOpenStore?: () => void;
  onOpenFrameShop?: () => void;
  onOpenRewards?: () => void;
  hasReward?: boolean;
};

export function TopHud({
  name = "القبطان",
  avatar = 0,
  avatarUrl = null,
  level = 1,
  rank = "أميرال الأسطول",
  coins = 0,
  rubies = 0,
  diamonds = 0,
  onOpenStore,
  onOpenFrameShop,
  onOpenRewards,
  hasReward = true,
}: Props) {
  const [frameIndex, setFrameIndex] = useState<number>(() => getEquippedFrame());

  useEffect(() => {
    setFrameIndex(getEquippedFrame());
    const handler = (e: any) => {
      if (typeof e.detail?.index === "number") {
        setFrameIndex(e.detail.index);
      }
    };
    window.addEventListener("c2c:frame_changed", handler);
    return () => window.removeEventListener("c2c:frame_changed", handler);
  }, []);

  const theme: LuxuryTheme = useMemo(() => getTheme(frameIndex), [frameIndex]);

  return (
    <header
      dir="rtl"
      className="fixed top-2.5 left-0 right-0 z-40 flex items-center justify-between px-3 sm:px-6 py-2 mx-auto max-w-7xl font-['Cairo'] select-none pointer-events-none"
    >
      {/* Right Section: Captain Profile Pill */}
      <div
        className="pointer-events-auto flex items-center gap-2.5 sm:gap-3.5 px-3 py-1.5 rounded-full border shadow-2xl backdrop-blur-md transition-all duration-300"
        style={{
          background: `linear-gradient(135deg, ${theme.c[0]}ee, ${theme.c[1]}ee)`,
          borderColor: theme.bd,
          boxShadow: `0 8px 32px rgba(0,0,0,0.6), 0 0 16px ${theme.gl}`,
        }}
      >
        <div className="relative cursor-pointer" onClick={onOpenFrameShop || onOpenStore} title="تغيير الإطار">
          <CosmeticFrame themeIndex={frameIndex} size={52}>
            <div className="w-full h-full bg-[#141b2d] flex items-center justify-center">
              <CaptainAvatar avatarIndex={avatar} avatarUrl={avatarUrl} size={36} />
            </div>
          </CosmeticFrame>
          <span className="absolute -bottom-1 -left-1 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-amber-400 text-slate-950 border border-amber-200">
            {level}
          </span>
        </div>

        <div className="flex flex-col text-right">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] sm:text-[15px] font-black tracking-wide text-white drop-shadow">
              {name}
            </span>
            <span
              className="text-[10px] sm:text-[11px] font-extrabold px-1.5 py-0.5 rounded shadow-sm text-slate-950"
              style={{
                background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`,
              }}
            >
              {theme.r}
            </span>
          </div>
          <span className="text-[11px] font-medium text-slate-300 opacity-90">
            {rank}
          </span>
        </div>
      </div>

      {/* Left Section: Resources Capsules & Action Buttons */}
      <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2.5">
        {/* Gold Capsule */}
        <div
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border shadow-md backdrop-blur-sm"
          style={{
            background: "rgba(15, 23, 42, 0.75)",
            borderColor: "rgba(245, 158, 11, 0.4)",
          }}
        >
          <span className="text-sm">🪙</span>
          <span className="text-xs sm:text-sm font-black text-amber-300">
            {coins.toLocaleString()}
          </span>
        </div>

        {/* Rubies Capsule */}
        <div
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full border shadow-md backdrop-blur-sm"
          style={{
            background: "rgba(15, 23, 42, 0.75)",
            borderColor: "rgba(239, 68, 68, 0.4)",
          }}
        >
          <span className="text-sm">💎</span>
          <span className="text-xs sm:text-sm font-black text-rose-300">
            {rubies.toLocaleString()}
          </span>
        </div>

        {/* Frame Shop Quick Button */}
        {onOpenFrameShop && (
          <button
            onClick={onOpenFrameShop}
            title="متجر الإطارات الفاخرة"
            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-sky-400/50 bg-sky-950/60 hover:bg-sky-900/80 text-sky-200 transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            👑
          </button>
        )}

        {/* Rewards Button */}
        {onOpenRewards && (
          <button
            onClick={onOpenRewards}
            className="relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-amber-400/60 bg-amber-950/60 hover:bg-amber-900/80 text-amber-200 transition-all hover:scale-105 active:scale-95 shadow-lg"
          >
            🎁
            {hasReward && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}

export default TopHud;
