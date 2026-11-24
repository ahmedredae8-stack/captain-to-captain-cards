import { useEffect, useState, useMemo } from "react";
import { Bell, Search, Crown, Fish, Shield, Skull, Swords, Trophy, Users, Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CaptainAvatar } from "@/components/GameSprite";
import { LiveDuels, DEFAULT_PIRATES, normalizeSearch } from "@/components/LiveDuels";
import type { Player } from "@/lib/player";
import type { LobbyMeta } from "@/lib/duelNet";
import { getTheme } from "@/lib/themes";

type Ranking = "events" | "damage" | "fish" | "tribes" | "live";
const boards = [
  { id: "events" as const, label: "الفعاليات", icon: Trophy },
  { id: "damage" as const, label: "ملوك الضرر", icon: Swords },
  { id: "fish" as const, label: "ملوك الصيد", icon: Fish },
  { id: "tribes" as const, label: "ترتيب القبيلة في قتل الوحش", icon: Crown },
];

export function RankingsWindow({ 
  onPick, 
  me, 
  online = [], 
  onRefresh, 
  initial = "events" 
}: { 
  onPick?: (p: Player) => void; 
  me?: Player | null; 
  online?: LobbyMeta[]; 
  onRefresh?: () => Promise<void>; 
  initial?: Ranking 
} = {}) {
  const [board, setBoard] = useState<Ranking>(initial);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [dbResults, setDbResults] = useState<Player[]>([]);

  // تحميل قائمة اللاعبين للأقسام الأخرى
  useEffect(() => {
    let active = true;

    async function fetchRankings() {
      let list: Player[] = [];
      try {
        const { data, error } = await supabase
          .from("player_public_profiles")
          .select("*")
          .order("score", { ascending: false })
          .limit(30);

        if (!error && Array.isArray(data) && data.length > 0) {
          list = data.filter((p) => p.id && p.name) as unknown as Player[];
        }
      } catch {}

      if (list.length === 0) {
        try {
          const { data, error } = await supabase
            .from("players")
            .select("id, name, theme_id, avatar_index, score, last_seen, created_at, avatar_url")
            .order("score", { ascending: false })
            .limit(30);

          if (!error && Array.isArray(data) && data.length > 0) {
            list = data.filter((p) => p.id && p.name) as unknown as Player[];
          }
        } catch {}
      }

      // إذا لم توجد بيانات، نستخدم قراصنة البحار
      if (list.length === 0) {
        list = [...DEFAULT_PIRATES].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      }

      if (active) {
        setPlayers(list);
        setLoading(false);
      }
    }

    void fetchRankings();
    return () => { active = false; };
  }, []);

  // بحث Supabase في الخلفية
  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) {
      setDbResults([]);
      return;
    }

    const t = window.setTimeout(async () => {
      try {
        const { data } = await supabase
          .from("player_public_profiles")
          .select("*")
          .ilike("name", `%${term.replace(/[%_]/g, "")}%`)
          .limit(20);

        if (data && data.length > 0) {
          setDbResults(data as unknown as Player[]);
          return;
        }
      } catch {}

      try {
        const { data } = await supabase
          .from("players")
          .select("id, name, theme_id, avatar_index, score, last_seen, created_at, avatar_url")
          .ilike("name", `%${term.replace(/[%_]/g, "")}%`)
          .limit(20);

        if (data && data.length > 0) {
          setDbResults(data as unknown as Player[]);
        }
      } catch {}
    }, 250);

    return () => window.clearTimeout(t);
  }, [q]);

  // نتائج البحث الشاملة (بحث فوري محلي + قاعدة البيانات)
  const found = useMemo(() => {
    const term = normalizeSearch(q);
    if (!term) return null;

    const seen = new Set<string>();
    const res: Player[] = [];

    // 1. القراصنة واللاعبون المحليون وقاعدة البيانات
    const pool = [...players, ...DEFAULT_PIRATES, ...dbResults];
    for (const p of pool) {
      if (!p.id || seen.has(p.id) || p.id === me?.id) continue;
      if (normalizeSearch(p.name || "").includes(term)) {
        seen.add(p.id);
        res.push(p);
      }
    }

    return res;
  }, [q, players, dbResults, me?.id]);

  return (
    <div className="dock-content">
      <div style={{ position: "relative", display: "flex", alignItems: "center", marginBottom: "0.5rem" }}>
        <Search style={{ position: "absolute", right: "0.8rem", width: "1rem", height: "1rem", color: "var(--tos-subtle)", pointerEvents: "none" }} />
        <input 
          value={q} 
          onChange={(e) => setQ(e.target.value)} 
          placeholder="ابحث عن قبطان بالاسم أو اللقب…" 
          aria-label="ابحث عن قرصان"
          style={{
            width: "100%",
            padding: "0.6rem 2.4rem 0.6rem 2.2rem",
            fontSize: "0.85rem",
            borderRadius: "0.9rem",
            background: "var(--tos-card)",
            border: "1px solid var(--tos-line)",
            color: "var(--tos-text)",
            outline: "none",
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            style={{ position: "absolute", left: "0.7rem", background: "none", border: 0, color: "var(--tos-subtle)", cursor: "pointer", padding: "0.2rem" }}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {found ? (
        found.length ? (
          <ol className="ranking-list">
            {found.map((p) => (
              <li key={p.id}>
                <button type="button" className="pirate-row" onClick={() => onPick?.(p)}>
                  <CaptainAvatar seed={p.avatar_index ?? 0} url={p.avatar_url} className="ranking-avatar" />
                  <strong>{p.name}</strong>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem" }}>
                    <Compass size={14} /> عرض المحيط
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState icon={Users} title="لا يوجد قرصان بهذا الاسم" detail="تأكد من كتابة الاسم أو جرّب أحرفاً أخرى." />
        )
      ) : (
        <>
          <nav className="dock-tabs dock-tabs-wrap" aria-label="تصنيفات اللاعبين">
            {boards.map(({ id, label, icon: Icon }) => (
              <Button 
                key={id} 
                variant="ghost" 
                className={board === id ? "dock-tab active" : "dock-tab"} 
                onClick={() => setBoard(id)}
              >
                <Icon size={16} />
                {label}
              </Button>
            ))}
          </nav>

          {board === "events" || board === "live" ? (
            <LiveDuels me={me ?? null} online={online} onRefresh={onRefresh} onPick={(p) => onPick?.(p)} />
          ) : (
            <>
              <div className="dock-section-heading">
                <Trophy size={20} />
                <strong>{boards.find((item) => item.id === board)?.label}</strong>
              </div>
              {loading ? (
                <p className="dock-loading">جارٍ تحميل الترتيب…</p>
              ) : players.length ? (
                <ol className="ranking-list">
                  {players.map((player, i) => (
                    <li 
                      key={player.id} 
                      onClick={() => onPick?.(player)} 
                      style={{ cursor: onPick ? "pointer" : undefined }}
                    >
                      <b className="ranking-position">{String(i + 1).padStart(2, "0")}</b>
                      <CaptainAvatar seed={player.avatar_index ?? 0} url={player.avatar_url} className="ranking-avatar" />
                      <strong>{player.name}</strong>
                      <span>{(player.score ?? 0).toLocaleString("ar")} نقطة</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <EmptyState icon={Trophy} title="لا يوجد لاعبون في الترتيب بعد" detail="تظهر النتائج بعد بدء اللعب." />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export function InventoryWindow({ player }: { player: Player | null }) {
  const theme = getTheme(player?.theme_id ?? "");
  const [category, setCategory] = useState("أسلحة");
  const categories = ["أسلحة", "طواقم", "دروع", "خلفيات"];
  return (
    <div className="dock-content">
      <nav className="dock-tabs" aria-label="أقسام المخزن">
        {categories.map((item) => (
          <Button key={item} variant="ghost" className={category === item ? "dock-tab active" : "dock-tab"} onClick={() => setCategory(item)}>
            {item}
          </Button>
        ))}
      </nav>
      {category === "خلفيات" && player ? (
        <div className="inventory-world">
          <img src={theme.day.poster} alt="" />
          <div><strong>{theme.name}</strong><span>الخلفية الحالية</span></div>
        </div>
      ) : (
        <EmptyState 
          icon={Shield} 
          title={player ? `لا توجد ${category} في مخزنك` : "سجل دخولك لعرض مخزنك"} 
          detail={player ? "ستظهر هنا مقتنياتك عند إتاحتها داخل اللعبة." : "المخزن مرتبط بحساب القبطان."} 
        />
      )}
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail }: { icon: typeof Bell; title: string; detail: string }) {
  return (
    <div className="dock-empty">
      <Icon size={40} strokeWidth={1.4} />
      <strong>{title}</strong>
      <span>{detail}</span>
    </div>
  );
}

export function AlertsWindow() {
  return (
    <div className="dock-content">
      <div className="dock-section-heading">
        <Bell size={20} />
        <strong>سجل التنبيهات</strong>
      </div>
      <EmptyState icon={Bell} title="لا توجد تنبيهات حالياً" detail="تظهر هنا أخبار الهجمات والسرقات عندما تقع فعلاً." />
    </div>
  );
}

export function EnemiesWindow() {
  return (
    <div className="dock-content">
      <div className="dock-section-heading">
        <Skull size={20} />
        <strong>قائمة الأعداء</strong>
      </div>
      <EmptyState icon={Users} title="قائمة الأعداء فارغة" detail="يظهر هنا اللاعبون المرتبطون بهجمات مسجلة عليك." />
    </div>
  );
}
