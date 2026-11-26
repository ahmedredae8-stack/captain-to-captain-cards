import { useMemo, useState, useEffect, useRef } from "react";
import { Anchor, Fish, LogOut, MessageCircle, Shield, Swords, Users, X, Sparkles } from "lucide-react";
import SeaScene, { type SeaShip } from "@/components/SeaScene";
import { CaptainAvatar } from "@/components/GameSprite";
import { CosmeticFrame } from "@/components/CosmeticFrame";
import { THEMES, clampTheme } from "@/lib/luxuryCosmetics";
import { fleetCatalog, type FleetShip } from "@/lib/fleetCatalog";
import { getSeaWorld, SEA_WORLDS } from "@/lib/seaWorld";
import { FISH, type FishId } from "@/lib/catches";
import { WeaponsLayer, type WeaponsApi } from "@/components/battle/WeaponsLayer";
import { WEAPONS, type WeaponId } from "@/lib/weapons";
import { playSfx } from "@/lib/sound";
import { useEquippedFrame } from "@/lib/equippedFrame";
import type { Player } from "@/lib/player";

// Card arts
import cannonArt from "@/assets/cannon.jpg";
import mortarArt from "@/assets/mortar.jpg";
import missileArt from "@/assets/missile.jpg";
import torpedoArt from "@/assets/torpedo.jpg";
import fireBarrelArt from "@/assets/fire_barrel.jpg";
import frostShellArt from "@/assets/frost_shell.jpg";
import harpoonArt from "@/assets/harpoon.jpg";

const CARD_ART_MAP: Record<string, string> = {
  cannon: cannonArt,
  mortar: mortarArt,
  missile: missileArt,
  torpedo: torpedoArt,
  fire_barrel: fireBarrelArt,
  frost_shell: frostShellArt,
  harpoon: harpoonArt,
};

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// Custom sound player with reliable fallback
function playCustomAudio(type: "cannon" | "sail" | "creak" | "click" | "shield") {
  const map: Record<string, string> = {
    cannon: "/sfx/cannon.mp3",
    sail: "/sfx/sail.mp3",
    creak: "/sfx/creak.mp3",
    shield: "/sfx/shield.mp3",
    click: "/sfx/click.mp3",
  };
  try {
    const audio = new Audio(map[type]);
    audio.volume = type === "cannon" ? 0.75 : 0.6;
    audio.play().catch(() => {
      if (type === "cannon" || type === "shield") playSfx("click", 0.9);
      else if (type === "sail") playSfx("click", 0.6);
      else if (type === "creak") playSfx("click", 0.4);
      else playSfx("click", 0.5);
    });
  } catch {
    // Ignore audio restrictions
  }
}

export interface PirateProfileProps {
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
  rotationDeg: number;
  hp: number;
  maxHp: number;
  fishCargo: { id: FishId; count: number };
  sunk: boolean;
}

