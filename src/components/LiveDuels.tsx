import { useEffect, useMemo, useState } from "react";
import { Compass, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playerFromMeta, type LobbyMeta } from "@/lib/duelNet";
import { CaptainAvatar } from "@/components/GameSprite";
import { placeLabel } from "@/components/DuelHub";
import type { Player } from "@/lib/player";

export const isDecoy = (id: string) => id.startsWith("decoy-") || id.startsWith("bot-");

/** سجل القراصنة: حضور مباشر مع الحسابات العامة المتاحة، بلا بحث أو زر تحديث مكرر. */
export function LiveDuels({ me, online, onPick }: {
  me: Player | null;
  online: LobbyMeta[];
  onPick: (p: Player) => void;
}) {
  const [accounts, setAccounts] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      let rows: Player[] = [];
      try {
        const { data, error } = await supabase.from("player_public_profiles").select("*").order("last_seen", { ascending: false }).limit(200);
        if (!error && Array.isArray(data)) rows = data.filter((p) => p?.id && p?.name) as unknown as Player[];
      } catch { /* view may not exist in older databases */ }

      if (!rows.length) {
        try {
          const { data, error } = await supabase.from("players")
            .select("id,name,theme_id,avatar_index,score,last_seen,created_at,avatar_url")
            .order("last_seen", { ascending: false }).limit(200);
          if (!error && Array.isArray(data)) rows = data.filter((p) => p?.id && p?.name) as unknown as Player[];
        } catch { /* public read may be restricted */ }
      }

      if (mounted) {
        setAccounts(rows);
        setLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, []);

  const { live, away } = useMemo(() => {
    const liveIds = new Set(online.map((p) => p.id));
    const offline = accounts.filter((p) => p.id !== me?.id && !liveIds.has(p.id));
    return { live: online.filter((p) => p.id !== me?.id), away: offline };
  }, [accounts, online, me?.id]);

  return <div className="duel-live" dir="rtl">
    <div className="pf-head">
      <div><strong>سجل القراصنة</strong><span>المتصلون الآن: <b className="pf-count">{live.length}</b> · غير المتصلين: <b className="pf-count">{away.length}</b></span></div>
    </div>

    {live.length > 0 && <>
      <div className="pf-section">في البحر الآن</div>
      <div className="pf-grid">
        {live.map((meta) => <button key={meta.id} type="button" className="pf-card live" onClick={() => onPick(playerFromMeta(meta))}>
          <i className="pf-dot" />
          <CaptainAvatar seed={meta.avatar_index ?? 0} url={meta.avatar_url} className="pf-av" />
          <b>{meta.name}</b>
          <small>{placeLabel(meta.where)} · {(meta.score ?? 0).toLocaleString("ar")} مجد</small>
          <span className="pf-cta"><Compass className="h-3.5 w-3.5" /> عرض المحيط</span>
        </button>)}
      </div>
    </>}

    {away.length > 0 && <>
      <div className="pf-section">في الموانئ أو غير متصلين</div>
      <div className="pf-grid">
        {away.map((p) => <button key={p.id} type="button" className="pf-card" onClick={() => onPick(p)}>
          <i className="pf-dot" />
          <CaptainAvatar seed={p.avatar_index ?? 0} url={p.avatar_url} className="pf-av" />
          <b>{p.name}</b>
          <small>آخر ظهور: {p.last_seen ? new Date(p.last_seen).toLocaleDateString("ar") : "غير معروف"}</small>
          <span className="pf-cta"><Compass className="h-3.5 w-3.5" /> عرض المحيط</span>
        </button>)}
      </div>
    </>}

    {!loading && !live.length && !away.length && <div className="dock-empty">
      <Users size={36} strokeWidth={1.4} />
      <strong>لا توجد حسابات ظاهرة حالياً</strong>
      <span>قد تكون الحسابات غير المتصلة مخفية بسبب صلاحيات قاعدة البيانات؛ الحسابات المتصلة ستظهر هنا عند دخولها.</span>
    </div>}
    {loading && <p className="dock-loading">جارٍ تحميل سجل القراصنة…</p>}
  </div>;
}
