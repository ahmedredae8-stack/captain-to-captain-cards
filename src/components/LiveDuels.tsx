import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Swords, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playerFromMeta, type LobbyMeta } from "@/lib/duelNet";
import { CaptainAvatar } from "@/components/GameSprite";
import { placeLabel } from "@/components/DuelHub";
import type { Player } from "@/lib/player";

export const isDecoy = (id: string) => id.startsWith("decoy-");

/** Pirate finder: captains with a live connection (on any page) first, then everyone else. */
export function LiveDuels({ me, online, onPick, onRefresh }: { me: Player | null; online: LobbyMeta[]; onPick: (p: Player) => void; onRefresh?: (() => Promise<void>) | undefined }) {
  const [all, setAll] = useState<Player[]>([]);
  const [spinning, setSpinning] = useState(false);

  const load = () => supabase.from("player_public_profiles").select("*").order("last_seen", { ascending: false }).limit(200).then(({ data }) => setAll((data ?? []) as Player[]));
  useEffect(() => { void load(); }, []);

  const refresh = async () => {
    setSpinning(true);
    await Promise.all([onRefresh?.(), load(), new Promise((r) => setTimeout(r, 700))]);
    setSpinning(false);
  };

  const { live, away } = useMemo(() => {
    const liveIds = new Set(online.map((o) => o.id));
    return {
      live: online.filter((o) => o.id !== me?.id),
      away: all.filter((p) => p.id !== me?.id && !liveIds.has(p.id)),
    };
  }, [online, all, me?.id]);

  return (
    <div className="duel-live" dir="rtl">
      <div className="pf-head">
        <div>
          <strong>البحث عن قرصان</strong>
          <span>المتصلون الآن: <b className="pf-count">{live.length}</b> — القتال يبدأ فقط بموافقة القبطان</span>
        </div>
        <button type="button" className="tos-btn pf-refresh" onClick={() => void refresh()} disabled={spinning}>
          <RefreshCw className={`h-4 w-4 ${spinning ? "spin" : ""}`} /> {spinning ? "جارٍ البحث…" : "تحديث"}
        </button>
      </div>
      <div className="pf-section">متصلون الآن</div>
      {live.length ? (
        <div className="pf-grid">
          {live.map((m) => (
            <button key={m.id} type="button" className="pf-card live" onClick={() => onPick(playerFromMeta(m))}>
              <i className="pf-dot" />
              <CaptainAvatar seed={m.avatar_index ?? 0} url={m.avatar_url} className="pf-av" />
              <b>{m.name}</b>
              <small>{placeLabel(m.where)} · {m.score ?? 0} مجد</small>
              <span className="pf-cta"><Swords className="h-3 w-3" /> تحدَّ</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="dock-empty"><Users size={36} strokeWidth={1.4} /><strong>لا يوجد قراصنة متصلون الآن</strong><span>اضغط تحديث بعد قليل</span></div>
      )}
      {away.length > 0 && <>
        <div className="pf-section">غير متصلين</div>
        <div className="pf-grid">
          {away.map((p) => (
            <button key={p.id} type="button" className="pf-card" onClick={() => onPick(p)}>
              <i className="pf-dot" />
              <CaptainAvatar seed={p.avatar_index ?? 0} url={p.avatar_url} className="pf-av" />
              <b>{p.name}</b>
              <small>غير متصل</small>
              <span className="pf-cta">الملف</span>
            </button>
          ))}
        </div>
      </>}
    </div>
  );
}
