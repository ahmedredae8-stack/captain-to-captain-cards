// src/components/FrameShopModal.tsx
import React, { useState, useMemo, useEffect } from "react";
import {
  LUXURY_THEMES,
  getTheme,
  getEquippedFrame,
  setEquippedFrame,
  type LuxuryTheme,
} from "@/lib/luxuryCosmetics";
import { CosmeticFrame } from "@/components/CosmeticFrame";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  coins?: number;
  gems?: number;
  onDeductCoins?: (amount: number) => void;
  onDeductGems?: (amount: number) => void;
};

const RARITY_COSTS: Record<string, { type: "coins" | "gems"; amount: number }> = {
  "قبطان": { type: "coins", amount: 0 },
  "نادر": { type: "coins", amount: 15000 },
  "ملحمي": { type: "gems", amount: 250 },
  "أسطوري": { type: "gems", amount: 600 },
};

export function FrameShopModal({
  isOpen,
  onClose,
  coins = 50000,
  gems = 1200,
  onDeductCoins,
  onDeductGems,
}: Props) {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [equippedIdx, setEquippedIdx] = useState<number>(0);
  const [ownedIndices, setOwnedIndices] = useState<number[]>([0]);

  useEffect(() => {
    const eq = getEquippedFrame();
    setEquippedIdx(eq);
    setSelectedIdx(eq);

    try {
      const saved = localStorage.getItem("c2c_owned_frames");
      if (saved) {
        setOwnedIndices(JSON.parse(saved));
      }
    } catch (_) {}
  }, [isOpen]);

  const selectedTheme: LuxuryTheme = useMemo(
    () => getTheme(selectedIdx),
    [selectedIdx]
  );

  const filteredThemes = useMemo(() => {
    return LUXURY_THEMES.map((theme, index) => ({ theme, index })).filter(
      ({ theme }) => {
        if (activeTab === "all") return true;
        return theme.r === activeTab;
      }
    );
  }, [activeTab]);

  if (!isOpen) return null;

  const cost = RARITY_COSTS[selectedTheme.r] || { type: "coins", amount: 0 };
  const isOwned = ownedIndices.includes(selectedIdx) || selectedIdx === 0;
  const isEquipped = equippedIdx === selectedIdx;

  const handleBuy = () => {
    if (isOwned) return;
    if (cost.type === "coins" && coins < cost.amount) {
      alert("ليس لديك ذهب كافي!");
      return;
    }
    if (cost.type === "gems" && gems < cost.amount) {
      alert("ليس لديك جواهر كافية!");
      return;
    }

    if (cost.type === "coins") onDeductCoins?.(cost.amount);
    if (cost.type === "gems") onDeductGems?.(cost.amount);

    const updated = [...ownedIndices, selectedIdx];
    setOwnedIndices(updated);
    try {
      localStorage.setItem("c2c_owned_frames", JSON.stringify(updated));
    } catch (_) {}

    setEquippedFrame(selectedIdx);
    setEquippedIdx(selectedIdx);
  };

  const handleEquip = (idx = selectedIdx) => {
    setEquippedFrame(idx);
    setEquippedIdx(idx);
    window.dispatchEvent(new CustomEvent("c2c:frame_changed", { detail: { index: idx } }));
  };

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md font-['Cairo'] animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col rounded-3xl border border-sky-400/30 bg-[#0d152a] text-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-sky-950/60 to-indigo-950/60">
          <div className="flex items-center gap-3">
            <span className="text-2xl">👑</span>
            <div>
              <h2 className="text-lg sm:text-xl font-black">متجر الإطارات والفقاعات الفاخرة</h2>
              <p className="text-xs text-slate-300">اختر إطارك وشريط اسمك وفقاعتك التي تميزك في كل بحار اللعبة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-slate-200 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Left / Top: Live Preview Pane */}
          <div className="w-full md:w-80 p-5 flex flex-col items-center justify-between border-b md:border-b-0 md:border-l border-white/10 bg-[#080d1a]">
            <div className="w-full flex flex-col items-center">
              <span className="text-xs font-bold text-slate-400 mb-3">معاينة حية للإطار المختار</span>
              <CosmeticFrame themeIndex={selectedIdx} size={110}>
                <div className="w-full h-full bg-[#1b253b] flex items-center justify-center text-3xl">
                  ⚓
                </div>
              </CosmeticFrame>

              <h3 className="mt-3 text-lg font-black text-amber-300">{selectedTheme.n}</h3>
              <span className="px-2.5 py-0.5 mt-1 text-xs font-black rounded-full bg-white/10 border border-white/20">
                {selectedTheme.r}
              </span>

              {/* Chat Bubble & Ribbon Preview */}
              <div className="w-full mt-6 p-3 rounded-2xl bg-black/40 border border-white/5">
                <span className="block text-[11px] font-bold text-slate-400 mb-2">معاينة الشات وشريط الاسم:</span>
                <div className="relative pt-3">
                  <div
                    className="inline-flex items-center gap-1 px-3 py-0.5 text-[10px] font-black rounded-t shadow"
                    style={{
                      background: `linear-gradient(${selectedTheme.p[0]}, ${selectedTheme.p[1]})`,
                      color: selectedTheme.p[2] || "#000",
                    }}
                  >
                    <span>{selectedTheme.nm}</span>
                  </div>
                  <div
                    className="p-2.5 rounded-xl text-xs font-bold shadow-lg"
                    style={{
                      background: selectedTheme.bub || `linear-gradient(135deg, ${selectedTheme.c[0]}, ${selectedTheme.c[1]})`,
                      border: `1.5px solid ${selectedTheme.bd}`,
                    }}
                  >
                    {selectedTheme.tx || "نحن ملوك البحار!"}
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons: Free Trial / Equip & Permanent Buy */}
            <div className="w-full mt-4 flex flex-col gap-2">
              {isEquipped ? (
                <div className="w-full py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black text-sm text-center">
                  ✓ مجهّز ومفعّل حالياً
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleEquip(selectedIdx)}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-sm transition-all hover:scale-102 active:scale-98 shadow-lg flex items-center justify-center gap-2"
                  >
                    <span>⚡ تجربة وتجهيز الإطار مجاناً</span>
                  </button>

                  {!isOwned && (
                    <button
                      onClick={handleBuy}
                      className="w-full py-2 rounded-xl bg-sky-950/80 hover:bg-sky-900 border border-sky-400/40 text-sky-200 font-bold text-xs transition-all flex items-center justify-center gap-2"
                    >
                      <span>شراء دائم في الحساب بـ</span>
                      <span>{cost.amount.toLocaleString()}</span>
                      <span>{cost.type === "coins" ? "🪙" : "💎"}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Right: Grid of Frames */}
          <div className="flex-1 flex flex-col p-4 sm:p-5 overflow-hidden">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 pb-3 overflow-x-auto no-scrollbar">
              {[
                { id: "all", label: "الكل (21)" },
                { id: "أسطوري", label: "أسطوري" },
                { id: "ملحمي", label: "ملحمي" },
                { id: "نادر", label: "نادر" },
                { id: "قبطان", label: "كلاسيكي" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-black whitespace-nowrap transition-all ${
                    activeTab === tab.id
                      ? "bg-amber-400 text-slate-950 shadow-md"
                      : "bg-white/10 text-slate-300 hover:bg-white/15"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Grid */}
            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-3 sm:grid-cols-4 gap-3 py-2">
              {filteredThemes.map(({ theme, index }) => {
                const isCurSelected = selectedIdx === index;
                const isCurOwned = ownedIndices.includes(index) || index === 0;
                const isCurEquipped = equippedIdx === index;

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedIdx(index)}
                    className={`relative flex flex-col items-center p-3 rounded-2xl cursor-pointer border transition-all ${
                      isCurSelected
                        ? "bg-white/15 border-amber-400 shadow-lg scale-102"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    {isCurEquipped && (
                      <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 text-[9px] font-black rounded-full bg-emerald-500 text-slate-950">
                        مجهز
                      </span>
                    )}

                    <CosmeticFrame themeIndex={index} size={68}>
                      <div className="w-full h-full bg-[#1b253b] flex items-center justify-center text-xl">
                        ⚓
                      </div>
                    </CosmeticFrame>

                    <span className="mt-2 text-xs font-black truncate max-w-full text-center">
                      {theme.n}
                    </span>
                    <span className="text-[10px] text-slate-400">{theme.r}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FrameShopModal;
