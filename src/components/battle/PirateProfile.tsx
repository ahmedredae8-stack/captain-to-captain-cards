import { useMemo, useState, useEffect, useRef } from "react";
import { Anchor, Fish, LogOut, MessageCircle, Shield, Swords, Users, X, Sparkles } from "lucide-react";
import SeaScene from "@/components/SeaScene";
import { CaptainAvatar } from "@/components/GameSprite";
import { fleetCatalog, type FleetShip } from "@/lib/fleetCatalog";
import { getSeaWorld, SEA_WORLDS } from "@/lib/seaWorld";
import { CREWS } from "@/lib/items";
import { WEAPONS } from "@/game/duel";
import { FISH, saveHaul, type FishId } from "@/lib/catches";
import { playSfx } from "@/lib/sound";
import { useLiveShips } from "@/lib/shipOverrides";
import type { Player } from "@/lib/player";
import WeaponsLayer, { type WeaponsApi, type WeaponId } from "@/fx/weapons/WeaponsLayer";
import { CAPTAINS } from "@/lib/art";

// Card arts from battle arena
import cannonArt from "@/assets/cards/cannon.jpg";
import mortarArt from "@/assets/cards/mortar.jpg";
import missileArt from "@/assets/cards/missile.jpg";
import torpedoArt from "@/assets/cards/torpedo.jpg";
import fireBarrelArt from "@/assets/cards/fire_barrel.jpg";
import frostShellArt from "@/assets/cards/frost_shell.jpg";
import harpoonArt from "@/assets/cards/harpoon.jpg";
import shieldArt from "@/assets/cards/shield.jpg";
import royalArt from "@/assets/cards/royal.jpg";

const CARD_ART_MAP: Record<string, string> = {
  cannon: cannonArt,
  mortar: mortarArt,
  missile: missileArt,
  torpedo: torpedoArt,
  fire_barrel: fireBarrelArt,
  frost_shell: frostShellArt,
  harpoon: harpoonArt,
  shield: shieldArt,
  royal: royalArt,
};

