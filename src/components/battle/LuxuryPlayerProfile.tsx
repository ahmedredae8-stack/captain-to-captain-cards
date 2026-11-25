// src/components/battle/LuxuryPlayerProfile.tsx
import React, { useMemo } from "react";
import { getTheme, LUXURY_THEMES } from "@/lib/luxuryCosmetics";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import { CaptainAvatar } from "@/components/GameSprite";
import type { Player } from "@/lib/player";

type Props = {
  player: Player;
  isMe?: boolean;
  onClose: () => void;
  onAttack?: () => void;
  onOpenChat?: () => void;
  onAddFriend?: () => void;
};

export function LuxuryPlayerProfile({
  player,
  isMe = false,
  onClose,
  onAttack,
  onOpenChat,
  onAddFriend,
}: Props) {
  const theme = useMemo(() => {
    if (player.theme_id) return getTheme(player.theme_id);
    let h = 0;
    const str = player.id || player.name || "captain";
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return LUXURY_THEMES[h % LUXURY_THEMES.length]!;
  }, [player.theme_id, player.id, player.name]);

  const coins = player.coins ?? 1450000;
  const gems = player.gems ?? 2850;
  const score = player.score ?? 18200;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 overflow-y-auto" dir="rtl" onClick={onClose}>
      <div
        className="luxury-card relative w-full max-w-[640px] my-auto"
        style={{
          "--c1": theme.c[0],
          "--c2": theme.c[1],
          "--bd": theme.bd,
          "--gl": theme.gl,
          "--p1": theme.p[0],
          "--p2": theme.p[1],
          "--pt": theme.p[2] || "#000",
        } as React.CSSProperties}
        onClick={(e) => e.stopPropagation()}
      >
        {/* زخرفة الأركان الأسطورية */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-85 z-0" viewBox="0 0 640 720" fill="none" stroke={theme.bd} strokeWidth="3" strokeLinecap="round">
          <path d="M16 64V34Q16 16 34 16H64M576 16H606Q624 16 624 34V64M624 656V686Q624 704 606 704H576M64 704H34Q16 704 16 686V656" />
        </svg>

        {/* 1. الترويسة */}
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black text-white drop-shadow-md">ملف القبطان الفاخر</h2>
            <span className="text-xs font-black px-4 py-1 rounded" style={{ background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`, color: theme.p[2] || "#000" }}>{theme.r}</span>
          </div>
          <button type="button" onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center bg-black/40 border-2 font-bold text-lg hover:bg-black/60 transition" style={{ borderColor: theme.bd }}>✕</button>
        </div>

        {/* 2. شريط الثروة والمكافأة */}
        <div className="relative z-10 lux-wb">
          <div className="lux-pill g"><b>🪙</b><div><span>{coins.toLocaleString()}</span><small>ذهب</small></div></div>
          <div className="lux-pill m"><b>💎</b><div><span>{gems.toLocaleString()}</span><small>جواهر</small></div></div>
          <div className="lux-pill s"><b>🏆</b><div><span>{score.toLocaleString()}</span><small>المكافأة</small></div></div>
        </div>

        {/* 3. مركز القبطان والإطار الفاخر */}
        <div className="relative z-10 flex items-center gap-6 my-2">
          <CosmeticFrame themeId={theme.id} size={170}>
            <CaptainAvatar seed={player.avatar_index ?? 0} url={player.avatar_url} className="w-full h-full object-cover" />
          </CosmeticFrame>
          <div className="flex-1 flex flex-col gap-2 items-start">
            <div className="text-2xl font-black px-6 py-1 rounded text-white" style={{ background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`, color: theme.p[2] || "#000" }}>{player.name}</div>
            <div className="text-xs font-bold px-3 py-1 rounded-full bg-black/40 border" style={{ borderColor: theme.bd }}>{theme.nm} — لفل 45</div>
            <div className="w-full max-w-[240px]">
              <div className="w-full h-3 rounded-full bg-black/50 border overflow-hidden" style={{ borderColor: theme.bd }}>
                <div className="h-full" style={{ width: "68%", background: `linear-gradient(90deg, ${theme.f[0]}, ${theme.f[1]})` }} />
              </div>
              <span className="text-[11px] opacity-80 mt-1 block">6,800 / 10,000 XP</span>
            </div>
          </div>
        </div>

        {/* 4. أسطول المعارك */}
        <div className="relative z-10 my-2">
          <div className="text-sm font-black mb-2 flex items-center gap-2" style={{ color: theme.p[0] }}>⚓ أسطول المعارك المجهز</div>
          <div className="grid grid-cols-3 gap-2.5">
            {[{ name: "الغراب الأسود", power: 85, color: "#f2b934" }, { name: "سفينة العاصفة", power: 72, color: "#5ee0ff" }, { name: "قاهرة التنين", power: 94, color: "#ff7a1a" }].map((ship, idx) => (
              <div key={idx} className="p-2.5 rounded-2xl bg-black/40 border border-white/20 text-center flex flex-col items-center">
                <span className="text-2xl mb-1">⛵</span>
                <b className="text-xs block text-white">{ship.name}</b>
                <div className="w-full h-1.5 rounded-full bg-black/60 my-1 overflow-hidden"><div className="h-full" style={{ width: `${ship.power}%`, background: ship.color }} /></div>
                <small className="text-[10px] opacity-80 text-white/80">{ship.power}% جاهزية</small>
              </div>
            ))}
          </div>
        </div>

        {/* 5. معاينة فقاعة الشات */}
        <div className="relative z-10 lux-bubble-wrap my-1">
          <div className="lux-bubble-tag" style={{ background: `linear-gradient(${theme.p[0]}, ${theme.p[1]})`, color: theme.p[2] || "#000" }}>{player.name}</div>
          <div className="lux-bubble-body" style={{ background: theme.c[0], border: `2px solid ${theme.bd}`, color: "#fff" }}>
            <i className="sw" />
            <div className="text-sm font-bold">{theme.tx}</div>
          </div>
        </div>

        {/* 6. الأزرار السريعة */}
        <div className="relative z-10 lux-actions">
          {!isMe ? (
            <>
              <button type="button" className="lux-btn-atk" onClick={onAttack}>⚔️ تحدي مبارزة</button>
              <button type="button" className="lux-btn-msg" onClick={onOpenChat}>💬 رسالة خاصة</button>
              <button type="button" className="lux-btn-frd" onClick={onAddFriend}>🤝 إضافة صديق</button>
            </>
          ) : (
            <button type="button" className="col-span-3 lux-btn-msg py-3 font-black text-lg" onClick={onClose}>👑 بطاقتي الفاخرة</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default LuxuryPlayerProfile;
