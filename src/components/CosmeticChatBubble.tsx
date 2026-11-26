import type { CSSProperties, ReactNode } from "react";
import { RANK_ICON, THEMES, bubbleStyle, clampTheme } from "../lib/luxuryCosmetics";

const CSS = `@keyframes ccb-sw{0%{transform:translateX(-90px)}60%,100%{transform:translateX(520px)}}
.ccb-sw{animation:ccb-sw 4.5s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.ccb-sw{animation:none}}`;

interface Props {
  themeIndex?: number;
  name: string;
  text: ReactNode;
  time?: string;
  /** رسالتي أنا (تظهر على الجهة المقابلة مع ✓✓) */
  mine?: boolean;
  /** رسالة سريعة للمعارك (خط أكبر) */
  quick?: boolean;
  /** مكان الأفاتار (مثلاً <CaptainAvatar />) — اختياري */
  avatar?: ReactNode;
}

export function CosmeticChatBubble({ themeIndex = 0, name, text, time, mine = false, quick = false, avatar }: Props) {
  const i = clampTheme(themeIndex);
  const t = THEMES[i];
  const animated = i !== 0;
  const tag: CSSProperties = {
    position: "absolute",
    top: 0,
    [mine ? "left" : "right"]: 20,
    zIndex: 2,
    display: "flex",
    gap: 6,
    alignItems: "center",
    padding: "1px 22px",
    fontSize: 12,
    fontWeight: 900,
    whiteSpace: "nowrap",
    background: `linear-gradient(${t.p[0]},${t.p[1]})`,
    color: t.p[2],
    clipPath: "polygon(0 0,100% 0,calc(100% - 10px) 50%,100% 100%,0 100%,10px 50%)",
  };
  const body: CSSProperties = {
    position: "relative",
    overflow: "hidden",
    padding: quick ? "18px 20px 6px" : "20px 16px 8px",
    borderRadius: mine ? "18px 18px 18px 5px" : "18px 18px 5px 18px",
    boxShadow: `inset 0 0 0 3px rgba(255,255,255,.16), 0 0 15px ${t.gl}`,
    ...bubbleStyle(i),
  };
  return (
    <div dir="rtl" style={{ display: "flex", gap: 12, alignItems: "flex-end", justifyContent: mine ? "flex-end" : "flex-start" }}>
      {!mine && avatar}
      <div style={{ position: "relative", paddingTop: 15, maxWidth: 380 }}>
        {animated && <style href="cosmetic-chat-bubble" precedence="medium">{CSS}</style>}
        <div style={tag}>
          <span>{RANK_ICON[t.r]}</span>
          {name}
        </div>
        <div style={body}>
          {animated && (
            <>
              <span style={{ position: "absolute", inset: 0, background: "linear-gradient(rgba(255,255,255,.24),transparent 48%)", pointerEvents: "none" }} />
              <span className="ccb-sw" style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 60, background: "linear-gradient(100deg,transparent,rgba(255,255,255,.4),transparent)", pointerEvents: "none" }} />
            </>
          )}
          <p style={{ position: "relative", margin: 0, fontSize: quick ? 21 : 16, fontWeight: 700, lineHeight: 1.5 }}>{text}</p>
          {time && (
            <time style={{ position: "relative", display: "block", marginTop: 3, textAlign: "left", fontSize: 10.5, fontWeight: 600, opacity: 0.7 }}>
              {time}
              {mine ? " ✓✓" : ""}
            </time>
          )}
        </div>
      </div>
    </div>
  );
}