const hash = (value: string) => {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

// Safe audio trigger that uses new sfx if present or falls back to built-ins
function playCustomAudio(type: "cannon" | "sail" | "shield" | "creak" | "click") {
  const map: Record<string, string> = {
    cannon: "/sfx/cannon.mp3",
    sail: "/sfx/sail.mp3",
    shield: "/sfx/shield.mp3",
    creak: "/sfx/creak.mp3",
    click: "/sfx/click.mp3",
  };
  try {
    const audio = new Audio(map[type]);
    audio.volume = type === "cannon" ? 0.75 : 0.6;
    audio.play().catch(() => {
      // Fallback to default game sound system
      if (type === "cannon" || type === "shield") playSfx("click", 0.9);
      else if (type === "sail") playSfx("click", 0.6);
      else playSfx("click", 0.5);
    });
  } catch {
    playSfx("click", 0.5);
  }
}

type TargetShip = {
  id: number;
  ship: FleetShip;
  hp: number;
  maxHp: number;
  fishId: FishId;
  fishQty: number;
  sunk: boolean;
  x: number;
  y: number;
};

type Modal = "attack" | "plunder" | "support" | null;

export function PirateProfile({
  player,
  isMe,
  live,
  onClose,
  onMessage,
}: {
  player: Player;
  live?: boolean;
  isMe: boolean;
  onClose: () => void;
  onMessage: () => void;
  onAttack?: () => void;
}) {
  const seed = useMemo(() => hash(player.id), [player.id]);
  const world = useMemo(
    () => (player.theme_id ? getSeaWorld(player.theme_id) : SEA_WORLDS[seed % SEA_WORLDS.length]!),
    [player.theme_id, seed]
  );
  const myShips = useLiveShips(false);

  // Sea turbulence increases when attacking or in enemy waters
  const [stormLevel, setStormLevel] = useState<number>(1.8);
  const [isAttacking, setIsAttacking] = useState(false);

  const [fleet, setFleet] = useState<TargetShip[]>(() => {
    // Natural positions for ships anchored in the waters
    const points = [
      { x: 24, y: 56 },
      { x: 50, y: 68 },
      { x: 76, y: 58 },
    ];
    return points.map((p, i) => {
      const ship = fleetCatalog[(seed + i * 3) % Math.min(fleetCatalog.length, 8)] ?? fleetCatalog[0]!;
      const fishId = (["sardine", "mackerel", "tuna"] as FishId[])[(seed + i) % 3]!;
      return {
        id: i,
        ship,
        hp: 160,
        maxHp: 160,
        fishId,
        fishQty: 25 + ((seed * (i + 1)) % 45),
        sunk: false,
        ...p,
      };
    });
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [travelling, setTravelling] = useState<{ targetId: number; ship: string } | null>(null);
  const weaponsRef = useRef<WeaponsApi | null>(null);
  const [hitFx, setHitFx] = useState<{ targetId: number; text: string } | null>(null);

  const target = fleet.find((s) => s.id === selectedId) ?? null;

  // Ambient ship creaking upon entering ocean
  useEffect(() => {
    playCustomAudio("creak");
  }, []);

  // Filter available weapons from player's fleet ships
  const availableWeapons = useMemo(() => {
    const ids = [...new Set(myShips.flatMap((s) => s.data.weapons))];
    const supported: WeaponId[] = ["cannon", "mortar", "missile", "torpedo", "fire_barrel", "frost_shell", "harpoon"];
    const catalog = ids.length > 0 ? ids : ["cannon", "mortar", "missile"];
    return catalog.filter((id): id is WeaponId => supported.includes(id as WeaponId)).map((id) => {
      const w = WEAPONS[id] ?? { name: id, dmg: 25, type: "kinetic" };
      return { id, name: w.name, dmg: w.dmg, type: w.type, art: CARD_ART_MAP[id] ?? cannonArt };
    });
  }, [myShips]);

  const attack = async (weaponId: string) => {
    if (!target) return;
    const weapon = availableWeapons.find((w) => w.id === weaponId);
    if (!weapon || !weaponsRef.current) return;
    const id = target.id;
    const layer = document.querySelector<HTMLElement>(".enemy-weapons-host");
    const targetEl = document.querySelector<HTMLElement>(`[data-enemy-ship="${id}"]`);
    const layerRect = layer?.getBoundingClientRect();
    const targetRect = targetEl?.getBoundingClientRect();
    if (!layerRect || !targetRect) return;
    setModal(null);
    playCustomAudio("cannon");
    setStormLevel(3.0);
    setIsAttacking(true);
    setNotice(`💣 إطلاق «${weapon.name}» نحو سفينة «${target.ship.name}»!`);
    try {
      await weaponsRef.current.fire({
        weapon: weapon.id,
        from: { x: layerRect.width * 0.5, y: layerRect.height - 58 },
        to: { x: targetRect.left + targetRect.width / 2 - layerRect.left, y: targetRect.top + targetRect.height / 2 - layerRect.top },
        outcome: "hit",
        onImpact: () => {
          setFleet((items) => items.map((s) => {
            if (s.id !== id) return s;
            const hp = Math.max(0, s.hp - weapon.dmg);
            return { ...s, hp, sunk: hp === 0 };
          }));
          setHitFx({ targetId: id, text: `-${weapon.dmg} ضرر` });
          window.setTimeout(() => setHitFx(null), 1400);
        },
      });
    } finally {
      setIsAttacking(false);
      setStormLevel(1.8);
    }
  };

  const plunder = async (ship: ReturnType<typeof useLiveShips>[number]) => {
    if (!target) return;
    const id = target.id;
    setModal(null);
    setTravelling({ targetId: id, ship: ship.name });
    setNotice(`⛵ سفينتك «${ship.name}» تبحر وسط الأمواج للنهب...`);
    playCustomAudio("sail");

    window.setTimeout(async () => {
      const current = fleet.find((s) => s.id === id);
      if (!current || current.sunk || current.fishQty <= 0) {
        setNotice("لم تعد هناك حمولة سمك قابلة للنهب.");
        setTravelling(null);
        return;
      }
      const qty = Math.min(current.fishQty, Math.max(1, Math.floor(current.fishQty * 0.4)));
      await saveHaul([{ id: current.fishId, qty }]);
      setFleet((items) =>
        items.map((s) => (s.id === id ? { ...s, fishQty: Math.max(0, s.fishQty - qty) } : s))
      );
      setNotice(`🏴‍☠️ نجحت الغارة! استولت «${ship.name}» على ${qty} سمكة.`);
      window.setTimeout(() => setTravelling(null), 1500);
    }, 1800);
  };

  const support = (crewName: string) => {
    if (!target) return;
    const id = target.id;
    setModal(null);
    playCustomAudio("shield");
    setFleet((items) =>
      items.map((s) => (s.id === id ? { ...s, hp: Math.min(s.maxHp, s.hp + 40), sunk: false } : s))
    );
    setHitFx({ targetId: id, text: "+40 ترميم" });
    setNotice(`🛡️ وصل الطاقم «${crewName}» وتم ترميم سفينة «${target.ship.name}».`);
    window.setTimeout(() => setHitFx(null), 1400);
  };

  return (
    <div className={`enemy-ocean ${isAttacking ? "is-storming" : ""}`} role="dialog" aria-modal="true" dir="rtl">
      {/* Dynamic 3D ocean scene with responsive waves */}
      <SeaScene
        theme={world}
        params={{ amp: stormLevel, spd: stormLevel * 0.85, foam: stormLevel * 0.75, rip: stormLevel * 0.8 }}
        className="enemy-ocean-canvas"
      />
      <div className="enemy-ocean-shade" />

      {/* TOP HEADER: Styled exactly after the DailyReward golden banner panel */}
      <div className="enemy-top-wrapper">
        <header className="daily-panel enemy-header-panel">
          <div className="enemy-header-content">
            <div className="enemy-captain-badge">
              <div className="enemy-avatar-ring">
                <CaptainAvatar seed={player.avatar_index ?? 0} url={player.avatar_url} className="enemy-avatar-img" />
              </div>
              <div className="enemy-captain-meta">
                <span className="daily-kicker">محيط القبطان الخصم</span>
                <h1 className="daily-title enemy-c-name">{player.name}</h1>
                <div className="enemy-status-row">
                  <span className={`enemy-live-dot ${live ? "online" : "offline"}`} />
                  <small>{live ? "🟢 متصل الآن" : "⚪ في الميناء"} · عالم {world.name}</small>
                </div>
              </div>
            </div>

            <div className="enemy-header-actions">
              {!isMe && (
                <button type="button" className="tos-btn enemy-btn-msg" onClick={onMessage}>
                  <MessageCircle className="h-4 w-4" />
                  <span>مراسلة</span>
                </button>
              )}
              <button type="button" className="tos-btn enemy-btn-exit" onClick={onClose} aria-label="خروج من المحيط">
                <LogOut className="h-4 w-4" />
                <span>خروج</span>
              </button>
            </div>
          </div>
        </header>
      </div>

      {notice && <div className="enemy-toast" role="status"><Sparkles className="h-4 w-4 inline ml-1 text-amber-400" />{notice}</div>}

      {/* MAIN OCEAN STAGE */}
      <main className="enemy-sea-area" onClick={() => setSelectedId(null)}>
        {/* Reuse the exact live weapon FX engines from the full battle arena */}
        <div className="enemy-weapons-host"><WeaponsLayer ref={weaponsRef} /></div>

        {/* Damage / Heal numbers floating above target */}
        {hitFx && (
          <div
            className={`enemy-hit-float ${hitFx.text.startsWith("+") ? "heal" : "dmg"}`}
            style={{
              left: `${fleet[hitFx.targetId]?.x ?? 50}%`,
              top: `${(fleet[hitFx.targetId]?.y ?? 50) - 15}%`,
            }}
          >
            {hitFx.text}
          </div>
        )}

        {/* Enemy Ships: floating naturally on water without rectangular boxes */}
        {fleet.map((s) => {
          const fish = FISH.find((f) => f.id === s.fishId);
          const chosen = selectedId === s.id;

          return (
            <div
              key={s.id}
              className={`enemy-ship-spot ${chosen ? "is-chosen" : ""} ${s.sunk ? "is-sunk" : ""}`}
              style={{ left: `${s.x}%`, top: `${s.y}%` }}
              data-enemy-ship={s.id}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedId(s.id);
                setNotice("");
                playCustomAudio("click");
              }}
            >
              {/* Natural water ripple and foam effect beneath the hull */}
              <div className="enemy-water-wake" />

              {/* THREE ACTION BUTTONS: Pure DailyReward luxury golden style */}
              {chosen && (
                <div className="enemy-ship-actions-orbit" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="enemy-act-btn act-attack"
                    disabled={s.sunk}
                    onClick={() => setModal("attack")}
                  >
                    <div className="enemy-act-icon-wrap">
                      <Swords className="h-5 w-5" />
                    </div>
                    <b>هجوم</b>
                  </button>

                  <button
                    type="button"
                    className="enemy-act-btn act-plunder"
                    disabled={s.sunk || s.fishQty <= 0}
                    onClick={() => setModal("plunder")}
                  >
                    <div className="enemy-act-icon-wrap">
                      <Fish className="h-5 w-5" />
                    </div>
                    <b>نهب</b>
                  </button>

                  <button
                    type="button"
                    className="enemy-act-btn act-support"
                    onClick={() => setModal("support")}
                  >
                    <div className="enemy-act-icon-wrap">
                      <Shield className="h-5 w-5" />
                    </div>
                    <b>دعم</b>
                  </button>
                </div>
              )}

              {/* Plundering Raider sailing animation */}
              {travelling?.targetId === s.id && (
                <div className="enemy-raider-ship">
                  <span className="raider-hull">⛵</span>
                  <small>{travelling.ship}</small>
                </div>
              )}

              {/* The ship hull itself with transparent background */}
              <div className="enemy-ship-hull-wrap">
                <img src={s.ship.hull} alt={s.ship.name} className="enemy-ship-graphic" />
                <div className="enemy-ship-water-reflection" />
              </div>

              {/* Sleek Golden Pill Tag under the ship */}
              <div className="enemy-ship-tag">
                <div className="enemy-ship-hp-bar">
                  <div className="enemy-ship-hp-fill" style={{ width: `${(s.hp / s.maxHp) * 100}%` }} />
                </div>
                <div className="enemy-ship-labels">
                  <span className="enemy-ship-title">{s.ship.name}</span>
                  <span className="enemy-ship-fish">
                    <Fish className="h-3 w-3 inline text-cyan-300 ml-1" />
                    {s.fishQty} {fish?.name ?? "سمكة"}
                  </span>
                </div>
                {s.sunk && <span className="enemy-sunk-badge">غرقت</span>}
              </div>
            </div>
          );
        })}
      </main>

      {/* Target Info Bar at bottom */}
      {target && (
        <div className="enemy-target-dock">
          <Anchor className="h-4 w-4 text-amber-400" />
          <span>السفينة المختارة: <b>{target.ship.name}</b></span>
          <span className="text-cyan-300">| حمولة الصيد: {target.fishQty} سمكة</span>
          <button type="button" onClick={() => setSelectedId(null)} className="enemy-dock-close" aria-label="إلغاء التحديد">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* MODAL: SELECTION OF WEAPONS / PLUNDER / SUPPORT (Exact DailyReward Design) */}
      {modal && target && (
        <div className="daily-overlay enemy-modal-overlay" onClick={() => setModal(null)}>
          <div className="daily-panel enemy-popup-panel" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="tos-x" aria-label="إغلاق" onClick={() => setModal(null)}>
              <X className="h-4 w-4" />
            </button>

            <header className="daily-head">
              <span className="daily-kicker">
                {modal === "attack" ? "ترسانة المدافع والأسلحة" : modal === "plunder" ? "أسطول الغارات والنهب" : "قباطنة وطواقم الإسناد"}
              </span>
              <h2 className="daily-title">
                {modal === "attack"
                  ? `اختر سلاحاً لقصف «${target.ship.name}»`
                  : modal === "plunder"
                  ? `اختر سفينة لنهب صيد «${target.ship.name}»`
                  : `أرسل قبطاناً أو طاقماً لدعم «${target.ship.name}»`}
              </h2>
              <div className="daily-streak">
                <b>{modal === "attack" ? target.hp : modal === "plunder" ? target.fishQty : "+40"}</b>
                <span>{modal === "attack" ? `من ${target.maxHp} درع` : modal === "plunder" ? "سمكة متوفرة" : "نقطة صيانة"}</span>
              </div>
            </header>

            {/* WEAPON CARDS: EXACT CARDS AS IN BATTLE SCREEN */}
            {modal === "attack" && (
              <div className="enemy-cards-grid">
                {availableWeapons.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className="enemy-battle-card"
                    onClick={() => attack(w.id)}
                  >
                    <div className="enemy-card-art-box">
                      <img src={w.art} alt={w.name} className="enemy-card-art" />
                      <span className="enemy-card-badge">💥 {w.dmg}</span>
                    </div>
                    <div className="enemy-card-info">
                      <strong className="enemy-card-title">{w.name}</strong>
                      <small className="enemy-card-sub">ضرر قصف {w.dmg} نقطة</small>
                    </div>
                    <span className="tos-btn enemy-card-fire-btn">إطلاق السلاح</span>
                  </button>
                ))}
              </div>
            )}

            {/* PLUNDER FLEET SELECTION */}
            {modal === "plunder" && (
              <div className="enemy-cards-grid">
                {myShips.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className="enemy-battle-card"
                    onClick={() => void plunder(s)}
                  >
                    <div className="enemy-card-art-box">
                      <img src={s.hull} alt={s.name} className="enemy-ship-preview-art" />
                    </div>
                    <div className="enemy-card-info">
                      <strong className="enemy-card-title">{s.name}</strong>
                      <small className="enemy-card-sub">سفينة إغارة سريعة</small>
                    </div>
                    <span className="tos-btn enemy-card-fire-btn">إرسال للنهب</span>
                  </button>
                ))}
              </div>
            )}

            {/* SUPPORT CREW: REAL CAPTAIN / CREW PORTRAITS AS IN CAPTAINS WINDOW */}
            {modal === "support" && (
              <div className="enemy-cards-grid">
                {CREWS.map((crew, idx) => {
                  const portrait = CAPTAINS[idx % CAPTAINS.length] ?? CAPTAINS[0];
                  return (
                    <button
                      key={crew.id}
                      type="button"
                      className="enemy-battle-card"
                      onClick={() => support(crew.name)}
                    >
                      <div className="enemy-card-art-box">
                        <img src={portrait} alt={crew.name} className="enemy-crew-portrait" />
                        <span className="enemy-card-badge text-emerald-300">🛡️ +40</span>
                      </div>
                      <div className="enemy-card-info">
                        <strong className="enemy-card-title">{crew.name}</strong>
                        <small className="enemy-card-sub">{crew.desc}</small>
                      </div>
                      <span className="tos-btn enemy-card-fire-btn">إرسال الإسناد</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Integrated CSS Styles */}
      <style>{`
        .enemy-ocean {
          position: fixed;
          inset: 0;
          z-index: 220;
          overflow: hidden;
          background: #040d18;
          color: #fff;
          display: flex;
          flex-direction: column;
          user-select: none;
        }
        .enemy-ocean-canvas {
          position: absolute !important;
          inset: 0;
          width: 100% !important;
          height: 100% !important;
          z-index: 0;
        }
        .enemy-ocean-shade {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: radial-gradient(circle at 50% 30%, transparent 40%, rgba(3, 11, 20, 0.65) 100%),
                      linear-gradient(180deg, rgba(2, 8, 16, 0.7) 0%, transparent 20%, rgba(2, 8, 16, 0.5) 100%);
        }
        .is-storming .enemy-ocean-shade {
          background: radial-gradient(circle at 50% 30%, rgba(255, 230, 160, 0.1) 0%, rgba(2, 8, 18, 0.85) 100%);
          animation: storm-flash 1.2s ease-in-out infinite alternate;
        }
        @keyframes storm-flash {
          0% { filter: brightness(1); }
          50% { filter: brightness(1.2) contrast(1.1); }
          100% { filter: brightness(0.95); }
        }

        /* TOP BANNER / HUD IN DAILY REWARD DESIGN */
        .enemy-top-wrapper {
          position: relative;
          z-index: 10;
          padding: max(0.6rem, env(safe-area-inset-top)) 1rem 0;
          display: flex;
          justify-content: center;
        }
        .enemy-header-panel {
          width: min(100%, 46rem) !important;
          padding: 0.75rem 1.25rem !important;
          border-radius: 1.2rem !important;
          background: radial-gradient(120% 60% at 50% 0%, rgba(245, 202, 102, 0.22), transparent 70%),
                      linear-gradient(165deg, rgba(25, 45, 68, 0.96), rgba(8, 18, 30, 0.98)) !important;
          border: 1px solid rgba(245, 202, 102, 0.55) !important;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.75), 0 0 25px rgba(245, 202, 102, 0.2) !important;
        }
        .enemy-header-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .enemy-captain-badge {
          display: flex;
          align-items: center;
          gap: 0.9rem;
        }
        .enemy-avatar-ring {
          width: 3.4rem;
          height: 3.4rem;
          border-radius: 50%;
          border: 2px solid #eabf5b;
          box-shadow: 0 0 15px rgba(234, 191, 91, 0.45);
          overflow: hidden;
          flex-shrink: 0;
          background: #071523;
        }
        .enemy-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .enemy-captain-meta {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .enemy-c-name {
          margin: 0 !important;
          text-align: right !important;
          font-size: 1.15rem !important;
          color: #f7d684 !important;
          text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
        }
        .enemy-status-row {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          color: #cbd5e1;
          font-size: 0.75rem;
        }
        .enemy-live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        .enemy-live-dot.online {
          background: #4ade80;
          box-shadow: 0 0 8px #4ade80;
        }
        .enemy-live-dot.offline {
          background: #94a3b8;
        }
        .enemy-header-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .enemy-btn-msg {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.4rem !important;
          padding: 0.55rem 0.9rem !important;
          border-radius: 0.85rem !important;
          font-weight: 800 !important;
          font-size: 0.82rem !important;
          background: linear-gradient(180deg, #2563eb, #1d4ed8) !important;
          color: #fff !important;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4) !important;
          border: 1px solid rgba(147, 197, 253, 0.4) !important;
          cursor: pointer;
        }
        .enemy-btn-exit {
          display: inline-flex !important;
          align-items: center !important;
          gap: 0.4rem !important;
          padding: 0.55rem 0.95rem !important;
          border-radius: 0.85rem !important;
          font-weight: 800 !important;
          font-size: 0.82rem !important;
          background: linear-gradient(180deg, #dc2626, #991b1b) !important;
          color: #fff !important;
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4) !important;
          border: 1px solid rgba(254, 202, 202, 0.4) !important;
          cursor: pointer;
        }
        .enemy-toast {
          position: absolute;
          z-index: 25;
          top: 6.2rem;
          left: 50%;
          transform: translateX(-50%);
          width: min(92vw, 32rem);
          padding: 0.6rem 1rem;
          border-radius: 1rem;
          background: rgba(7, 21, 35, 0.95);
          border: 1px solid rgba(245, 202, 102, 0.7);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(245, 202, 102, 0.25);
          color: #ffe08b;
          font-weight: 800;
          font-size: 0.85rem;
          text-align: center;
          backdrop-filter: blur(8px);
          animation: pop-toast 0.25s cubic-bezier(0.2, 1, 0.3, 1) both;
        }
        @keyframes pop-toast {
          from { opacity: 0; transform: translate(-50%, -10px) scale(0.95); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }

        /* SEA MAIN STAGE & SHIPS */
        .enemy-sea-area {
          position: relative;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          z-index: 2;
        }
        .enemy-weapons-host { position: absolute; inset: 0; z-index: 18; pointer-events: none; }
        .enemy-ship-spot {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          cursor: pointer;
          transition: transform 0.2s ease;
        }
        .enemy-ship-spot:hover {
          transform: translate(-50%, -52%);
        }
        .enemy-ship-spot.is-sunk {
          filter: grayscale(1);
          opacity: 0.55;
        }

        /* NATURAL WATER RIPPLE / FOAM BENEATH SHIP */
        .enemy-water-wake {
          position: absolute;
          width: clamp(7.5rem, 18vw, 12rem);
          height: clamp(2rem, 5vw, 3.2rem);
          bottom: 1.8rem;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(255, 255, 255, 0.35) 0%, rgba(125, 211, 252, 0.22) 40%, transparent 75%);
          box-shadow: 0 0 25px rgba(56, 189, 248, 0.3);
          pointer-events: none;
          animation: wake-pulse 3.2s ease-in-out infinite alternate;
          z-index: 1;
        }
        @keyframes wake-pulse {
          0% { transform: scale(0.92) rotate(-1deg); opacity: 0.5; }
          100% { transform: scale(1.08) rotate(1.5deg); opacity: 0.85; }
        }

        /* SHIP GRAPHIC WITHOUT BLACK BOX */
        .enemy-ship-hull-wrap {
          position: relative;
          z-index: 2;
          background: none !important;
          border: none !important;
          animation: ship-float 3.6s ease-in-out infinite alternate;
        }
        .enemy-ship-spot:nth-child(2) .enemy-ship-hull-wrap { animation-delay: -1.2s; }
        .enemy-ship-spot:nth-child(3) .enemy-ship-hull-wrap { animation-delay: -2.4s; }
        @keyframes ship-float {
          0% { transform: translateY(0) rotate(-1deg); }
          50% { transform: translateY(-7px) rotate(1deg); }
          100% { transform: translateY(1px) rotate(-0.5deg); }
        }
        .enemy-ship-graphic {
          width: clamp(6.5rem, 17vw, 11rem);
          height: auto;
          max-height: clamp(4.5rem, 12vw, 7.5rem);
          object-fit: contain;
          filter: drop-shadow(0 12px 14px rgba(0, 0, 0, 0.75));
          display: block;
        }

        /* SHIP LABELS & HEALTH PILL */
        .enemy-ship-tag {
          position: relative;
          z-index: 3;
          margin-top: -0.4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.2rem;
          padding: 0.25rem 0.65rem 0.35rem;
          border-radius: 99px;
          background: rgba(7, 21, 35, 0.88);
          border: 1px solid rgba(245, 202, 102, 0.55);
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(4px);
        }
        .enemy-ship-hp-bar {
          width: 4.8rem;
          height: 4px;
          background: rgba(0, 0, 0, 0.75);
          border-radius: 99px;
          overflow: hidden;
        }
        .enemy-ship-hp-fill {
          height: 100%;
          background: linear-gradient(90deg, #ef4444, #eab308, #22c55e);
          transition: width 0.4s ease;
        }
        .enemy-ship-labels {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.7rem;
        }
        .enemy-ship-title {
          font-weight: 800;
          color: #f7d684;
        }
        .enemy-ship-fish {
          color: #bae6fd;
          font-size: 0.65rem;
        }
        .enemy-sunk-badge {
          position: absolute;
          top: -0.5rem;
          background: #991b1b;
          color: #fff;
          font-size: 0.62rem;
          font-weight: 900;
          padding: 0.1rem 0.4rem;
          border-radius: 99px;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);
        }

        /* THREE ACTION BUTTONS ORBIT (DailyReward Golden Luxury Style) */
        .enemy-ship-actions-orbit {
          position: absolute;
          bottom: calc(100% + 0.6rem);
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 0.75rem;
          z-index: 20;
          animation: pop-actions 0.26s cubic-bezier(0.18, 1, 0.32, 1.2) both;
        }
        @keyframes pop-actions {
          from { opacity: 0; transform: translate(-50%, 15px) scale(0.8); }
          to { opacity: 1; transform: translate(-50%, 0) scale(1); }
        }
        .enemy-act-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          background: none;
          border: none;
          cursor: pointer;
          color: #fff;
          transition: transform 0.18s ease;
        }
        .enemy-act-btn:hover:not(:disabled) {
          transform: translateY(-4px) scale(1.06);
        }
        .enemy-act-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          filter: grayscale(1);
        }
        .enemy-act-icon-wrap {
          width: 3.2rem;
          height: 3.2rem;
          border-radius: 50%;
          display: grid;
          place-items: center;
          border: 2px solid #f5ca66;
          background: radial-gradient(circle at 40% 30%, rgba(245, 202, 102, 0.45), rgba(7, 21, 35, 0.95) 75%);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(245, 202, 102, 0.45);
        }
        .act-attack .enemy-act-icon-wrap {
          border-color: #f87171;
          color: #fecaca;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(248, 113, 113, 0.5);
        }
        .act-plunder .enemy-act-icon-wrap {
          border-color: #38bdf8;
          color: #bae6fd;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(56, 189, 248, 0.5);
        }
        .act-support .enemy-act-icon-wrap {
          border-color: #4ade80;
          color: #bbf7d0;
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(74, 222, 128, 0.5);
        }
        .enemy-act-btn b {
          font-size: 0.72rem;
          font-weight: 900;
          padding: 0.15rem 0.6rem;
          border-radius: 99px;
          background: linear-gradient(180deg, #1f364d, #0b1928);
          border: 1px solid rgba(245, 202, 102, 0.4);
          color: #f7d684;
          box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
        }

        /* FLOATING DAMAGE / REPAIR */
        .enemy-hit-float {
          position: absolute;
          z-index: 35;
          transform: translate(-50%, -50%);
          font-size: 1.25rem;
          font-weight: 900;
          pointer-events: none;
          animation: float-up 1.3s cubic-bezier(0.18, 0.89, 0.32, 1.28) forwards;
          text-shadow: 0 2px 8px #000;
        }
        .enemy-hit-float.dmg {
          color: #ef4444;
          filter: drop-shadow(0 0 8px #ef4444);
        }
        .enemy-hit-float.heal {
          color: #22c55e;
          filter: drop-shadow(0 0 8px #22c55e);
        }
        @keyframes float-up {
          0% { opacity: 0; transform: translate(-50%, 10px) scale(0.7); }
          25% { opacity: 1; transform: translate(-50%, -10px) scale(1.2); }
          100% { opacity: 0; transform: translate(-50%, -45px) scale(1); }
        }

        /* PLUNDERING RAIDER SHIP */
        .enemy-raider-ship {
          position: absolute;
          z-index: 15;
          left: -40%;
          top: 10%;
          font-size: 2.2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          animation: raid-voyage 1.8s ease-in-out forwards;
        }
        .enemy-raider-ship small {
          font-size: 0.62rem;
          color: #fde047;
          background: rgba(7, 21, 35, 0.9);
          border: 1px solid #facc15;
          padding: 0.1rem 0.4rem;
          border-radius: 99px;
          white-space: nowrap;
        }
        @keyframes raid-voyage {
          0% { opacity: 0; transform: translateX(-40px); }
          25% { opacity: 1; }
          100% { opacity: 1; transform: translateX(120px); }
        }

        /* BOTTOM TARGET BAR */
        .enemy-target-dock {
          position: absolute;
          bottom: max(0.8rem, env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          z-index: 15;
          display: flex;
          align-items: center;
          gap: 0.7rem;
          padding: 0.6rem 1.1rem;
          border-radius: 99px;
          background: rgba(7, 21, 35, 0.95);
          border: 1px solid rgba(245, 202, 102, 0.6);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
          font-size: 0.8rem;
          color: #fff;
          white-space: nowrap;
        }
        .enemy-dock-close {
          background: none;
          border: none;
          color: #cbd5e1;
          cursor: pointer;
          display: grid;
          place-items: center;
        }

        /* ACTION SELECTION POPUP: CARDS & CREW (DailyReward Ornate Theme) */
        .enemy-modal-overlay {
          z-index: 250 !important;
        }
        .enemy-popup-panel {
          width: min(96vw, 44rem) !important;
          max-height: min(88svh, 48rem) !important;
          overflow-y: auto !important;
          padding: 1.25rem !important;
        }
        .enemy-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr));
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .enemy-battle-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.45rem;
          padding: 0.65rem 0.5rem 0.75rem;
          border-radius: 1rem;
          background: radial-gradient(120% 60% at 50% 0%, rgba(245, 202, 102, 0.12), transparent 70%),
                      linear-gradient(165deg, rgba(23, 40, 58, 0.95), rgba(9, 19, 29, 0.98));
          border: 1px solid rgba(245, 202, 102, 0.4);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.5);
          color: #fff;
          cursor: pointer;
          transition: transform 0.16s ease, border-color 0.16s ease;
        }
        .enemy-battle-card:hover {
          transform: translateY(-3px);
          border-color: #f7d684;
          box-shadow: 0 12px 28px rgba(0, 0, 0, 0.6), 0 0 16px rgba(247, 214, 132, 0.35);
        }
        .enemy-card-art-box {
          position: relative;
          width: 100%;
          aspect-ratio: 1;
          border-radius: 0.8rem;
          overflow: hidden;
          border: 1px solid rgba(245, 202, 102, 0.5);
          background: #05101a;
        }
        .enemy-card-art {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .enemy-crew-portrait {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .enemy-ship-preview-art {
          width: 100%;
          height: 100%;
          object-fit: contain;
          padding: 0.4rem;
        }
        .enemy-card-badge {
          position: absolute;
          bottom: 0.3rem;
          left: 0.3rem;
          background: rgba(7, 21, 35, 0.9);
          border: 1px solid rgba(245, 202, 102, 0.6);
          padding: 0.1rem 0.4rem;
          border-radius: 99px;
          font-size: 0.68rem;
          font-weight: 800;
          color: #fef08a;
        }
        .enemy-card-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .enemy-card-title {
          font-size: 0.88rem;
          color: #f7d684;
        }
        .enemy-card-sub {
          font-size: 0.68rem;
          color: #cbd5e1;
        }
        .enemy-card-fire-btn {
          margin-top: 0.2rem;
          width: 100% !important;
          padding: 0.35rem 0.5rem !important;
          font-size: 0.72rem !important;
          border-radius: 0.65rem !important;
          font-weight: 900 !important;
          color: #0c1824 !important;
          background: linear-gradient(180deg, #f7d684, #d4a742) !important;
        }

        @media (max-width: 600px) {
          .enemy-header-panel {
            padding: 0.55rem 0.8rem !important;
          }
          .enemy-avatar-ring {
            width: 2.7rem;
            height: 2.7rem;
          }
          .enemy-c-name {
            font-size: 0.98rem !important;
          }
          .enemy-btn-msg, .enemy-btn-exit {
            padding: 0.42rem 0.6rem !important;
            font-size: 0.72rem !important;
          }
          .enemy-act-icon-wrap {
            width: 2.7rem;
            height: 2.7rem;
          }
          .enemy-act-btn b {
            font-size: 0.64rem;
          }
          .enemy-cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  );
}
