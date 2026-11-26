// src/components/CosmeticChatBubble.tsx
import React, { useMemo } from "react";
import { getTheme, LuxuryTheme } from "@/lib/luxuryCosmetics";
import { CosmeticFrame } from "@/components/CosmeticFrame";

type Props = {
  themeId?: string;
  themeIndex?: number;
  playerName: string;
  message: string;
  time?: string;
  isMe?: boolean;
  avatarSeed?: number;
  avatarUrl?: string | null;
  quick?: boolean;
};

const RARITY_ICONS: Record<string, string> = {
  "أسطوري": "👑",
  "ملحمي": "⚔️",
  "نادر": "⚓",
  "قبطان": "🧭",
};

export function CosmeticChatBubble({
  themeId,
  themeIndex = 0,
  playerName,
  message,
  time,
  isMe = false,
  avatarSeed,
  avatarUrl,
  quick = false,
}: Props) {
  const theme: LuxuryTheme = useMemo(() => getTheme(themeId ?? themeIndex), [themeId, themeIndex]);

  return (
    <div
      dir="rtl"
      className={`relative flex items-end gap-2.5 my-2.5 font-['Cairo'] ${
        isMe ? "justify-start flex-row-reverse" : "justify-start"
      }`}
    >
      {!isMe && (
        <div className="flex-none mb-1">
          <CosmeticFrame themeIndex={themeIndex} size={46}>
            <div className="w-full h-full bg-[#201d40] flex items-center justify-center text-xs">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span>⚓</span>
              )}
            </div>
          </CosmeticFrame>
        </div>
      )}

      <div className="relative max-w-[85%] sm:max-w-[420px] pt-3.5">
        <div
          className={`absolute top-0 z-10 flex items-center gap-1.5 px-4 py-0.5 text-[11px] font-black whitespace-nowrap shadow-md ${
            isMe ? "left-4" : "right-4"
          }`}
          style={{
            background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`,
            color: theme.p[2] || "#000",
            clipPath: isMe
              ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 7px 50%)"
              : "polygon(0 0, 100% 0, calc(100% - 7px) 50%, 100% 100%, 0 100%)",
          }}
        >
          <span className="text-[10px]">{RARITY_ICONS[theme.r] || "⚓"}</span>
          <span>{playerName}</span>
        </div>

        <div
          className={`relative overflow-hidden px-4 py-3 rounded-2xl shadow-xl transition-all ${
            isMe ? "rounded-bl-sm" : "rounded-br-sm"
          }`}
          style={{
            background:
              theme.bub ||
              `linear-gradient(135deg, ${theme.c[0]}, ${theme.c[1]})`,
            border: `2px solid ${theme.bd}`,
            boxShadow: `0 0 16px ${theme.gl}, 0 4px 12px rgba(0,0,0,0.4)`,
            color: "#fff",
          }}
        >
          <i
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(rgba(255,255,255,0.2), transparent 45%)",
            }}
          />
          <p className="relative z-10 text-[14px] sm:text-[15px] font-bold leading-relaxed break-words">
            {message}
          </p>

          {time && (
            <time className="relative z-10 block mt-1 text-[10px] font-medium opacity-75 text-left">
              {time} {isMe && "✓✓"}
            </time>
          )}
        </div>
      </div>
    </div>
  );
}

export default CosmeticChatBubble;
