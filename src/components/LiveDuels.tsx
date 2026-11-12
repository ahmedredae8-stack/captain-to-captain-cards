import { useEffect, useMemo, useState } from "react";
import { Swords, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playerFromMeta, type LobbyMeta } from "@/lib/duelNet";
import { CaptainAvatar } from "@/components/GameSprite";
import type { Player } from "@/lib/player";

export const isDecoy = (id: string) => id.startsWith("decoy-");

/** Every captain: live ones first, then the two active AI captains, then everyone else. Tap opens their dossier. */
export function LiveDuels({ me, online, onPick }: { me: Player | null; online: LobbyMeta[]; onPick: (p: Player) => void }) {
  const [all, setAll] = useState<Player[]>([]);

  useEffect(() => {
    let alive = true;
    void supabase.from("player_public_profiles").select("*").order("last_seen", { ascending: false }).limit(200).then(({ data }) => { if (alive) setAll((data ?? []) as Player[]); });
    return () => { alive = false; };
  }, []);

  const rows = useMemo(() => {
    const liveIds = new Set(online.map((o) => o.id));
    const live = online.filter((o) => o.id !== me?.id).map((o) => ({ p: playerFromMeta(o), tag: "live" as const }));
    // Only captains whose game is open right now (live connection) count as online.
    const rest = all.filter((p) => p.id !== me?.id && !liveIds.has(p.id)).map((p) => ({ p, tag: "away" as const }));
    return [...live, ...rest];
  }, [online, all, me?.id]);

  const label = { live: "متصل الآن", away: "غير متصل" };

  return (
    <div className="duel-live">
      <div className="duel-live-head">
        <div className="duel-live-note">
          <strong>كل القباطنة</strong>
          <span>اضغط على أي قبطان لتختار هجوم أو مراسلة — القتال يبدأ فقط إذا وافق القبطان المتصل</span>
        </div>
      </div>
      {rows.length ? (
        <ol className="ranking-list">
          {rows.map(({ p, tag }) => (
            <li key={p.id}>
              <button type="button" className="pirate-row" onClick={() => onPick(p)}>
                <CaptainAvatar seed={p.avatar_index ?? 0} url={p.avatar_url} className="ranking-avatar" />
                <strong>{p.name}</strong>
                <em className={tag === "live" ? "duel-waiting" : "duel-away"}>{label[tag]}</em>
                <span><Swords className="h-3.5 w-3.5" /> اختر</span>
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <div className="dock-empty"><Users size={40} strokeWidth={1.4} /><strong>جارٍ تحميل القباطنة…</strong></div>
      )}
    </div>
  );
}
