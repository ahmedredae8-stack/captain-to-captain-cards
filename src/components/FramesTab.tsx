import { useMemo, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { RARITY_COLOR, THEMES, THEME_COUNT, priceOf, type Rarity } from "../lib/luxuryCosmetics";
import { equipFrame, grantFrame, useFrameState } from "../lib/equippedFrame";
import { AvatarPlaceholder, CosmeticFrame } from "./CosmeticFrame";
import { CosmeticChatBubble } from "./CosmeticChatBubble";

interface Props {
  gold: number;
  gems: number;
  /** يخصم من محفظة اللعبة الحقيقية ويرجّع true لو نجح */
  spend: (kind: "gold" | "gems", amount: number) => boolean;
  /** صورة اللاعب الحقيقية في المعاينة (اختياري) */
  avatar?: ReactNode;
}

const FILTERS: { label: string; rarity?: Rarity; owned?: boolean }[] = [
  { label: "الكل" }, { label: "مملوكة", owned: true }, { label: "كلاسيكي", rarity: "قبطان" },
  { label: "نادر", rarity: "نادر" }, { label: "ملحمي", rarity: "ملحمي" }, { label: "أسطوري", rarity: "أسطوري" },
];
const priceText = (i: number) => {
  const p = priceOf(i);
  return p.kind === "free" ? "مجاني" : `${p.kind === "gold" ? "🪙" : "💎"} ${p.value.toLocaleString("en-US")}`;
};

export function FramesTab({ gold, gems, spend, avatar }: Props) {
  const { owned, equipped } = useFrameState();
  const [filter, setFilter] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const [msg, setMsg] = useState("");
  const say = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 1600); };
  const list = useMemo(() => {
    const f = FILTERS[filter];
    return Array.from({ length: THEME_COUNT }, (_, i) => i).filter((i) => (f.rarity ? THEMES[i].r === f.rarity : true) && (f.owned ? owned.includes(i) : true));
  }, [filter, owned]);

  const act = (i: number) => {
    if (owned.includes(i)) { equipFrame(i); return say("تم التجهيز ✅"); }
    const p = priceOf(i);
    if (p.kind !== "free") {
      if ((p.kind === "gold" ? gold : gems) < p.value) return say("رصيدك لا يكفي ❌");
      if (!spend(p.kind, p.value)) return say("تعذّر الشراء ❌");
    }
    grantFrame(i); equipFrame(i); say("تم الشراء والتجهيز ✅");
  };
  const label = (i: number) => (equipped === i ? "مُجهّز ✓" : owned.includes(i) ? "تجهيز" : "شراء");
  const btn = (i: number) => (
    <button type="button" disabled={equipped === i} onClick={() => act(i)} style={{ width: "100%", padding: 9, borderRadius: 14, border: "2px solid rgba(255,255,255,.5)", color: "#fff", font: "900 15px inherit", cursor: equipped === i ? "default" : "pointer", background: equipped === i ? "rgba(255,255,255,.12)" : owned.includes(i) ? "linear-gradient(#5ee8a6,#12875d 55%,#06382a)" : "linear-gradient(#ffb347,#d3601a 55%,#7d2a0a)" }}>{label(i)}</button>
  );
  const ph = avatar ?? <AvatarPlaceholder />;
  return (
    <section dir="rtl" style={{ color: "#fff" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }} role="tablist">
        {FILTERS.map((f, k) => (
          <button key={f.label} type="button" role="tab" aria-selected={k === filter} onClick={() => setFilter(k)} style={{ padding: "8px 20px", borderRadius: 99, font: "900 14px inherit", cursor: "pointer", color: k === filter ? "#1b1230" : "#c9c5f0", background: k === filter ? "linear-gradient(#fff,#cfc6ff)" : "rgba(255,255,255,.05)", border: "1.5px solid rgba(255,255,255,.3)" }}>{f.label}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 16 }}>
        {list.map((i) => {
          const t = THEMES[i];
          return (
            <div key={i} style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "30px 12px 14px", borderRadius: 20, border: `2px solid ${RARITY_COLOR[t.r]}`, background: `radial-gradient(ellipse at 50% 20%,${t.gl},transparent 62%),linear-gradient(#1b1846,#0c0a22)` }}>
              <span style={{ position: "absolute", top: 9, right: 12, padding: "2px 14px", fontSize: 11, fontWeight: 900, color: "#10131f", background: RARITY_COLOR[t.r], clipPath: "polygon(0 0,100% 0,calc(100% - 8px) 50%,100% 100%,0 100%,8px 50%)" }}>{t.r}</span>
              {owned.includes(i) && <span style={{ position: "absolute", top: 9, left: 12, fontSize: 11, fontWeight: 900, color: "#7dffb0" }}>مملوك ✓</span>}
              <button type="button" onClick={() => setSel(i)} aria-label={`معاينة ${t.n}`} style={{ border: 0, background: "none", padding: 0, cursor: "pointer" }}>
                <CosmeticFrame themeIndex={i} size={140}>{ph}</CosmeticFrame>
              </button>
              <div style={{ fontSize: 17, fontWeight: 900 }}>{t.n}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: priceOf(i).kind === "gems" ? "#5ee0ff" : "#ffd45a" }}>{priceText(i)}</div>
              {btn(i)}
            </div>
          );
        })}
      </div>
      {sel !== null && (
        <div role="dialog" aria-modal="true" onClick={() => setSel(null)} style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(8,6,20,.82)", overflow: "auto" }}>
          <div onClick={(e: ReactMouseEvent) => e.stopPropagation()} style={{ position: "relative", width: "min(560px,100%)", padding: 24, borderRadius: 24, border: `2.5px solid ${RARITY_COLOR[THEMES[sel].r]}`, background: `radial-gradient(ellipse at 50% 0,${THEMES[sel].gl},transparent 60%),linear-gradient(#1b1846,#0c0a22)` }}>
            <button type="button" onClick={() => setSel(null)} aria-label="إغلاق" style={{ position: "absolute", top: 12, left: 12, width: 34, height: 34, borderRadius: "50%", border: "2px solid rgba(255,255,255,.5)", background: "rgba(0,0,0,.4)", color: "#fff", cursor: "pointer" }}>✕</button>
            <div style={{ display: "flex", gap: 22, alignItems: "center", flexWrap: "wrap" }}>
              <CosmeticFrame themeIndex={sel} size={180}>{ph}</CosmeticFrame>
              <div style={{ flex: 1, minWidth: 180 }}>
                <h3 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>{THEMES[sel].n}</h3>
                <p style={{ margin: "6px 0 0", opacity: 0.85 }}>{THEMES[sel].r} · {priceText(sel)}</p>
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <CosmeticChatBubble themeIndex={sel} name={THEMES[sel].nm} text={THEMES[sel].tx} time="10:42 ص" avatar={<CosmeticFrame themeIndex={sel} size={64}>{ph}</CosmeticFrame>} />
            </div>
            <div style={{ marginTop: 18 }}>{btn(sel)}</div>
          </div>
        </div>
      )}
      {msg && <div role="status" style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 60, padding: "10px 24px", borderRadius: 14, fontWeight: 900, background: "#1b1846", border: "2px solid #fff", color: "#fff" }}>{msg}</div>}
    </section>
  );
}
