import { useMemo, useState } from "react";
import { Anchor, Fish, LogOut, MessageCircle, Shield, Swords, Users, X } from "lucide-react";
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

const hash = (value: string) => {
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
};

type TargetShip = { id: number; ship: FleetShip; hp: number; maxHp: number; fishId: FishId; fishQty: number; sunk: boolean; x: number; y: number };
type Modal = "attack" | "plunder" | "support" | null;

export function PirateProfile({ player, isMe, live, onClose, onMessage }: {
  player: Player; live?: boolean; isMe: boolean; onClose: () => void; onMessage: () => void; onAttack?: () => void;
}) {
  const seed = useMemo(() => hash(player.id), [player.id]);
  const world = useMemo(() => player.theme_id ? getSeaWorld(player.theme_id) : SEA_WORLDS[seed % SEA_WORLDS.length]!, [player.theme_id, seed]);
  const myShips = useLiveShips(false);
  const [fleet, setFleet] = useState<TargetShip[]>(() => {
    const points = [{ x: 23, y: 56 }, { x: 51, y: 69 }, { x: 79, y: 54 }];
    return points.map((p, i) => {
      const ship = fleetCatalog[(seed + i * 3) % Math.min(fleetCatalog.length, 8)] ?? fleetCatalog[0]!;
      const fishId = (["sardine", "mackerel", "tuna"] as FishId[])[(seed + i) % 3]!;
      return { id: i, ship, hp: 150, maxHp: 150, fishId, fishQty: 24 + ((seed * (i + 1)) % 42), sunk: false, ...p };
    });
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [notice, setNotice] = useState("");
  const [travelling, setTravelling] = useState<{ targetId: number; ship: string } | null>(null);
  const [projectile, setProjectile] = useState<{ targetId: number; icon: string } | null>(null);
  const target = fleet.find((s) => s.id === selectedId) ?? null;

  // Select only weapons fitted to the player's ships; remove duplicates.
  const availableWeapons = useMemo(() => {
    const ids = [...new Set(myShips.flatMap((s) => s.data.weapons))];
    return ids.map((id) => ({ id, ...(WEAPONS[id] ?? { name: id, dmg: 20, type: "kinetic" }) }));
  }, [myShips]);

  const attack = (weaponId: string) => {
    if (!target) return;
    const weapon = WEAPONS[weaponId];
    const dmg = weapon?.dmg ?? 20;
    const id = target.id;
    setModal(null);
    playSfx("click", 0.9);
    setProjectile({ targetId: id, icon: weapon?.type === "fire" ? "🔥" : weapon?.type === "ice" ? "❄️" : weapon?.type === "pierce" ? "⚡" : "💣" });
    setNotice(`💥 أصابت ${weapon?.name ?? weaponId} سفينة «${target.ship.name}»!`);
    window.setTimeout(() => {
      setProjectile(null);
      setFleet((items) => items.map((s) => {
        if (s.id !== id) return s;
        const hp = Math.max(0, s.hp - dmg);
        return { ...s, hp, sunk: hp === 0 };
      }));
    }, 750);
  };

  const plunder = async (ship: ReturnType<typeof useLiveShips>[number]) => {
    if (!target) return;
    const id = target.id;
    setModal(null);
    setTravelling({ targetId: id, ship: ship.name });
    setNotice(`⛵ سفينتك «${ship.name}» تبحر نحو «${target.ship.name}»...`);
    playSfx("waves", 0.7);
    window.setTimeout(async () => {
      const current = fleet.find((s) => s.id === id);
      if (!current || current.sunk || current.fishQty <= 0) {
        setNotice("لم تعد هناك حمولة سمك قابلة للنهب.");
        setTravelling(null);
        return;
      }
      const qty = Math.min(current.fishQty, Math.max(1, Math.floor(current.fishQty * 0.4)));
      await saveHaul([{ id: current.fishId, qty }]);
      setFleet((items) => items.map((s) => s.id === id ? { ...s, fishQty: Math.max(0, s.fishQty - qty) } : s));
      setNotice(`🏴‍☠️ وصلت «${ship.name}» بجوار السفينة ونهبت ${qty} من ${FISH.find((f) => f.id === current.fishId)?.name ?? "السمك"}.`);
      window.setTimeout(() => setTravelling(null), 1200);
    }, 1900);
  };

  const support = (crewName: string) => {
    if (!target) return;
    const id = target.id;
    setModal(null);
    setFleet((items) => items.map((s) => s.id === id ? { ...s, hp: Math.min(s.maxHp, s.hp + 35), sunk: false } : s));
    setNotice(`🛡️ وصل طاقم «${crewName}» لدعم سفينة «${target.ship.name}».`);
    playSfx("click", 0.8);
  };

  return (
    <div className="enemy-ocean" role="dialog" aria-modal="true" aria-label={`محيط ${player.name}`} dir="rtl">
      <SeaScene theme={world} params={{ amp: 1.25, spd: 1.1, foam: 0.85 }} className="enemy-ocean-canvas" />
      <div className="enemy-ocean-shade" />
      <header className="enemy-ocean-hud">
        <div className="enemy-captain">
          <CaptainAvatar seed={player.avatar_index ?? 0} url={player.avatar_url} className="enemy-avatar" />
          <div><small>محيط القبطان</small><strong>{player.name}</strong><span>{live ? "🟢 متصل الآن" : "⚪ غير متصل"} · {world.name}</span></div>
        </div>
        <div className="enemy-hud-actions">
          {!isMe && <button className="enemy-hud-button" onClick={onMessage}><MessageCircle size={16} /> مراسلة</button>}
          <button className="enemy-exit" onClick={onClose}><LogOut size={16} /> خروج</button>
        </div>
      </header>

      <div className="enemy-ocean-info"><span>🌊 محيط متحرك · اضغط سفينة لعرض أوامرك</span><span>⚓ {fleet.filter((s) => !s.sunk).length} سفن قائمة</span></div>
      {notice && <div className="enemy-toast" role="status">{notice}</div>}

      <main className="enemy-sea-area" onClick={() => setSelectedId(null)}>
        {projectile && <div className="enemy-projectile" style={{ left: `${fleet[projectile.targetId]?.x ?? 50}%`, top: `${(fleet[projectile.targetId]?.y ?? 50) - 20}%` }}>{projectile.icon}</div>}
        {fleet.map((s) => {
          const fish = FISH.find((f) => f.id === s.fishId);
          const chosen = selectedId === s.id;
          return <div key={s.id} className={`enemy-ship-anchor ${chosen ? "chosen" : ""} ${s.sunk ? "sunk" : ""}`} style={{ left: `${s.x}%`, top: `${s.y}%` }} onClick={(e) => { e.stopPropagation(); setSelectedId(s.id); setNotice(""); playSfx("click", 0.5); }}>
            {chosen && <div className="enemy-ship-actions" onClick={(e) => e.stopPropagation()}>
              <button disabled={s.sunk} onClick={() => setModal("attack")}><i className="attack-icon"><Swords /></i><b>هجوم</b></button>
              <button disabled={s.sunk || s.fishQty <= 0} onClick={() => setModal("plunder")}><i className="plunder-icon"><Fish /></i><b>نهب</b></button>
              <button onClick={() => setModal("support")}><i className="support-icon"><Shield /></i><b>دعم</b></button>
            </div>}
            {travelling?.targetId === s.id && <div className="enemy-raider" aria-label="سفينة تبحر للنهب">⛵<small>{travelling.ship}</small></div>}
            <button className="enemy-ship-button" aria-label={`اختيار ${s.ship.name}`}>
              <img src={s.ship.hull} alt="" />
              <span className="enemy-hp"><i style={{ width: `${(s.hp / s.maxHp) * 100}%` }} /></span>
              <strong>{s.ship.name}</strong>
              <small><Fish size={12} /> {s.fishQty} {fish?.name ?? "سمكة"}</small>
              {s.sunk && <em>غرقت</em>}
            </button>
          </div>;
        })}
      </main>

      {target && <div className="enemy-target-card"><Anchor size={15} /><span>السفينة المحددة: <b>{target.ship.name}</b></span><span>الحمولة: {target.fishQty} سمكة</span><button onClick={() => setSelectedId(null)} aria-label="إلغاء تحديد السفينة"><X size={15} /></button></div>}

      {modal && target && <div className="enemy-modal-backdrop" role="dialog" aria-modal="true" onClick={() => setModal(null)}>
        <section className="daily-panel enemy-action-modal" dir="rtl" onClick={(e) => e.stopPropagation()}>
          <button className="tos-x" aria-label="إغلاق" onClick={() => setModal(null)}><X size={17} /></button>
          <header className="daily-head">
            <span className="daily-kicker">{modal === "attack" ? "ترسانة الأسطول" : modal === "plunder" ? "اختيار سفينة الغارة" : "غرفة القباطنة والطواقم"}</span>
            <h2 className="daily-title">{modal === "attack" ? `اختر سلاحاً لضرب ${target.ship.name}` : modal === "plunder" ? `اختر سفينة لنهب ${target.ship.name}` : `أرسل دعماً إلى ${target.ship.name}`}</h2>
            <div className="daily-streak"><b>{modal === "attack" ? target.hp : modal === "plunder" ? target.fishQty : "+35"}</b><span>{modal === "attack" ? `من ${target.maxHp} درع` : modal === "plunder" ? "سمكة متاحة" : "نقطة ترميم"}</span></div>
          </header>
          <div className="enemy-choice-grid">
            {modal === "attack" && (availableWeapons.length ? availableWeapons.map((w) => <button className="enemy-choice" key={w.id} onClick={() => attack(w.id)}><span>💣</span><b>{w.name}</b><small>قوة الضرر: {w.dmg}</small><em>إطلاق على السفينة المحددة</em></button>) : <p className="enemy-empty">لا توجد أسلحة مجهزة على سفنك حالياً.</p>)}
            {modal === "plunder" && myShips.map((s) => <button className="enemy-choice" key={s.key} onClick={() => void plunder(s)}><img src={s.hull} alt="" /><b>{s.name}</b><small>سفينة الغارة</small><em>إرسال بجوار السفينة المحددة</em></button>)}
            {modal === "support" && CREWS.map((crew) => <button className="enemy-choice" key={crew.id} onClick={() => support(crew.name)}><span><Users /></span><b>{crew.name}</b><small>{crew.desc}</small><em>إرسال طاقم الدعم</em></button>)}
          </div>
        </section>
      </div>}

      <style>{`
        .enemy-ocean{position:fixed;inset:0;z-index:220;overflow:hidden;background:#071523;color:#fff;display:flex;flex-direction:column;isolation:isolate}
        .enemy-ocean-canvas{position:absolute!important;inset:0;width:100%!important;height:100%!important;z-index:0}
        .enemy-ocean-shade{position:absolute;inset:0;z-index:1;pointer-events:none;background:linear-gradient(180deg,rgba(3,12,22,.88),transparent 25%,rgba(3,12,22,.12) 65%,rgba(3,12,22,.72)),radial-gradient(ellipse at center,transparent 30%,rgba(0,0,0,.42) 100%)}
        .enemy-ocean-hud{display:flex;align-items:center;justify-content:space-between;padding:max(.65rem,env(safe-area-inset-top)) 1rem .7rem;background:linear-gradient(180deg,rgba(4,17,28,.9),rgba(4,17,28,.55));border-bottom:1px solid #d8ab4d66;z-index:5;gap:.6rem}
        .enemy-captain{display:flex;align-items:center;gap:.65rem;min-width:0}.enemy-avatar{width:3.2rem;height:3.2rem;border:2px solid #eabf5b;border-radius:50%;overflow:hidden;flex:none}.enemy-captain>div{display:grid;gap:.1rem}.enemy-captain small{color:#e9bd58;font-size:.68rem}.enemy-captain strong{font-size:1.05rem}.enemy-captain span{font-size:.68rem;color:#cbd5e1}
        .enemy-hud-actions{display:flex;gap:.45rem}.enemy-hud-button,.enemy-exit{display:flex;align-items:center;gap:.35rem;padding:.5rem .7rem;border:1px solid #d8ab4d80;border-radius:.7rem;background:#0b1d2add;color:#f7d684;font-weight:800;cursor:pointer}.enemy-exit{background:#8f1f27dd;color:white;border-color:#fca5a5}
        .enemy-ocean-info{z-index:3;display:flex;justify-content:space-between;gap:.5rem;padding:.4rem .85rem;color:#e2e8f0;font-size:.75rem;text-shadow:0 2px 5px #000}
        .enemy-toast{position:absolute;z-index:15;top:6.2rem;left:50%;transform:translateX(-50%);width:min(92vw,34rem);padding:.65rem .9rem;border:1px solid #eabf5b;border-radius:.85rem;background:#071523ed;color:#ffe7a0;text-align:center;font-weight:800;box-shadow:0 8px 30px #0008}
        .enemy-sea-area{position:relative;flex:1;min-height:0;overflow:hidden;z-index:2}.enemy-projectile{position:absolute;z-index:18;transform:translate(-50%,-50%);font-size:2.5rem;filter:drop-shadow(0 0 12px #ef4444);animation:enemy-fall .75s ease-in forwards;pointer-events:none}
        .enemy-ship-anchor{position:absolute;transform:translate(-50%,-50%);display:grid;justify-items:center;animation:enemy-bob 3.3s ease-in-out infinite;cursor:pointer}.enemy-ship-anchor:nth-child(2){animation-delay:-1.2s}.enemy-ship-anchor:nth-child(3){animation-delay:-2.1s}
        .enemy-ship-button{position:relative;display:grid;justify-items:center;gap:.14rem;padding:.3rem .4rem .38rem;border:1px solid #f1cf7b66;border-radius:.9rem;background:#071523a8;color:white;backdrop-filter:blur(4px);cursor:pointer;min-width:7rem}.enemy-ship-button img{width:clamp(6rem,16vw,10rem);height:clamp(4rem,10vw,6rem);object-fit:contain;filter:drop-shadow(0 6px 5px #000a)}.enemy-ship-button strong{font-size:.73rem;color:#ffdf88;text-shadow:0 1px 4px #000}.enemy-ship-button small{display:flex;align-items:center;gap:.2rem;color:#9de7ff;font-size:.66rem}.enemy-ship-button em{position:absolute;inset:32% 0 auto;color:#fecaca;font-weight:900;background:#991b1bcc}.enemy-hp{width:85%;height:5px;border-radius:99px;background:#111;overflow:hidden}.enemy-hp i{display:block;height:100%;background:linear-gradient(90deg,#ef4444,#4ade80);transition:width .35s}
        .enemy-ship-anchor.chosen .enemy-ship-button{border:2px solid #f5ca66;box-shadow:0 0 24px #f5ca6680}.enemy-ship-anchor.sunk{filter:grayscale(1);opacity:.65}
        .enemy-ship-actions{position:absolute;bottom:100%;left:50%;transform:translateX(-50%);display:flex;gap:.55rem;z-index:10;white-space:nowrap}.enemy-ship-actions button{display:grid;justify-items:center;gap:.15rem;background:none;border:0;color:#ffe7a0;font-weight:900;cursor:pointer}.enemy-ship-actions i{width:clamp(2.6rem,10vw,3.3rem);aspect-ratio:1;border:2px solid #e9bd58;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 30% 25%,#304b65,#0a1420);box-shadow:0 0 15px #eabf5b66}.enemy-ship-actions svg{width:1.25rem}.enemy-ship-actions .attack-icon{color:#fecaca;border-color:#ef7777}.enemy-ship-actions .plunder-icon{color:#a5f3fc;border-color:#6dd3e8}.enemy-ship-actions .support-icon{color:#bbf7d0;border-color:#70d899}.enemy-ship-actions b{font-size:.68rem;background:#071523dc;padding:.08rem .45rem;border-radius:99px}
        .enemy-raider{position:absolute;z-index:12;left:-25%;top:10%;font-size:2rem;animation:enemy-raid 1.8s ease forwards;display:grid;justify-items:center}.enemy-raider small{font-size:.6rem;color:#ffe7a0;background:#071523dd;border-radius:99px;padding:.1rem .3rem;white-space:nowrap}
        .enemy-target-card{position:absolute;z-index:6;bottom:max(.65rem,env(safe-area-inset-bottom));left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:.6rem;padding:.55rem .75rem;border:1px solid #e9bd58;border-radius:99px;background:#071523e8;color:#e7eef6;font-size:.73rem;white-space:nowrap;box-shadow:0 5px 20px #0008}.enemy-target-card svg{color:#f1cd78}.enemy-target-card button{display:grid;place-items:center;background:none;border:0;color:#fff;cursor:pointer}
        .enemy-modal-backdrop{position:fixed;inset:0;z-index:30;display:grid;place-items:center;padding:1rem;background:#020812c9;backdrop-filter:blur(7px)}.enemy-action-modal{position:relative;width:min(100%,38rem);max-height:min(88svh,48rem);overflow:auto;padding:1rem!important}.enemy-choice-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(9rem,1fr));gap:.55rem;margin-top:.8rem}.enemy-choice{display:grid;justify-items:center;align-content:start;gap:.28rem;min-height:9rem;padding:.65rem .45rem;border:1px solid #d3ac57;border-radius:.9rem;background:linear-gradient(160deg,#26394a,#101d29);color:#fff;text-align:center;cursor:pointer;box-shadow:inset 0 0 0 1px #ffffff12}.enemy-choice:hover{border-color:#ffe08b;transform:translateY(-2px)}.enemy-choice>span{font-size:1.8rem;color:#f5d276}.enemy-choice>span svg{width:1.7rem;height:1.7rem}.enemy-choice img{width:5rem;height:3.5rem;object-fit:contain}.enemy-choice b{color:#ffe08b;font-size:.85rem}.enemy-choice small{color:#dbe4ed;font-size:.69rem}.enemy-choice em{font-style:normal;color:#83dffc;font-size:.66rem}.enemy-empty{grid-column:1/-1;text-align:center;color:#f6d578}
        @keyframes enemy-bob{0%,100%{translate:0 0}50%{translate:0 -8px}}@keyframes enemy-fall{0%{translate:0 -140px;scale:.65;opacity:.2}55%{opacity:1}100%{translate:0 0;scale:1.15;opacity:1}}@keyframes enemy-raid{0%{opacity:0;transform:translateX(-30%)}20%{opacity:1}100%{transform:translateX(180%);opacity:1}}
        @media(max-width:600px){.enemy-ocean-hud{padding-inline:.55rem}.enemy-avatar{width:2.6rem;height:2.6rem}.enemy-hud-button,.enemy-exit{padding:.42rem .5rem;font-size:.68rem}.enemy-captain strong{font-size:.88rem}.enemy-ship-button{min-width:5.2rem;padding:.2rem}.enemy-ship-button img{width:clamp(4.8rem,23vw,6.6rem);height:3.7rem}.enemy-ship-actions{gap:.2rem}.enemy-ship-actions i{width:2.5rem}.enemy-target-card{max-width:94vw;overflow:hidden;white-space:nowrap;font-size:.62rem;gap:.35rem}}
      `}</style>
    </div>
  );
}
