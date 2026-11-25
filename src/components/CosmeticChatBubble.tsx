// src/components/CosmeticChatBubble.tsx
import React from "react";
import { getTheme } from "@/lib/luxuryCosmetics";

type Props = {
  themeId?: string;
  themeIndex?: number;
  playerName: string;
  message: string;
  time?: string;
  isMe?: boolean;
};

export function CosmeticChatBubble({
  themeId,
  themeIndex = 0,
  playerName,
  message,
  time,
  isMe = false,
}: Props) {
  const theme = getTheme(themeId ?? themeIndex);

  return (
    <div className={`lux-bubble-wrap ${isMe ? "ml-auto" : "mr-auto"} max-w-[85%] sm:max-w-[420px]`} dir="rtl">
      {/* لوحة الاسم المطرّزة فوق كل فقاعة */}
      <div
        className="lux-bubble-tag"
        style={{
          background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`,
          color: theme.p[2] || "#000",
        }}
      >
        {playerName}
      </div>

      {/* جسم الفقاعة الفاخرة مع تأثير لمعان السيف sw */}
      <div
        className="lux-bubble-body"
        style={{
          background: theme.c[0],
          border: `2px solid ${theme.bd}`,
          color: "#fff",
        }}
      >
        <i className="sw" />
        <div className="relative z-10 text-[14px] font-bold leading-relaxed">
          {message}
        </div>
        {time && (
          <div className="mt-1 text-[11px] opacity-75 text-left font-medium">
            {time}
          </div>
        )}
      </div>
    </div>
  );
}
