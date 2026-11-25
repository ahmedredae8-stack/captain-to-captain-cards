import { useMemo, useState, useEffect, useRef } from "react";
import { Anchor, Fish, LogOut, MessageCircle, Shield, Swords, Users, X, Sparkles } from "lucide-react";
import SeaScene, { type SeaShip } from "@/components/SeaScene";
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
import { cachedLanes, fetchLanes, type Lane } from "@/lib/fleetLayout";

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
      else if (type === "creak") playSfx("click", 0.4);
      else playSfx("click", 0.5);
    });
  } catch {
    // Ignore audio autoplay restrictions
  }
}

interface PirateProfileProps {
  player: Player;
  isMe?: boolean;
  live?: boolean;
  onClose: () => void;
  onMessage?: () => void;
  onOpenChat?: (playerId: string) => void;
  onAttack?: () => void;
}

interface OceanEnemyShip {
  id: number;
  ship: FleetShip;
  topPct: number;
  leftPct: number;
  size: number;
  hp: number;
  maxHp: number;
  fishCargo: { id: FishId; count: number };
  sunk: boolean;
}

export function PirateProfile({ player, isMe, live, onClose, onMessage, onOpenChat, onAttack }: PirateProfileProps) {
  const seed = useMemo(() => hash(player.id || player.name), [player.id, player.name]);
  const liveShips = useLiveShips();
  const weaponsRef = useRef<WeaponsApi | null>(null);

  const worldId = player.seaWorld || SEA_WORLDS[seed % SEA_WORLDS.length].id;
  const world = useMemo(() => getSeaWorld(worldId), [worldId]);

  // Load real water berths (lanes) for this sea world so ships never land on islands or houses
  const [lanes, setLanes] = useState<Lane[]>(() => cachedLanes(worldId));

  useEffect(() => {
    let active = true;
    void fetchLanes(worldId).then((pub) => {
      if (active && pub && pub.length >= 3) {
        setLanes(pub);
      }
    });
    return () => {
      active = false;
    };
  }, [worldId]);

  // Sea turbulence state (amplifies when attacking or entering)
  const [stormLevel, setStormLevel] = useState<number>(1.8);
  const [isAttacking, setIsAttacking] = useState<boolean>(false);

  // Sound upon entering opponent's ocean
  useEffect(() => {
    playCustomAudio("creak");
  }, []);

  // Build the enemy fleet placed strictly in the natural water berths of the sea world
  const enemyFleet = useMemo<OceanEnemyShip[]>(() => {
    const pool = fleetCatalog;
    const fishKeys = Object.keys(FISH) as FishId[];
    const list: OceanEnemyShip[] = [];

    // Up to 3 main ships on the calibrated water berths (dock positions)
    const count = Math.min(3, Math.max(2, (seed % 3) + 1));

    for (let i = 0; i < count; i++) {
      const lane = lanes[i] || lanes[0] || { dockX: 51.1, dockY: 51.2, size: 28 };
      const ship = pool[(seed + i * 4) % pool.length] ?? pool[0]!;
      const maxHp = ship.data?.tier ? ship.data.tier * 60 + 80 : 120;
      const fishId = fishKeys[(seed + i * 5) % fishKeys.length] ?? "sardine";
      const fishCount = 8 + ((seed + i * 7) % 22);

      list.push({
        id: i + 1,
        ship,
        topPct: lane.dockY,
        leftPct: lane.dockX,
        size: lane.size || 28,
        hp: maxHp,
        maxHp,
        fishCargo: { id: fishId, count: fishCount },
        sunk: false,
      });
    }
    return list;
  }, [seed, lanes]);

  const [fleet, setFleet] = useState<OceanEnemyShip[]>(enemyFleet);

  // Update fleet positions when lanes are loaded from cloud
  useEffect(() => {
    setFleet((curr) =>
      curr.map((s, idx) => {
        const lane = lanes[idx] || lanes[0];
        if (!lane) return s;
        return {
          ...s,
          topPct: lane.dockY,
          leftPct: lane.dockX,
          size: lane.size || 28,
        };
      })
    );
  }, [lanes]);

  const [selectedShipId, setSelectedShipId] = useState<number | null>(enemyFleet[0]?.id ?? 1);
  const [modal, setModal] = useState<"attack" | "plunder" | "support" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hitFx, setHitFx] = useState<{ targetId: number; text: string } | null>(null);

  const target = useMemo(() => fleet.find((s) => s.id === selectedShipId), [fleet, selectedShipId]);

  // Feed ships directly into the WebGL Sea Engine so they float inside water waves
  const seaShips = useMemo<SeaShip[]>(() => {
    return fleet.map((s) => ({
      id: `enemy-ship-${s.id}`,
      src: s.ship.hull,
      x: s.leftPct / 100,
      y: s.topPct / 100,
      width: (s.size || 28) / 100,
      waterline: 0.88,
      visible: !s.sunk,
    }));
  }, [fleet]);

  // Player's own usable fleet for plundering
    // Player's own usable fleet for plundering
  const myShips = useMemo(() => {
    return fleetCatalog.map((ship, idx) => {
      const isOwned = idx === 0 || idx < 4;
      return { ship, isOwned, data: { hull: 100, weapons: ship.data?.weapons ?? ["cannon"] } };
    }).filter((s) => s.isOwned);
  }, []);


  // Weapons with card arts
  const availableWeapons = useMemo(() => {
    const ids = [...new Set(myShips.flatMap((s) => s.data.weapons))];
    const supported: WeaponId[] = ["cannon", "mortar", "missile", "torpedo", "fire_barrel", "frost_shell", "harpoon"];
    const catalog = ids.length > 0 ? ids : ["cannon", "mortar", "missile"];
    return catalog.filter((id): id is WeaponId => supported.includes(id as WeaponId)).map((id) => {
      const w = WEAPONS[id] ?? { name: id, dmg: 25, type: "kinetic" };
      return { id, name: w.name, dmg: w.dmg, type: w.type, art: CARD_ART_MAP[id] ?? cannonArt };
    });
  }, [myShips]);

  // Attack with live weapon projectile layer - exact lock-on to the ship's water location
  const attack = async (weaponId: string) => {
    if (!target) return;
    const weapon = availableWeapons.find((w) => w.id === weaponId);
    if (!weapon || !weaponsRef.current) return;
    const id = target.id;
    const layer = document.querySelector<HTMLElement>(".enemy-weapons-host");
    const layerRect = layer?.getBoundingClientRect();
    if (!layerRect) return;

    setModal(null);
    playCustomAudio("cannon");
    setStormLevel(3.2);
    setIsAttacking(true);
    setNotice(`💣 إطلاق «${weapon.name}» بدقة نحو سفينة «${target.ship.name}»!`);

    // Lock-on coordinates inside the layer: directly onto the ship's center in the water
    const toX = (target.leftPct / 100) * layerRect.width;
    const toY = (target.topPct / 100) * layerRect.height;
    const fromX = layerRect.width * 0.5;
    const fromY = layerRect.height - 40;

    try {
      await weaponsRef.current.fire({
        weapon: weapon.id,
        from: { x: fromX, y: fromY },
        to: { x: toX, y: toY },
        outcome: "hit",
        onImpact: () => {
          setFleet((items) =>
            items.map((s) => {
              if (s.id !== id) return s;
              const hp = Math.max(0, s.hp - weapon.dmg);
              return { ...s, hp, sunk: hp === 0 };
            })
          );
          setHitFx({ targetId: id, text: `-${weapon.dmg} ضرر` });
          window.setTimeout(() => setHitFx(null), 1400);
        },
      });
    } finally {
      setIsAttacking(false);
      setStormLevel(1.8);
    }
  };

  const plunder = (myShipName: string) => {
    if (!target) return;
    playCustomAudio("sail");
    const fish = FISH[target.fishCargo.id];
    const stolenCount = Math.min(target.fishCargo.count, Math.max(2, Math.floor(target.fishCargo.count * 0.5)));

    saveHaul([target.fishCargo.id]);
    setFleet((items) =>
      items.map((s) =>
        s.id === target.id
          ? { ...s, fishCargo: { ...s.fishCargo, count: Math.max(0, s.fishCargo.count - stolenCount) } }
          : s
      )
    );
    setModal(null);
    setNotice(`🏴‍☠️ أبحرت سفينتك «${myShipName}» ونهبت ${stolenCount}x من سمك ${fish?.name ?? "البحر"}!`);
    window.setTimeout(() => setNotice(null), 3600);
  };

  const support = (crewName: string) => {
    if (!target) return;
    playCustomAudio("shield");
    setFleet((items) =>
      items.map((s) =>
        s.id === target.id ? { ...s, hp: Math.min(s.maxHp, s.hp + 40), sunk: false } : s
      )
    );
    setModal(null);
    setNotice(`🛡️ انضم القبطان «${crewName}» لدعم سفينة «${target.ship.name}» وترميم دروعها (+40)!`);
    window.setTimeout(() => setNotice(null), 3600);
  };

  return (
    <div className={`enemy-ocean ${isAttacking ? "is-storming" : ""}`}>
      {/* Dynamic Animated Sea Canvas with WebGL ship rendering & sea studio water effects */}
      <SeaScene
        theme={world}
        ships={seaShips}
        params={{
          amp: 0.12 * stormLevel,
          spd: 1.3 * stormLevel,
          foam: 0.16 * stormLevel,
          rip: 1.3,
        }}
        className="enemy-ocean-canvas"
        style={{ width: "100%", height: "100%" }}
      />

      {/* Atmospheric Vignette & Storm Flash */}
      <div className="enemy-ocean-shade" />

      {/* Weapons Layer for true battle projectile animations */}
      <div className="enemy-weapons-host">
        <WeaponsLayer ref={weaponsRef} />
      </div>

      {/* TOP HEADER: DAILY REWARD LUXURY STYLE */}
      <header className="enemy-top-wrapper">
        <div className="daily-panel enemy-header-panel">
          <div className="daily-head enemy-head-content">
            <div className="enemy-captain-badge">
              <div className="enemy-avatar-ring">
                <CaptainAvatar seed={player.avatar_index ?? 0} url={player.avatar_url} />

              </div>
              <div className="enemy-player-meta">
                <span className="daily-kicker">محيط الخصم • {world.name}</span>
                <h1 className="daily-title enemy-c-name">
                  {player.name}
                  {player.rank && <span className="enemy-c-rank">[{player.rank}]</span>}
                </h1>
              </div>
            </div>

            <div className="enemy-header-actions">
              {(onOpenChat || onMessage) && (
                <button
                  type="button"
                  className="tos-btn enemy-btn-msg"
                  onClick={() => {
                    playCustomAudio("click");
                    if (onMessage) onMessage();
                    else if (onOpenChat) onOpenChat(player.id);
                  }}
                  title="مراسلة القرصان"
                >
                  <MessageCircle size={17} />
                  <span>مراسلة</span>
                </button>
              )}
              {onAttack && !isMe && (
                <button
                  type="button"
                  className="tos-btn enemy-btn-attack"
                  onClick={() => {
                    playCustomAudio("cannon");
                    onAttack();
                  }}
                  title="بدء المعركة"
                >
                  <Swords size={17} />
                  <span>قتال</span>
                </button>
              )}
              <button
                type="button"
                className="tos-btn enemy-btn-exit"
                onClick={() => {
                  playCustomAudio("click");
                  onClose();
                }}
                title="الخروج من المحيط"
              >
                <LogOut size={17} />
                <span>الخروج</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notice && (
        <div className="enemy-notice-banner">
          <Sparkles size={16} className="text-amber-400 animate-spin" />
          <span>{notice}</span>
        </div>
      )}

      {/* HIT DAMAGE POPUP OVER TARGET SHIP */}
      {hitFx && (
        <div
          className="enemy-hit-fx"
          style={{
            top: `${fleet.find((s) => s.id === hitFx.targetId)?.topPct ?? 50}%`,
            left: `${fleet.find((s) => s.id === hitFx.targetId)?.leftPct ?? 50}%`,
          }}
        >
          {hitFx.text}
        </div>
      )}

      {/* INTERACTIVE OVERLAY OVER WATER BERTHS: RETICLE, HITBOX & HUD */}
      <div className="enemy-ships-layer">
        {fleet.map((s) => {
          const isSelected = selectedShipId === s.id;
          const fish = FISH[s.fishCargo.id];
          const hpPct = Math.round((s.hp / s.maxHp) * 100);

          return (
            <div
              key={s.id}
              data-enemy-ship={s.id}
              className={`enemy-ship-spot ${isSelected ? "is-selected" : ""} ${s.sunk ? "is-sunk" : ""}`}
              style={{
                top: `${s.topPct}%`,
                left: `${s.leftPct}%`,
              }}
              onClick={() => {
                playCustomAudio("click");
                setSelectedShipId(s.id);
              }}
            >
              {/* Fallback Hull (visible if WebGL canvas is still loading) */}
              <div className="ship-fallback-hull">
                <img
                  src={s.ship.hull}
                  alt={s.ship.name}
                  className="enemy-ship-img"
                  draggable={false}
                />
              </div>

              {/* Target Indicator Reticle */}
              {isSelected && !s.sunk && <div className="enemy-ship-reticle" />}

              {/* Sunk Marker */}
              {s.sunk && <div className="enemy-sunk-marker">غارقة ☠️</div>}

              {/* Floating Health & Fish HUD Bar */}
              {!s.sunk && (
                <div className="enemy-ship-hud">
                  <span className="enemy-ship-name-tag">{s.ship.name}</span>
                  <div className="enemy-hp-track">
                    <div
                      className={`enemy-hp-fill ${hpPct < 30 ? "hp-danger" : hpPct < 60 ? "hp-mid" : ""}`}
                      style={{ width: `${hpPct}%` }}
                    />
                  </div>
                  {s.fishCargo.count > 0 && (
                    <div className="enemy-fish-badge">
                      <Fish size={11} />
                      <span>{s.fishCargo.count}</span>
                      <small>{fish?.name ?? "سمك"}</small>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* FLOATING ACTION DOCK: 3 ROYAL BUTTONS (ATTACK, PLUNDER, SUPPORT) */}
      {target && !target.sunk && (
        <div className="enemy-action-dock">
          <div className="enemy-action-bar daily-panel">
            <button
              type="button"
              className="enemy-act-btn btn-attack"
              onClick={() => {
                playCustomAudio("click");
                setModal("attack");
              }}
            >
              <div className="enemy-act-icon-wrap">
                <Swords size={22} />
              </div>
              <b>هجوم بالسلاح</b>
              <small>قصف وتدمير</small>
            </button>

            <button
              type="button"
              className="enemy-act-btn btn-plunder"
              onClick={() => {
                playCustomAudio("click");
                setModal("plunder");
              }}
            >
              <div className="enemy-act-icon-wrap">
                <Anchor size={22} />
              </div>
              <b>نهب وسرقة</b>
              <small>إرسال سفينة صيد</small>
            </button>

            <button
              type="button"
              className="enemy-act-btn btn-support"
              onClick={() => {
                playCustomAudio("click");
                setModal("support");
              }}
            >
              <div className="enemy-act-icon-wrap">
                <Shield size={22} />
              </div>
              <b>دعم وإسناد</b>
              <small>إرسال قبطان وطاقم</small>
            </button>
          </div>
        </div>
      )}

      {/* MODAL POPUPS IN DAILY REWARD STYLE */}
      {modal && (
        <div className="enemy-modal-backdrop" onClick={() => setModal(null)}>
          <div className="daily-panel enemy-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="daily-head enemy-modal-head">
              <div>
                <span className="daily-kicker">
                  {modal === "attack" ? "ترسانة المعارك" : modal === "plunder" ? "أسطول النهب" : "طاقم الإسناد"}
                </span>
                <h3 className="daily-title">
                  {modal === "attack"
                    ? "اختر سلاحك لإطلاقه على السفينة"
                    : modal === "plunder"
                    ? "اختر سفينتك لسرقة السمك"
                    : "اختر قبطاناً لدعم وترميم السفينة"}
                </h3>
              </div>
              <button type="button" className="tos-x" onClick={() => setModal(null)}>
                <X size={18} />
              </button>
            </div>

            {/* ATTACK WEAPONS: REAL CARD ARTWORK */}
            {modal === "attack" && (
              <div className="enemy-cards-grid">
                {availableWeapons.map((weapon) => (
                  <button
                    key={weapon.id}
                    type="button"
                    className="enemy-battle-card"
                    onClick={() => attack(weapon.id)}
                  >
                    <div className="enemy-card-art-box">
                      <img src={weapon.art} alt={weapon.name} className="enemy-card-art" />
                      <span className="enemy-card-badge">💥 {weapon.dmg} ضرر</span>
                    </div>
                    <div className="enemy-card-info">
                      <strong className="enemy-card-title">{weapon.name}</strong>
                      <small className="enemy-card-sub">سلاح {weapon.type}</small>
                    </div>
                    <span className="tos-btn enemy-card-fire-btn">إطلاق القذيفة</span>
                  </button>
                ))}
              </div>
            )}

            {/* PLUNDER FLEET: SELECTION OF OWN SHIPS */}
            {modal === "plunder" && (
              <div className="enemy-cards-grid">
                {myShips.map(({ ship }) => (
                  <button
                    key={ship.id}
                    type="button"
                    className="enemy-battle-card"
                    onClick={() => plunder(ship.name)}
                  >
                    <div className="enemy-card-art-box plunder-ship-art">
                      <img src={ship.hull} alt={ship.name} className="enemy-ship-thumb" />
                      <span className="enemy-card-badge text-amber-300">⚡ سرعة {ship.data?.class ?? 1}</span>
                    </div>
                    <div className="enemy-card-info">
                      <strong className="enemy-card-title">{ship.name}</strong>
                      <small className="enemy-card-sub">رتبة {ship.data?.tier ?? 1}</small>
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
          background: linear-gradient(180deg, rgba(30, 20, 12, 0.94) 0%, rgba(14, 10, 7, 0.96) 100%) !important;
          border: 1.5px solid rgba(245, 197, 66, 0.55) !important;
          border-radius: 18px !important;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7), 0 0 24px rgba(245, 197, 66, 0.18) !important;
          backdrop-filter: blur(14px);
        }
        .enemy-head-content {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .enemy-captain-badge {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }
        .enemy-avatar-ring {
          position: relative;
          width: 3.4rem;
          height: 3.4rem;
          border-radius: 9999px;
          padding: 2px;
          background: conic-gradient(from 180deg, #f5c542, #8b6508, #ffd875, #b8860b, #f5c542);
          box-shadow: 0 0 16px rgba(245, 197, 66, 0.45);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .enemy-player-meta {
          display: flex;
          flex-direction: column;
        }
        .enemy-c-name {
          margin: 0;
          font-size: 1.15rem !important;
          color: #fff4d0 !important;
          text-shadow: 0 2px 8px rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .enemy-c-rank {
          font-size: 0.75rem;
          color: #f5c542;
          font-weight: normal;
        }
        .enemy-header-actions {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .enemy-btn-msg {
          background: linear-gradient(180deg, #2a5a8c 0%, #17385c 100%) !important;
          border: 1px solid rgba(135, 206, 250, 0.45) !important;
          color: #e0f2fe !important;
          padding: 0.5rem 0.9rem !important;
          font-size: 0.82rem !important;
          border-radius: 10px !important;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .enemy-btn-msg:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }
        .enemy-btn-exit {
          background: linear-gradient(180deg, #8c2a2a 0%, #571616 100%) !important;
          border: 1px solid rgba(250, 135, 135, 0.45) !important;
          color: #ffe4e4 !important;
          padding: 0.5rem 0.9rem !important;
          font-size: 0.82rem !important;
          border-radius: 10px !important;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          cursor: pointer;
          transition: transform 0.15s ease, filter 0.15s ease;
        }
        .enemy-btn-exit:hover {
          filter: brightness(1.15);
          transform: translateY(-1px);
        }

        /* NOTICE BANNER */
        .enemy-notice-banner {
          position: absolute;
          top: 5.5rem;
          left: 50%;
          transform: translateX(-50%);
          z-index: 15;
          background: rgba(12, 18, 26, 0.9);
          border: 1px solid rgba(245, 197, 66, 0.5);
          color: #fffae8;
          padding: 0.5rem 1.25rem;
          border-radius: 9999px;
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.88rem;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(8px);
          animation: float-down 0.25s ease-out;
        }
        @keyframes float-down {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }

        /* WEAPON PROJECTILE LAYER */
        .enemy-weapons-host {
          position: absolute;
          inset: 0;
          z-index: 18;
          pointer-events: none;
        }

        /* HIT FX POPUP */
        .enemy-hit-fx {
          position: absolute;
          z-index: 25;
          transform: translate(-50%, -100%);
          font-size: 1.35rem;
          font-weight: 900;
          color: #ff3b3b;
          text-shadow: 0 0 10px rgba(255, 0, 0, 0.8), 0 2px 4px #000;
          pointer-events: none;
          animation: hit-rise 1.4s ease-out forwards;
        }
        @keyframes hit-rise {
          0% { opacity: 0; transform: translate(-50%, -60%) scale(0.6); }
          20% { opacity: 1; transform: translate(-50%, -100%) scale(1.2); }
          80% { opacity: 1; transform: translate(-50%, -140%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -170%) scale(0.9); }
        }

        /* SHIPS LAYER - INTERACTIVE OVERLAY */
        .enemy-ships-layer {
          position: absolute;
          inset: 0;
          z-index: 6;
          pointer-events: none;
        }

        /* INTERACTIVE SHIP HITBOX SPOT */
        .enemy-ship-spot {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 7.5rem;
          height: 7.5rem;
          pointer-events: auto;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .enemy-ship-spot.is-sunk {
          pointer-events: none;
        }

        /* FALLBACK HULL (kept subtle; WebGL draws main hull into waves) */
        .ship-fallback-hull {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
          opacity: 0.12; /* subtle depth */
        }
        .enemy-ship-img {
          width: 90%;
          height: 90%;
          object-fit: contain;
        }

        /* GOLDEN TARGET RETICLE */
        .enemy-ship-reticle {
          position: absolute;
          width: 7.8rem;
          height: 7.8rem;
          border: 2px dashed rgba(245, 197, 66, 0.95);
          border-radius: 50%;
          pointer-events: none;
          box-shadow: 0 0 20px rgba(245, 197, 66, 0.45), inset 0 0 16px rgba(245, 197, 66, 0.25);
          animation: spin-reticle 9s linear infinite;
        }
        @keyframes spin-reticle {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        /* SUNK MARKER */
        .enemy-sunk-marker {
          position: absolute;
          padding: 0.2rem 0.6rem;
          border-radius: 9999px;
          background: rgba(180, 20, 20, 0.85);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 800;
          border: 1px solid #f87171;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
        }

        /* SHIP HUD */
        .enemy-ship-hud {
          position: absolute;
          bottom: -2.1rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          pointer-events: none;
        }
        .enemy-ship-name-tag {
          font-size: 0.74rem;
          font-weight: bold;
          color: #fffae8;
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.95);
          white-space: nowrap;
        }
        .enemy-hp-track {
          width: 5rem;
          height: 5px;
          background: rgba(0, 0, 0, 0.75);
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          overflow: hidden;
        }
        .enemy-hp-fill {
          height: 100%;
          background: linear-gradient(90deg, #10b981, #34d399);
          transition: width 0.3s ease;
        }
        .enemy-hp-fill.hp-mid {
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
        }
        .enemy-hp-fill.hp-danger {
          background: linear-gradient(90deg, #ef4444, #f87171);
        }
        .enemy-fish-badge {
          display: flex;
          align-items: center;
          gap: 3px;
          font-size: 0.65rem;
          color: #93c5fd;
          background: rgba(10, 22, 36, 0.88);
          padding: 1px 6px;
          border-radius: 9999px;
          border: 1px solid rgba(147, 197, 253, 0.35);
          white-space: nowrap;
        }

        /* 3 ROYAL FLOATING ACTION BUTTONS DOCK */
        .enemy-action-dock {
          position: absolute;
          bottom: max(1.2rem, env(safe-area-inset-bottom));
          left: 50%;
          transform: translateX(-50%);
          z-index: 20;
          width: min(94%, 32rem);
        }
        .enemy-action-bar {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.75rem;
          padding: 0.75rem 1rem !important;
          background: linear-gradient(180deg, rgba(28, 18, 12, 0.96) 0%, rgba(12, 8, 5, 0.98) 100%) !important;
          border: 1.5px solid rgba(245, 197, 66, 0.6) !important;
          border-radius: 20px !important;
          box-shadow: 0 12px 34px rgba(0, 0, 0, 0.8), 0 0 24px rgba(245, 197, 66, 0.22) !important;
          backdrop-filter: blur(14px);
        }
        .enemy-act-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(245, 197, 66, 0.25);
          border-radius: 14px;
          padding: 0.6rem 0.4rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          color: #fffae8;
          cursor: pointer;
          transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .enemy-act-btn:hover {
          transform: translateY(-4px) scale(1.04);
          border-color: rgba(245, 197, 66, 0.8);
          box-shadow: 0 6px 18px rgba(0, 0, 0, 0.6);
        }
        .enemy-act-icon-wrap {
          width: 3.2rem;
          height: 3.2rem;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0, 0, 0, 0.5);
          transition: transform 0.2s ease;
        }
        .enemy-act-btn:hover .enemy-act-icon-wrap {
          transform: scale(1.1);
        }
        .btn-attack .enemy-act-icon-wrap {
          background: linear-gradient(135deg, #ef4444 0%, #991b1b 100%);
          border: 1.5px solid #fca5a5;
          box-shadow: 0 0 16px rgba(239, 68, 68, 0.45);
        }
        .btn-plunder .enemy-act-icon-wrap {
          background: linear-gradient(135deg, #f59e0b 0%, #b45309 100%);
          border: 1.5px solid #fde68a;
          box-shadow: 0 0 16px rgba(245, 158, 11, 0.45);
        }
        .btn-support .enemy-act-icon-wrap {
          background: linear-gradient(135deg, #10b981 0%, #047857 100%);
          border: 1.5px solid #a7f3d0;
          box-shadow: 0 0 16px rgba(16, 185, 129, 0.45);
        }
        .enemy-act-btn b {
          font-size: 0.82rem;
          font-weight: 800;
          color: #fff4d0;
        }
        .enemy-act-btn small {
          font-size: 0.65rem;
          color: #d1b584;
        }

        /* MODAL WINDOW IN DAILY REWARD DESIGN */
        .enemy-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 240;
          background: rgba(2, 6, 12, 0.75);
          backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1rem;
          animation: fade-backdrop 0.2s ease-out;
        }
        @keyframes fade-backdrop {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .enemy-modal-card {
          width: min(100%, 40rem) !important;
          max-height: 85vh;
          overflow-y: auto;
          background: linear-gradient(180deg, rgba(28, 18, 12, 0.98) 0%, rgba(14, 9, 6, 0.99) 100%) !important;
          border: 1.5px solid rgba(245, 197, 66, 0.7) !important;
          border-radius: 22px !important;
          padding: 1.25rem !important;
          box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85), 0 0 32px rgba(245, 197, 66, 0.25) !important;
        }
        .enemy-modal-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          border-bottom: 1px solid rgba(245, 197, 66, 0.25);
          padding-bottom: 0.75rem;
          margin-bottom: 1rem;
        }

        /* CARDS GRID (WEAPONS / SHIPS / CREW) */
        .enemy-cards-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(9.5rem, 1fr));
          gap: 0.85rem;
        }
        .enemy-battle-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1.5px solid rgba(245, 197, 66, 0.3);
          border-radius: 14px;
          padding: 0.65rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0.4rem;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }
        .enemy-battle-card:hover {
          transform: translateY(-3px);
          border-color: rgba(245, 197, 66, 0.9);
          background: rgba(245, 197, 66, 0.08);
          box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
        }
        .enemy-card-art-box {
          position: relative;
          width: 100%;
          height: 6.8rem;
          border-radius: 10px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(245, 197, 66, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .enemy-card-art {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.3s ease;
        }
        .enemy-battle-card:hover .enemy-card-art {
          transform: scale(1.08);
        }
        .enemy-ship-thumb {
          width: 75%;
          height: 75%;
          object-fit: contain;
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.7));
        }
        .enemy-crew-portrait {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .enemy-card-badge {
          position: absolute;
          bottom: 4px;
          right: 4px;
          background: rgba(0, 0, 0, 0.85);
          border: 1px solid rgba(245, 197, 66, 0.4);
          font-size: 0.65rem;
          font-weight: 800;
          color: #fffae8;
          padding: 1px 6px;
          border-radius: 6px;
        }
        .enemy-card-info {
          display: flex;
          flex-direction: column;
          width: 100%;
        }
        .enemy-card-title {
          font-size: 0.82rem;
          color: #fff4d0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .enemy-card-sub {
          font-size: 0.68rem;
          color: #d1b584;
        }
        .enemy-card-fire-btn {
          width: 100%;
          margin-top: 0.2rem;
          padding: 0.35rem 0.5rem !important;
          font-size: 0.75rem !important;
          background: linear-gradient(180deg, #d97706 0%, #92400e 100%) !important;
          border: 1px solid rgba(245, 197, 66, 0.6) !important;
          border-radius: 8px !important;
          color: #fff !important;
        }
        .enemy-card-fire-btn:hover {
          filter: brightness(1.15);
        }

        @media (max-width: 640px) {
          .enemy-header-panel {
            padding: 0.6rem 0.8rem !important;
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

export default PirateProfile;