export function PirateProfile({
  player,
  isMe = false,
  live = false,
  onClose,
  onMessage,
  onOpenChat,
  onAttack,
}: PirateProfileProps) {
  const safeName = player?.name || "قرصان مجهول";
  const safeId = String(player?.id || safeName);
  const seed = useMemo(() => hash(safeId), [safeId]);
  const weaponsRef = useRef<WeaponsApi | null>(null);

  const myEquipped = useEquippedFrame();
  const frameIndex = useMemo(() => {
    if (isMe) return myEquipped;
    const raw = typeof player?.avatar_index === "number" ? player.avatar_index : seed % 21;
    return clampTheme(raw);
  }, [isMe, myEquipped, player?.avatar_index, seed]);

  const [stormLevel, setStormLevel] = useState<number>(1.8);
  const [isAttacking, setIsAttacking] = useState<boolean>(false);

  const worldId = (player as any)?.sea_world || (player as any)?.seaWorld || (SEA_WORLDS[seed % SEA_WORLDS.length]?.id ?? "caribbean");
  const world = useMemo(() => getSeaWorld(worldId), [worldId]);

  useEffect(() => {
    playCustomAudio("creak");
  }, []);

  const [lanes, setLanes] = useState<Lane[]>(() => cachedLanes(world.id));

  useEffect(() => {
    let alive = true;
    fetchLanes(world.id).then((l) => {
      if (alive && l && l.length > 0) setLanes(l);
    });
    return () => {
      alive = false;
    };
  }, [world.id]);

  const enemyFleet = useMemo<OceanEnemyShip[]>(() => {
    const pool = fleetCatalog;
    const count = 3 + (seed % 3);
    const fishKeys = Object.keys(FISH) as FishId[];
    const list: OceanEnemyShip[] = [];

    for (let i = 0; i < count; i++) {
      const shipDef = pool[(seed + i * 3) % pool.length];
      const maxHp = (shipDef.id + 1) * 120;
      const cargoFishId = fishKeys[(seed + i * 2) % fishKeys.length];
      const cargoAmount = 10 + ((seed + i * 17) % 45);

      const lane = lanes[i % lanes.length];
      const leftPct = lane?.leftPct ?? (15 + (i * 20));
      const topPct = lane?.topPct ?? (35 + (i * 12));
      const rotationDeg = lane?.rotationDeg ?? ((i % 2 === 0 ? 1 : -1) * 4);

      list.push({
        id: i + 1,
        ship: shipDef,
        topPct,
        leftPct,
        rotationDeg,
        hp: maxHp,
        maxHp,
        fishCargo: { id: cargoFishId, count: cargoAmount },
        sunk: false,
      });
    }
    return list;
  }, [seed, lanes]);

  const [fleet, setFleet] = useState<OceanEnemyShip[]>(enemyFleet);
  const [target, setTarget] = useState<OceanEnemyShip | null>(null);
  const [modal, setModal] = useState<"attack" | "loot" | "assist" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const myShips = useMemo(() => {
    const owned = [0, 1, 2];
    return fleetCatalog.map((ship, idx) => {
      const isOwned = owned.includes(idx);
      return {
        id: idx,
        ship,
        isOwned,
        data: { hull: 100, weapons: ship.data?.weapons ?? ["cannon"] },
      };
    }).filter((s) => s.isOwned);
  }, []);

  const availableWeapons = useMemo(() => {
    const ids = [...new Set(myShips.flatMap((s) => s.data.weapons))];
    const supported: WeaponId[] = ["cannon", "mortar", "missile", "torpedo", "fire_barrel", "frost_shell", "harpoon"];
    const catalog = ids.length > 0 ? ids : ["cannon", "mortar", "missile"];
    return catalog.filter((id): id is WeaponId => supported.includes(id as WeaponId)).map((id) => {
      const w = WEAPONS[id] ?? { name: id, dmg: 25, type: "kinetic" };
      return { id, name: w.name, dmg: w.dmg, type: w.type, art: CARD_ART_MAP[id] ?? cannonArt };
    });
  }, [myShips]);

  const seaShips = useMemo<SeaShip[]>(() => {
    return fleet.map((s) => ({
      id: `enemy-ship-${s.id}`,
      src: s.ship.hull,
      x: s.leftPct / 100,
      y: s.topPct / 100,
      width: 0.28,
      waterline: 0.88,
      visible: !s.sunk,
    }));
  }, [fleet]);

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

    const toX = (target.leftPct / 100) * layerRect.width;
    const toY = (target.topPct / 100) * layerRect.height;

    await weaponsRef.current.fire({
      fromX: layerRect.width / 2,
      fromY: layerRect.height * 0.9,
      toX,
      toY,
      type: weapon.id === "torpedo" ? "torpedo" : weapon.id === "mortar" ? "bomb" : "cannon",
    });

    setIsAttacking(false);
    setTimeout(() => setStormLevel(1.8), 1200);

    const dmg = weapon.dmg + Math.floor(Math.random() * 15);
    setFleet((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const newHp = Math.max(0, s.hp - dmg);
        const sunk = newHp <= 0;
        return { ...s, hp: newHp, sunk };
      })
    );

    setNotice(`💥 أصابت القذيفة سفينة «${target.ship.name}» بضرر ${dmg}!`);
    setTimeout(() => setNotice(null), 3500);
  };

  const loot = () => {
    if (!target) return;
    setModal(null);
    playCustomAudio("sail");
    setNotice(`🏴‍☠️ تم نهب حمولة ${target.fishCargo.count}x من ${target.fishCargo.id} بنجاح!`);
    setTimeout(() => setNotice(null), 3500);
  };

  const assist = () => {
    if (!target) return;
    setModal(null);
    playCustomAudio("shield");
    setFleet((prev) =>
      prev.map((s) => (s.id === target.id ? { ...s, hp: Math.min(s.maxHp, s.hp + 50) } : s))
    );
    setNotice(`🛡️ تم إرسال نجارين ودعم سفينة «${target.ship.name}» بـ 50 نقطة صحة!`);
    setTimeout(() => setNotice(null), 3500);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 text-white select-none overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <SeaScene
          surface="deep"
          swell={stormLevel}
          turbulent={isAttacking}
          ships={seaShips}
          waterlineOffset={0}
          enableSinking
        />
      </div>

      <div className="absolute inset-0 pointer-events-none enemy-weapons-host z-20">
        <WeaponsLayer ref={weaponsRef} />
      </div>

      {/* TOP HEADER */}
      <header className="enemy-top-wrapper">
        <div className="enemy-header-panel">
          <div className="enemy-head-content">
            <div className="enemy-captain-badge">
              <div className="enemy-avatar-wrap">
                <CosmeticFrame themeIndex={frameIndex} size={72}>
                  <div className="w-full h-full bg-[#141b2d] flex items-center justify-center overflow-hidden rounded-full">
                    <CaptainAvatar
                      seed={typeof player?.avatar_index === "number" ? player.avatar_index : seed}
                      url={player?.avatar_url}
                      size={64}
                      frameIndex={frameIndex}
                      isSelf={isMe}
                    />
                  </div>
                </CosmeticFrame>
              </div>

              <div className="enemy-info-col">
                <div className="enemy-name-row">
                  <h2 className="enemy-captain-name">{safeName}</h2>
                  {live && <span className="enemy-live-pill">متصل الآن</span>}
                </div>
                <div className="enemy-sub-row">
                  <span className="enemy-world-tag">🌊 {world.name}</span>
                  <span className="enemy-fleet-count">
                    ⚓ {fleet.filter((s) => !s.sunk).length} سفن جاهزة
                  </span>
                </div>
              </div>
            </div>

            {/* Actions: Message, Fight, Exit */}
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
                >
                  <MessageCircle size={17} />
                  <span>محادثة</span>
                </button>
              )}

              {onAttack && (
                <button
                  type="button"
                  className="tos-btn enemy-btn-attack"
                  onClick={() => {
                    playCustomAudio("click");
                    onAttack();
                  }}
                >
                  <Swords size={17} />
                  <span>قتال الأسطول</span>
                </button>
              )}

              <button
                type="button"
                className="tos-btn enemy-btn-exit"
                onClick={() => {
                  playCustomAudio("click");
                  onClose();
                }}
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {notice && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl bg-slate-900/90 border border-amber-400/60 text-amber-200 text-sm font-bold shadow-2xl backdrop-blur-md animate-bounce">
          {notice}
        </div>
      )}

      {/* SHIPS IN THE WATER */}
      <div className="relative flex-1 pointer-events-auto">
        {fleet.map((s) => {
          if (s.sunk) return null;
          const isSelected = target?.id === s.id;
          const hpPct = Math.round((s.hp / s.maxHp) * 100);

          return (
            <div
              key={s.id}
              className={`absolute transition-transform duration-300 cursor-pointer ${
                isSelected ? "scale-110 z-30 drop-shadow-[0_0_20px_rgba(255,215,0,0.6)]" : "hover:scale-105 z-10"
              }`}
              style={{
                top: `${s.topPct}%`,
                left: `${s.leftPct}%`,
                transform: `translate(-50%, -50%) rotate(${s.rotationDeg}deg)`,
              }}
              onClick={() => {
                playCustomAudio("click");
                setTarget(s);
              }}
            >
              {/* شريط صحة السفينة يرتفع فوق السفينة مباشرة */}
              <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center gap-0.5 bg-slate-950/80 px-2 py-0.5 rounded-full border border-amber-400/40 backdrop-blur-sm pointer-events-none whitespace-nowrap shadow-md">
                <span className="text-[10px] font-bold text-amber-300">{s.ship.name}</span>
                <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                  <div
                    className={`h-full transition-all duration-300 ${
                      hpPct > 50 ? "bg-emerald-500" : hpPct > 25 ? "bg-amber-500" : "bg-rose-600"
                    }`}
                    style={{ width: `${hpPct}%` }}
                  />
                </div>
              </div>

              <img
                src={s.ship.hull}
                alt={s.ship.name}
                className="w-28 sm:w-36 h-auto pointer-events-none drop-shadow-xl"
              />
            </div>
          );
        })}
      </div>

      {/* نافذة التحكم الفاخرة عند الضغط على السفينة */}
      {target && !target.sunk && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-md p-4 rounded-2xl bg-gradient-to-b from-[#16213e]/95 to-[#0f172a]/95 border-2 border-amber-400/60 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.25)] backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-amber-400/20 pb-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">⚓</span>
              <div>
                <h4 className="font-black text-amber-300 text-sm">{target.ship.name}</h4>
                <p className="text-[11px] text-slate-300">
                  الصحة: {target.hp} / {target.maxHp}
                </p>
              </div>
            </div>
            <button
              onClick={() => setTarget(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800/60"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setModal("attack")}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-gradient-to-b from-rose-900/60 to-rose-950/80 border border-rose-500/50 hover:border-rose-400 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-rose-200 shadow-lg"
            >
              <Swords size={18} className="text-rose-400" />
              <span>هجوم مدفعي</span>
            </button>

            <button
              type="button"
              onClick={() => setModal("loot")}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-gradient-to-b from-amber-900/60 to-amber-950/80 border border-amber-500/50 hover:border-amber-400 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-amber-200 shadow-lg"
            >
              <Fish size={18} className="text-amber-400" />
              <span>نهب الصيد</span>
            </button>

            <button
              type="button"
              onClick={() => setModal("assist")}
              className="flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl bg-gradient-to-b from-emerald-900/60 to-emerald-950/80 border border-emerald-500/50 hover:border-emerald-400 hover:scale-105 active:scale-95 transition-all text-xs font-bold text-emerald-200 shadow-lg"
            >
              <Shield size={18} className="text-emerald-400" />
              <span>دعم وإصلاح</span>
            </button>
          </div>
        </div>
      )}

      {/* نوافذ الهجوم والنهب والدعم المنبثقة */}
      {modal === "attack" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl bg-gradient-to-b from-[#1a233a] to-[#0c1222] border-2 border-rose-500/60 p-5 shadow-2xl">
            <h3 className="text-sm font-black text-rose-300 mb-3 text-center">اختر سلاح الهجوم</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {availableWeapons.map((w) => (
                <button
                  key={w.id}
                  onClick={() => attack(w.id)}
                  className="flex items-center gap-2 p-2 rounded-xl bg-slate-900/80 border border-rose-500/30 hover:border-rose-400 hover:scale-105 transition-all text-right"
                >
                  <img src={w.art} alt={w.name} className="w-10 h-10 rounded-lg object-cover" />
                  <div>
                    <div className="text-xs font-bold text-white">{w.name}</div>
                    <div className="text-[10px] text-rose-300">ضرر {w.dmg}</div>
                  </div>
                </button>
              ))}
            </div>
            <button
              onClick={() => setModal(null)}
              className="w-full py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {modal === "loot" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-[#1a233a] to-[#0c1222] border-2 border-amber-500/60 p-5 shadow-2xl text-center">
            <h3 className="text-sm font-black text-amber-300 mb-2">نهب حمولة السفينة</h3>
            <p className="text-xs text-slate-300 mb-4">
              تحمل السفينة {target?.fishCargo.count} سمكة {target?.fishCargo.id}. هل تريد الاستيلاء عليها؟
            </p>
            <div className="flex gap-2">
              <button
                onClick={loot}
                className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg"
              >
                تأكيد النهب
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === "assist" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xs rounded-2xl bg-gradient-to-b from-[#1a233a] to-[#0c1222] border-2 border-emerald-500/60 p-5 shadow-2xl text-center">
            <h3 className="text-sm font-black text-emerald-300 mb-2">دعم وإصلاح السفينة</h3>
            <p className="text-xs text-slate-300 mb-4">
              إرسال خشب ونجارين لترميم درع السفينة وزيادة صحتها بـ 50 نقطة.
            </p>
            <div className="flex gap-2">
              <button
                onClick={assist}
                className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black shadow-lg"
              >
                إرسال الدعم
              </button>
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-bold text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Memory cache for sea berths
const LANES_CACHE = new Map<string, Lane[]>();
interface Lane {
  id: string;
  leftPct: number;
  topPct: number;
  rotationDeg: number;
}
function cachedLanes(worldId: string): Lane[] {
  return LANES_CACHE.get(worldId) ?? [
    { id: "1", leftPct: 22, topPct: 45, rotationDeg: 2 },
    { id: "2", leftPct: 48, topPct: 60, rotationDeg: -3 },
    { id: "3", leftPct: 75, topPct: 42, rotationDeg: 4 },
  ];
}
async function fetchLanes(worldId: string): Promise<Lane[] | null> {
  return null;
}
