import type { CSSProperties, ReactNode } from "react";
import { THEMES, clampTheme } from "../lib/luxuryCosmetics";
import { useEquippedFrame } from "../lib/equippedFrame";
import { CosmeticFrame } from "./CosmeticFrame";

/** عدّل القيم لتطابق kinds اللي بتستخدمها دالة onTopUp الأصلية عندك */
export type TopUpKind = "gold" | "ruby" | "diamond";

interface Props {
  name: string;
  title?: string;
  level: number;
  /** نسبة التقدم لليفل التالي 0..100 */
  xpPct: number;
  gold: number;
  ruby: number;
  diamond: number;
  fishFound: number;
  fishTotal: number;
  /** صورة القبطان (تدخل في ثقب الإطار) */
  avatar: ReactNode;
  /** إطار مخصص؛ لو ما اتمرّرش يُستخدم الإطار المجهّز للاعب الحالي */
  frameIndex?: number;
  hasNewGift?: boolean;
  onAvatarClick: () => void;
  onGiftClick: () => void;
  onTopUp: (kind: TopUpKind) => void;
}

const fmt = (n: number) => n.toLocaleString("en-US");

function Capsule({ icon, value, color, label, onPlus }: { icon: string; value: number; color: string; label: string; onPlus: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 6px 0 12px", borderRadius: 16, border: `2px solid ${color}`, color, background: "rgba(0,0,0,.4)", boxShadow: "inset 0 0 14px rgba(255,255,255,.08)" }}>
      <span style={{ fontSize: 22 }} aria-hidden="true">{icon}</span>
      <span style={{ fontSize: 17, fontWeight: 900, minWidth: 56 }}>{fmt(value)}</span>
      <button type="button" onClick={onPlus} aria-label={`شحن ${label}`} style={{ width: 26, height: 26, borderRadius: "50%", border: 0, cursor: "pointer", font: "900 17px/1 inherit", color: "#10131f", background: `linear-gradient(#fff,${color})` }}>+</button>
    </div>
  );
}

export function LuxuryTopHud(p: Props) {
  const mine = useEquippedFrame();
  const i = clampTheme(p.frameIndex ?? mine);
  const t = THEMES[i];
  const R = 70, C = 2 * Math.PI * R, pct = Math.min(100, Math.max(0, p.xpPct));
  const bar: CSSProperties = {
    position: "relative", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", minHeight: 96, padding: "0 18px", borderRadius: 24,
    background: "linear-gradient(rgba(255,255,255,.1),rgba(255,255,255,0) 40%), rgba(10,12,30,.62)",
    backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
    border: `1.5px solid ${t.bd}`, boxShadow: `0 0 22px ${t.gl}, 0 8px 24px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.2)`,
  };
  const pill: CSSProperties = { display: "flex", alignItems: "center", gap: 8, height: 46, padding: "0 16px", borderRadius: 16, fontWeight: 900, fontSize: 16, color: "#fff", border: "2px solid rgba(255,255,255,.35)", background: "rgba(0,0,0,.4)" };
  return (
    <header dir="rtl" style={bar}>
      {/* ميدالية القبطان: إطار + حلقة خبرة + شارة اللفل → الإعدادات */}
      <button type="button" onClick={p.onAvatarClick} aria-label="إعدادات الحساب" style={{ position: "relative", width: 150, height: 150, margin: "-30px 0", padding: 0, border: 0, background: "none", cursor: "pointer", flex: "none" }}>
        <CosmeticFrame themeIndex={i} size={150}>{p.avatar}</CosmeticFrame>
        <svg viewBox="0 0 150 150" width={150} height={150} style={{ position: "absolute", inset: 0, pointerEvents: "none", transform: "rotate(-90deg)" }} aria-hidden="true">
          <circle cx={75} cy={75} r={R} fill="none" stroke="rgba(0,0,0,.45)" strokeWidth={4} />
          <circle cx={75} cy={75} r={R} fill="none" stroke={t.f[0]} strokeWidth={4} strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - pct / 100)} />
        </svg>
        <span style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", padding: "1px 14px", borderRadius: 99, fontSize: 12, fontWeight: 900, color: t.p[2], background: `linear-gradient(${t.p[0]},${t.p[1]})`, border: "1.5px solid rgba(255,255,255,.6)" }}>Lv {p.level}</span>
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 140 }}>
        <div style={{ fontSize: 23, fontWeight: 900, textShadow: "0 2px 6px rgba(0,0,0,.6)" }}>{p.name}</div>
        {p.title && <div style={{ alignSelf: "flex-start", padding: "1px 18px", fontSize: 12, fontWeight: 900, color: t.p[2], background: `linear-gradient(${t.p[0]},${t.p[1]})`, clipPath: "polygon(0 0,100% 0,calc(100% - 8px) 50%,100% 100%,0 100%,8px 50%)" }}>{p.title}</div>}
      </div>
      {/* شريط الموارد الموحد */}
      <div style={{ marginInlineStart: "auto", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <Capsule icon="🪙" value={p.gold} color="#ffd45a" label="الذهب" onPlus={() => p.onTopUp("gold")} />
        <Capsule icon="♦️" value={p.ruby} color="#ff6b8a" label="الياقوت" onPlus={() => p.onTopUp("ruby")} />
        <Capsule icon="💎" value={p.diamond} color="#5ee0ff" label="الألماس" onPlus={() => p.onTopUp("diamond")} />
        <div style={pill} title="الأسماك المكتشفة"><span aria-hidden="true">🐟</span>{p.fishFound}/{p.fishTotal}</div>
        {/* ختم الهدايا / المكافآت (زر بدون أرقام) */}
        <button type="button" onClick={p.onGiftClick} aria-label="المكافآت والهدايا" style={{ ...pill, position: "relative", cursor: "pointer", padding: "0 18px", borderColor: "#ffd27a", background: "linear-gradient(#ff5a7a,#c2144a 55%,#6e0926)", textShadow: "0 1px 3px rgba(0,0,0,.5)" }}>
          <span aria-hidden="true">🎁</span>المكافآت
          {p.hasNewGift && <i style={{ position: "absolute", top: -5, left: -5, width: 15, height: 15, borderRadius: "50%", background: "#ff3d3d", border: "2.5px solid #fff" }} />}
        </button>
      </div>
    </header>
  );
}
