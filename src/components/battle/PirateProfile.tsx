import { useState, useMemo } from "react";
import { 
  X, Swords, Fish, Users, MessageCircle, Ship 
} from "lucide-react";
import { CaptainAvatar } from "@/components/GameSprite";
import { powerOf } from "@/components/battle/BattleScreen";
import { fleetCatalog, type FleetShip } from "@/lib/fleetCatalog";
import { SEA_WORLDS } from "@/lib/seaWorld";
import { WEAPONS } from "@/game/duel";
import { CARDS } from "@/components/battle/BattleScreen";
import { CREWS } from "@/lib/items";
import { FISH, saveHaul, type FishId } from "@/lib/catches";
import { playSfx } from "@/lib/sound";
import { useLiveShips } from "@/lib/shipOverrides";
import type { Player } from "@/lib/player";

const hashSeed = (s: string) => {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

type EnemyShip = {
  id: number;
  ship: FleetShip;
  name: string;
  maxHp: number;
  hp: number;
  fishCargo: { id: FishId; name: string; qty: number; img: string }[];
  isSunk: boolean;
};

type ActionTab = "none" | "plunder" | "attack" | "support";

export function PirateProfile({
  player,
  isMe,
  live,
  onClose,
  onMessage,
  onAttack,
}: {
  player: Player;
  live?: boolean;
  isMe: boolean;
  onClose: () => void;
  onMessage: () => void;
  onAttack: () => void;
}) {
  const seed = useMemo(() => hashSeed(player.id), [player.id]);
  const world = SEA_WORLDS[seed % SEA_WORLDS.length]!;
  const myShips = useLiveShips(false);
  const online = !!live;

  // توليد أسطول سفن الخصم بحمولات أسماك قابلة للنهب
  const [enemyFleet, setEnemyFleet] = useState<EnemyShip[]>(() => {
    const list: EnemyShip[] = [];
    const count = 3;
    for (let i = 0; i < count; i++) {
      const shipIndex = (seed + i * 3) % Math.min(fleetCatalog.length, 8);
      const ship = fleetCatalog[shipIndex] ?? fleetCatalog[0]!;
      const maxHp = 100 + (ship.data?.tier ?? 1) * 35;
      
      const cargoPicks: FishId[] = ["sardine", "mackerel", "tuna"];
      const fId = cargoPicks[(seed + i) % cargoPicks.length]!;
      const fishObj = FISH.find((f) => f.id === fId) ?? FISH[0]!;
      const fishQty = 15 + ((seed * (i + 1)) % 45);

      list.push({
        id: i,
        ship,
        name: ship.name,
        maxHp,
        hp: maxHp,
        fishCargo: [{ id: fId, name: fishObj.name, qty: fishQty, img: fishObj.img }],
        isSunk: false,
      });
    }
    return list;
  });

  const [selectedShipId, setSelectedShipId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ActionTab>("none");
  const [sailingShip, setSailingShip] = useState<string | null>(null);
  const [plunderNotice, setPlunderNotice] = useState<string | null>(null);
  const [attackEffect, setAttackEffect] = useState<{ shipId: number; dmg: number } | null>(null);

  const selectedEnemyShip = selectedShipId !== null ? enemyFleet[selectedShipId] : null;

  // تنفيذ عملية سرقة السمك
  const handleStartPlunder = async (myShip: FleetShip) => {
    if (!selectedEnemyShip || selectedEnemyShip.isSunk) return;
    
    playSfx("waves", 0.7);
    setSailingShip(myShip.name);
    setActiveTab("none");
    setPlunderNotice(`سفينتك «${myShip.name}» تبحر الآن لتقف بجوار «${selectedEnemyShip.name}»...`);

    setTimeout(async () => {
      playSfx("click", 0.9);
      const stolenFish = selectedEnemyShip.fishCargo[0];
      const stolenAmount = Math.max(5, Math.floor((stolenFish?.qty ?? 20) * 0.45));

      if (stolenFish && stolenAmount > 0) {
        // حفظ الصيد المسروق في مخزن اللاعب
        await saveHaul([{ id: stolenFish.id, qty: stolenAmount }]);

        // خصم السمك من سفينة الخصم
        setEnemyFleet((prev) =>
          prev.map((s) => {
            if (s.id !== selectedEnemyShip.id) return s;
            return {
              ...s,
              fishCargo: s.fishCargo.map((c) => ({
                ...c,
                qty: Math.max(0, c.qty - stolenAmount),
              })),
            };
          })
        );

        setPlunderNotice(
          `⚔️ تمت الغارة بنجاح! قامت «${myShip.name}» بنهب ${stolenAmount} من سمك ${stolenFish.name} ونقلها إلى مخزنك!`
        );
      } else {
        setPlunderNotice(`تمت المناورة ولم يتم العثور على حمولة إضافية.`);
      }

      setSailingShip(null);
    }, 1800);
  };

  // تنفيذ الهجوم بسلاح محدد
  const handleAttackWithWeapon = (weaponId: string) => {
    if (!selectedEnemyShip || selectedEnemyShip.isSunk) return;

    playSfx("click", 1);
    const weaponData = WEAPONS[weaponId];
    const dmg = weaponData?.dmg ?? 30;

    setAttackEffect({ shipId: selectedEnemyShip.id, dmg });

    setTimeout(() => {
      setAttackEffect(null);
      setEnemyFleet((prev) =>
        prev.map((s) => {
          if (s.id !== selectedEnemyShip.id) return s;
          const nextHp = Math.max(0, s.hp - dmg);
          return {
            ...s,
            hp: nextHp,
            isSunk: nextHp === 0,
          };
        })
      );

      if (selectedEnemyShip.hp - dmg <= 0) {
        setPlunderNotice(`💥 ضربة مدمرة! تم إغراق «${selectedEnemyShip.name}» بنجاح!`);
        setActiveTab("none");
      }
    }, 700);
  };

  // دعم السفينة بالطواقم
  const handleSupportCrew = (crewId: string) => {
    if (!selectedEnemyShip) return;
    playSfx("click", 0.8);
    const crew = CREWS.find((c) => c.id === crewId);
    setEnemyFleet((prev) =>
      prev.map((s) => {
        if (s.id !== selectedEnemyShip.id) return s;
        return {
          ...s,
          hp: Math.min(s.maxHp, s.hp + 40),
        };
      })
    );
    setPlunderNotice(`🛡️ تم إرسال ${crew?.name ?? "الطاقم"}! تم دعم السفينة وترميم دروعها.`);
    setActiveTab("none");
  };

  return (
    <div
      className="daily-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`محيط ${player.name}`}
      onClick={onClose}
      dir="rtl"
      style={{ pointerEvents: "auto", overflowY: "auto", padding: "1.5rem 1rem" }}
    >
      <div
        className="daily-panel pp-panel"
        style={{ width: "min(100%, 36rem)", margin: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" aria-label="إغلاق" onClick={onClose} className="tos-x">
          <X className="h-4 w-4" />
        </button>

        {/* رأس النافذة على طراز نافذة المكافأة */}
        <header className="daily-head" style={{ marginBottom: "0.6rem" }}>
          <span className="daily-kicker">سجل القراصنة · محيط العدو</span>
          <h2 className="daily-title" style={{ fontSize: "1.8rem" }}>{player.name}</h2>
          <div className="daily-streak">
            <b>{world.name}</b>
            <span>{online ? "🟢 في البحر الآن" : "⚪ في الميناء (غير متصل)"}</span>
          </div>
        </header>

        {/* إحصائيات الأسطول والمجد */}
        <dl className="pp-stats" style={{ gridTemplateColumns: "repeat(3, 1fr)", margin: "0.5rem 0 0.8rem" }}>
          <div>
            <dt>قوة الأسطول</dt>
            <dd>{powerOf(player).toLocaleString("ar")}</dd>
          </div>
          <div>
            <dt>المجد والنقاط</dt>
            <dd>{(player.score ?? 0).toLocaleString("ar")}</dd>
          </div>
          <div>
            <dt>سفن راسية</dt>
            <dd>{enemyFleet.filter((s) => !s.isSunk).length} / {enemyFleet.length}</dd>
          </div>
        </dl>

        {/* إشعارات الغارة والنتائج */}
        {plunderNotice && (
          <div
            style={{
              padding: "0.6rem 0.8rem",
              marginBottom: "0.8rem",
              borderRadius: "0.8rem",
              background: "color-mix(in oklab, var(--tos-aqua, #38bdf8) 18%, black)",
              border: "1.5px solid var(--tos-gold, #eab308)",
              color: "#fef08a",
              fontSize: "0.85rem",
              textAlign: "center",
              fontWeight: "bold",
              animation: "fadeIn 0.3s ease",
            }}
          >
            {plunderNotice}
          </div>
        )}

        {/* محاكاة إبحار السفينة نحو الهدف */}
        {sailingShip && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.6rem",
              padding: "0.6rem",
              marginBottom: "0.8rem",
              borderRadius: "0.8rem",
              background: "linear-gradient(90deg, #1e293b, #0f172a)",
              border: "1px dashed var(--tos-gold, #eab308)",
              color: "white",
              fontSize: "0.85rem",
            }}
          >
            <Ship className="h-5 w-5 animate-bounce" style={{ color: "var(--tos-gold, #eab308)" }} />
            <span>السفينة <strong>{sailingShip}</strong> تبحر لتقف بمحاذاة سفينة العدو لنهب حمولتها...</span>
          </div>
        )}

        {/* مشهد محيط العدو العائم */}
        <div
          style={{
            position: "relative",
            minHeight: "13rem",
            borderRadius: "1.2rem",
            overflow: "hidden",
            backgroundImage: `url(${world.thumb})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            border: "2px solid color-mix(in oklab, var(--tos-gold, #eab308) 50%, transparent)",
            padding: "1rem 0.6rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "inset 0 0 40px rgba(0,0,0,0.8)",
          }}
        >
          {/* صورة القبطان العائمة في البحر */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", zIndex: 2 }}>
            <CaptainAvatar
              seed={player.avatar_index ?? 0}
              url={player.avatar_url}
              className="pp-photo"
              style={{ width: "3.2rem", height: "3.2rem", border: "2px solid var(--tos-gold, #eab308)" }}
            />
            <div style={{ background: "rgba(0,0,0,0.6)", padding: "0.2rem 0.6rem", borderRadius: "0.6rem" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--tos-gold, #eab308)", fontWeight: "bold" }}>
                محيط {player.name}
              </span>
              <p style={{ margin: 0, fontSize: "0.7rem", color: "#cbd5e1" }}>
                انقر على أي سفينة للإغارة أو الهجوم
              </p>
            </div>
          </div>

          {/* سفن العدو العائمة القابلة للنقر */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${enemyFleet.length}, 1fr)`,
              gap: "0.6rem",
              marginTop: "0.8rem",
              zIndex: 2,
            }}
          >
            {enemyFleet.map((s) => {
              const isSelected = selectedShipId === s.id;
              const hpPct = Math.round((s.hp / s.maxHp) * 100);
              const isHit = attackEffect?.shipId === s.id;

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    playSfx("click", 0.6);
                    setSelectedShipId(s.id);
                    setActiveTab("none");
                    setPlunderNotice(null);
                  }}
                  style={{
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "0.6rem 0.3rem",
                    borderRadius: "1rem",
                    background: isSelected
                      ? "radial-gradient(circle, rgba(234,179,8,0.3) 0%, rgba(15,23,42,0.85) 100%)"
                      : "rgba(15,23,42,0.75)",
                    border: isSelected
                      ? "2px solid var(--tos-gold, #eab308)"
                      : "1px solid rgba(255,255,255,0.2)",
                    boxShadow: isSelected ? "0 0 15px rgba(234,179,8,0.5)" : "none",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    transform: isHit ? "scale(0.95)" : "scale(1)",
                    opacity: s.isSunk ? 0.45 : 1,
                  }}
                >
                  <img
                    src={s.ship.hull}
                    alt={s.name}
                    style={{
                      width: "4.5rem",
                      height: "3.5rem",
                      objectFit: "contain",
                      filter: s.isSunk ? "grayscale(1) brightness(0.6)" : "drop-shadow(0 4px 6px rgba(0,0,0,0.6))",
                    }}
                  />

                  {/* شريط الصحة */}
                  <div
                    style={{
                      width: "90%",
                      height: "5px",
                      background: "rgba(0,0,0,0.5)",
                      borderRadius: "3px",
                      overflow: "hidden",
                      margin: "0.3rem 0 0.2rem",
                    }}
                  >
                    <div
                      style={{
                        width: `${hpPct}%`,
                        height: "100%",
                        background: hpPct > 50 ? "#22c55e" : hpPct > 25 ? "#eab308" : "#ef4444",
                        transition: "width 0.3s ease",
                      }}
                    />
                  </div>

                  <strong style={{ fontSize: "0.75rem", color: isSelected ? "var(--tos-gold, #eab308)" : "#f8fafc" }}>
                    {s.name}
                  </strong>

                  {/* رصيد حمولة السمك */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.2rem",
                      fontSize: "0.65rem",
                      color: "#94a3b8",
                      marginTop: "0.1rem",
                    }}
                  >
                    <Fish className="h-3 w-3" style={{ color: "#38bdf8" }} />
                    <span>{s.fishCargo[0]?.qty ?? 0} {s.fishCargo[0]?.name}</span>
                  </div>

                  {s.isSunk && (
                    <span
                      style={{
                        position: "absolute",
                        top: "35%",
                        background: "#ef4444",
                        color: "white",
                        fontSize: "0.65rem",
                        padding: "0.1rem 0.4rem",
                        borderRadius: "4px",
                        fontWeight: "bold",
                      }}
                    >
                      غارقة
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* لوحة التحكم بالسفينة المختارة بستايل نافذة المكافأة */}
        {selectedEnemyShip && (
          <div
            style={{
              marginTop: "0.8rem",
              padding: "0.8rem",
              borderRadius: "1.2rem",
              background: "rgba(15, 23, 42, 0.95)",
              border: "1.5px solid var(--tos-gold, #eab308)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.7rem",
                borderBottom: "1px solid rgba(234,179,8,0.3)",
                paddingBottom: "0.4rem",
              }}
            >
              <div>
                <span className="daily-kicker" style={{ fontSize: "0.65rem" }}>السفينة المختارة</span>
                <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--tos-gold, #eab308)" }}>
                  {selectedEnemyShip.name}
                </h3>
              </div>
              <div style={{ textAlign: "left" }}>
                <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>الحمولة الحالية</span>
                <div style={{ color: "#38bdf8", fontWeight: "bold", fontSize: "0.85rem" }}>
                  🐟 {selectedEnemyShip.fishCargo[0]?.qty ?? 0} {selectedEnemyShip.fishCargo[0]?.name}
                </div>
              </div>
            </div>

            {/* الأزرار الثلاثة الرئيسية على طراز خلايا المكافأة */}
            <div className="daily-track" style={{ gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
              {/* زر السرقة */}
              <button
                type="button"
                className={`daily-cell ${activeTab === "plunder" ? "daily-cell-now" : ""}`}
                disabled={selectedEnemyShip.isSunk}
                onClick={() => {
                  playSfx("click", 0.7);
                  setActiveTab((prev) => (prev === "plunder" ? "none" : "plunder"));
                }}
                style={{ cursor: "pointer" }}
              >
                <small>نهب</small>
                <Fish className="h-6 w-6" style={{ color: "#38bdf8", marginTop: "0.3rem" }} />
                <b>سرقة السمك</b>
              </button>

              {/* زر الهجوم */}
              <button
                type="button"
                className={`daily-cell ${activeTab === "attack" ? "daily-cell-now" : ""}`}
                disabled={selectedEnemyShip.isSunk}
                onClick={() => {
                  playSfx("click", 0.7);
                  setActiveTab((prev) => (prev === "attack" ? "none" : "attack"));
                }}
                style={{ cursor: "pointer" }}
              >
                <small>قتال</small>
                <Swords className="h-6 w-6" style={{ color: "#ef4444", marginTop: "0.3rem" }} />
                <b>هجوم بالأسلحة</b>
              </button>

              {/* زر الدعم */}
              <button
                type="button"
                className={`daily-cell ${activeTab === "support" ? "daily-cell-now" : ""}`}
                onClick={() => {
                  playSfx("click", 0.7);
                  setActiveTab((prev) => (prev === "support" ? "none" : "support"));
                }}
                style={{ cursor: "pointer" }}
              >
                <small>إسناد</small>
                <Users className="h-6 w-6" style={{ color: "#22c55e", marginTop: "0.3rem" }} />
                <b>دعم بالطواقم</b>
              </button>
            </div>

            {/* قائمة اختيار سفينتك للسرقة */}
            {activeTab === "plunder" && (
              <div style={{ marginTop: "0.8rem", animation: "fadeIn 0.2s ease" }}>
                <p style={{ fontSize: "0.75rem", color: "#e2e8f0", marginBottom: "0.5rem", fontWeight: "bold" }}>
                  اختر السفينة التي ترسلها للغارة من أسطولك (ستبحر لتقف بمحاذاة سفينته):
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(7rem, 1fr))", gap: "0.4rem" }}>
                  {myShips.slice(0, 4).map((ms) => (
                    <button
                      key={ms.id}
                      type="button"
                      onClick={() => void handleStartPlunder(ms)}
                      className="daily-cell"
                      style={{ cursor: "pointer", padding: "0.4rem", background: "rgba(30, 41, 59, 0.8)" }}
                    >
                      <img src={ms.hull} alt={ms.name} style={{ width: "3.2rem", height: "2.4rem", objectFit: "contain" }} />
                      <b style={{ fontSize: "0.7rem", marginTop: "0.2rem" }}>{ms.name}</b>
                      <span style={{ fontSize: "0.6rem", color: "var(--tos-gold, #eab308)" }}>بدء الإغارة</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* قائمة ترسانة الأسلحة للهجوم المباشر */}
            {activeTab === "attack" && (
              <div style={{ marginTop: "0.8rem", animation: "fadeIn 0.2s ease" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <p style={{ fontSize: "0.75rem", color: "#e2e8f0", margin: 0, fontWeight: "bold" }}>
                    اختر سلاحاً لضرب السفينة مباشرة:
                  </p>
                  {!isMe && (
                    <button
                      type="button"
                      onClick={() => {
                        playSfx("click", 0.9);
                        onAttack();
                      }}
                      className="tos-btn"
                      style={{ fontSize: "0.7rem", padding: "0.2rem 0.6rem" }}
                    >
                      <Swords className="h-3 w-3" /> معركة شاملة
                    </button>
                  )}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                  {CARDS.slice(0, 6).map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleAttackWithWeapon(c.id)}
                      className="daily-cell"
                      style={{ cursor: "pointer", padding: "0.4rem" }}
                    >
                      <img src={c.art} alt={c.name} style={{ width: "2.2rem", height: "2.2rem", borderRadius: "4px" }} />
                      <b style={{ fontSize: "0.7rem" }}>{c.name}</b>
                      <span style={{ fontSize: "0.6rem", color: "#ef4444" }}>{c.note}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* قائمة إرسال الطواقم للدعم */}
            {activeTab === "support" && (
              <div style={{ marginTop: "0.8rem", animation: "fadeIn 0.2s ease" }}>
                <p style={{ fontSize: "0.75rem", color: "#e2e8f0", marginBottom: "0.5rem", fontWeight: "bold" }}>
                  اختر طاقماً لإرساله ودعم السفينة:
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
                  {CREWS.slice(0, 3).map((cr) => (
                    <button
                      key={cr.id}
                      type="button"
                      onClick={() => handleSupportCrew(cr.id)}
                      className="daily-cell"
                      style={{ cursor: "pointer", padding: "0.4rem" }}
                    >
                      <img src={cr.icon} alt={cr.name} style={{ width: "2rem", height: "2rem" }} />
                      <b style={{ fontSize: "0.7rem" }}>{cr.name}</b>
                      <span style={{ fontSize: "0.6rem", color: "#22c55e" }}>{cr.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* أزرار أسفل النافذة */}
        <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.9rem" }}>
          {!isMe && (
            <button
              type="button"
              className="studio-chip pp-msg"
              style={{ flex: 1, justifyContent: "center" }}
              onClick={() => {
                playSfx("click", 0.6);
                onMessage();
              }}
            >
              <MessageCircle className="h-4 w-4" /> مراسلة القبطان
            </button>
          )}
          <button
            type="button"
            className="tos-btn daily-claim"
            style={{ flex: 1, margin: 0, justifyContent: "center" }}
            onClick={onClose}
          >
            إغلاق المحيط
          </button>
        </div>
      </div>
    </div>
  );
}
