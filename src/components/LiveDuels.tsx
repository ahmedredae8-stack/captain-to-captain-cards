import { useEffect, useMemo, useState } from "react";
import { RefreshCw, Users, Compass, Search, X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { playerFromMeta, type LobbyMeta } from "@/lib/duelNet";
import { CaptainAvatar } from "@/components/GameSprite";
import { placeLabel } from "@/components/DuelHub";
import type { Player } from "@/lib/player";

export const isDecoy = (id: string) => id.startsWith("decoy-") || id.startsWith("bot-");

/** قائمة قراصنة البحار المتاحة دائماً للتحدي والإغارة واختبار المحيط */
export const DEFAULT_PIRATES: Player[] = [
  {
    id: "decoy-barbarossa",
    name: "خير الدين بربروسا",
    theme_id: "bay-day",
    score: 2850,
    avatar_index: 1,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
  {
    id: "decoy-blackbeard",
    name: "إدوارد تيتش (اللحية السوداء)",
    theme_id: "bay-night",
    score: 3420,
    avatar_index: 2,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: "decoy-mary-read",
    name: "ماري ريد (صائدة التيجان)",
    theme_id: "bay-day",
    score: 1940,
    avatar_index: 3,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 32).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
  {
    id: "decoy-calico-jack",
    name: "كاليكو جاك راكهام",
    theme_id: "bay-dusk",
    score: 1580,
    avatar_index: 4,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
  },
  {
    id: "decoy-morgan",
    name: "السير هنري مورغان",
    theme_id: "bay-day",
    score: 3100,
    avatar_index: 5,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 40).toISOString(),
  },
  {
    id: "decoy-zheng-yi-sao",
    name: "تشينغ شي (سيدة الأساطيل)",
    theme_id: "bay-night",
    score: 2790,
    avatar_index: 0,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 20).toISOString(),
  },
  {
    id: "decoy-bart-roberts",
    name: "بارتولوميو روبرتس (البارت الأسود)",
    theme_id: "bay-dusk",
    score: 2220,
    avatar_index: 2,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 18).toISOString(),
  },
  {
    id: "decoy-sinbad",
    name: "السندباد البحري المغوار",
    theme_id: "bay-day",
    score: 2150,
    avatar_index: 1,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60).toISOString(),
  },
  {
    id: "decoy-corsair-omar",
    name: "الريس عمر قاهر العواصف",
    theme_id: "bay-dusk",
    score: 1770,
    avatar_index: 4,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
  },
  {
    id: "decoy-hawk-eye",
    name: "صقر البحار السبعة",
    theme_id: "bay-day",
    score: 1390,
    avatar_index: 3,
    avatar_url: null,
    last_seen: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
  },
];

/** تسوية الحروف العربية للبحث الدقيق */
export function normalizeSearch(str: string): string {
  return (str || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u065F\u0670]/g, "") // إزالة التشكيل
    .trim();
}

/** Pirate finder: captains with a live connection first, then everyone else. Click opens their sea perimeter. */
export function LiveDuels({ 
  me, 
  online, 
  onPick, 
  onRefresh 
}: { 
  me: Player | null; 
  online: LobbyMeta[]; 
  onPick: (p: Player) => void; 
  onRefresh?: (() => Promise<void>) | undefined 
}) {
  const [all, setAll] = useState<Player[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "online" | "away">("all");

  const load = async () => {
    let dbPlayers: Player[] = [];

    // 1. محاولة الجلب من جدول/عرض player_public_profiles
    try {
      const { data, error } = await supabase
        .from("player_public_profiles")
        .select("*")
        .order("last_seen", { ascending: false })
        .limit(100);

      if (!error && Array.isArray(data) && data.length > 0) {
        dbPlayers = (data.filter((p) => p.id && p.name) as unknown) as Player[];
      }
    } catch {
      // تجاهل إذا لم يكن العرض متوفراً
    }

    // 2. إذا لم تتوافر بيانات، نجلب مباشرة من جدول players
    if (dbPlayers.length === 0) {
      try {
        const { data, error } = await supabase
          .from("players")
          .select("id, name, theme_id, avatar_index, score, last_seen, created_at, avatar_url")
          .order("last_seen", { ascending: false })
          .limit(100);

        if (!error && Array.isArray(data) && data.length > 0) {
          dbPlayers = (data.filter((p) => p.id && p.name) as unknown) as Player[];
        }
      } catch {
        // تجاهل
      }
    }

    // دمج الحسابات الحقيقية مع قراصنة البحار الافتراضيين لضمان وفرة الأهداف
    const existingIds = new Set(dbPlayers.map((p) => p.id));
    const combined = [
      ...dbPlayers,
      ...DEFAULT_PIRATES.filter((p) => !existingIds.has(p.id)),
    ];
    setAll(combined);
  };

  useEffect(() => {
    void load();
  }, []);

  const refresh = async () => {
    setSpinning(true);
    await Promise.all([onRefresh?.(), load(), new Promise((r) => setTimeout(r, 600))]);
    setSpinning(false);
  };

  const { live, away } = useMemo(() => {
    const liveIds = new Set(online.map((o) => o.id));
    return {
      live: online.filter((o) => o.id !== me?.id),
      away: all.filter((p) => p.id !== me?.id && !liveIds.has(p.id)),
    };
  }, [online, all, me?.id]);

  // تصفية نتائج البحث
  const filteredLive = useMemo(() => {
    if (filterMode === "away") return [];
    if (!searchQuery.trim()) return live;
    const q = normalizeSearch(searchQuery);
    return live.filter((m) => normalizeSearch(m.name).includes(q));
  }, [live, searchQuery, filterMode]);

  const filteredAway = useMemo(() => {
    if (filterMode === "online") return [];
    if (!searchQuery.trim()) return away;
    const q = normalizeSearch(searchQuery);
    return away.filter((p) => normalizeSearch(p.name).includes(q));
  }, [away, searchQuery, filterMode]);

  const totalMatching = filteredLive.length + filteredAway.length;

  return (
    <div className="duel-live" dir="rtl" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* ترويسة سجل القراصنة */}
      <div className="pf-head">
        <div>
          <strong>سجل القراصنة والبحار</strong>
          <span>
            المتصلون: <b className="pf-count">{live.length}</b> · في الموانئ: <b className="pf-count">{away.length}</b>
          </span>
        </div>
        <button type="button" className="tos-btn pf-refresh" onClick={() => void refresh()} disabled={spinning}>
          <RefreshCw className={`h-4 w-4 ${spinning ? "spin" : ""}`} /> {spinning ? "جارٍ التحديث…" : "تحديث"}
        </button>
      </div>

      {/* شريط البحث المدمج الذكي */}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        <Search style={{ position: "absolute", right: "0.85rem", width: "1rem", height: "1rem", color: "var(--tos-subtle)", pointerEvents: "none" }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="ابحث بالاسم عن أي قبطان في الأساطيل أو الموانئ…"
          style={{
            width: "100%",
            padding: "0.6rem 2.4rem 0.6rem 2.2rem",
            fontSize: "0.82rem",
            borderRadius: "0.9rem",
            background: "var(--tos-card)",
            border: "1px solid var(--tos-line)",
            color: "var(--tos-text)",
            outline: "none",
          }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            style={{
              position: "absolute",
              left: "0.7rem",
              background: "none",
              border: 0,
              color: "var(--tos-subtle)",
              cursor: "pointer",
              padding: "0.2rem",
            }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* أزرار الفلترة السريعة */}
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
        <button
          type="button"
          onClick={() => setFilterMode("all")}
          className="tos-btn"
          style={{
            padding: "0.25rem 0.75rem",
            fontSize: "0.74rem",
            borderRadius: "999px",
            background: filterMode === "all" ? "var(--tos-btn-face)" : "var(--tos-card)",
            color: filterMode === "all" ? "var(--tos-abyss)" : "var(--tos-subtle)",
            border: "1px solid var(--tos-line)",
          }}
        >
          الكل ({live.length + away.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("online")}
          className="tos-btn"
          style={{
            padding: "0.25rem 0.75rem",
            fontSize: "0.74rem",
            borderRadius: "999px",
            background: filterMode === "online" ? "var(--tos-btn-face)" : "var(--tos-card)",
            color: filterMode === "online" ? "var(--tos-abyss)" : "var(--tos-subtle)",
            border: "1px solid var(--tos-line)",
          }}
        >
          متصلون الآن ({live.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterMode("away")}
          className="tos-btn"
          style={{
            padding: "0.25rem 0.75rem",
            fontSize: "0.74rem",
            borderRadius: "999px",
            background: filterMode === "away" ? "var(--tos-btn-face)" : "var(--tos-card)",
            color: filterMode === "away" ? "var(--tos-abyss)" : "var(--tos-subtle)",
            border: "1px solid var(--tos-line)",
          }}
        >
          في الموانئ والبحار ({away.length})
        </button>
      </div>

      {/* رسالة عند عدم وجود نتائج للبحث */}
      {searchQuery && totalMatching === 0 && (
        <div className="dock-empty" style={{ padding: "1.5rem" }}>
          <Users size={32} strokeWidth={1.4} />
          <strong>لا يوجد قبطان يطابق «{searchQuery}»</strong>
          <span>تأكد من كتابة الاسم أو جرّب أحرفاً أخرى</span>
        </div>
      )}

      {/* قسم المتصلين الآن */}
      {filteredLive.length > 0 && (
        <div>
          <div className="pf-section" style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
            <span>متصلون الآن في البحار ({filteredLive.length})</span>
          </div>
          <div className="pf-grid">
            {filteredLive.map((m) => (
              <button
                key={m.id}
                type="button"
                className="pf-card live"
                onClick={() => onPick(playerFromMeta(m))}
                style={{ textAlign: "center" }}
              >
                <i className="pf-dot" />
                <CaptainAvatar seed={m.avatar_index ?? 0} url={m.avatar_url} className="pf-av" />
                <b>{m.name}</b>
                <small>{placeLabel(m.where)} · {(m.score ?? 0).toLocaleString("ar")} مجد</small>
                <span className="pf-cta" style={{ marginTop: "0.35rem" }}>
                  <Compass className="h-3.5 w-3.5" /> عرض المحيط والإغارة
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* قسم قراصنة الموانئ والبحار (غير المتصلين) */}
      {filteredAway.length > 0 && (
        <div>
          <div className="pf-section">
            قراصنة في الموانئ والبحار ({filteredAway.length}) — اضغط للإغارة على محيطهم
          </div>
          <div className="pf-grid">
            {filteredAway.map((p) => (
              <button
                key={p.id}
                type="button"
                className="pf-card"
                onClick={() => onPick(p)}
                style={{ textAlign: "center" }}
              >
                <i className="pf-dot" />
                <CaptainAvatar seed={p.avatar_index ?? 0} url={p.avatar_url} className="pf-av" />
                <b>{p.name}</b>
                <small>محيط جاهز · {(p.score ?? 0).toLocaleString("ar")} مجد</small>
                <span className="pf-cta" style={{ marginTop: "0.35rem" }}>
                  <Compass className="h-3.5 w-3.5" /> عرض المحيط والإغارة
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
