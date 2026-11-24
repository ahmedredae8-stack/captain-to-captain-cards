import { useEffect, useMemo, useRef, useState } from "react";
import crest from "@/assets/royale/kos-crest.png";
import { playSfx } from "@/lib/sound";
import { CaptainAvatar, nameSeed } from "@/components/GameSprite";
import type { Player } from "@/lib/player";
import { prepareGame, openGame, BOT_NAMES, type Seat } from "@/components/royale/KingOfSeas";
import type { RoyaleSeat } from "@/components/royale/royaleInject";

// @ts-ignore
import Photon from "photon-realtime";

export const PHOTON_APP_ID =
  (import.meta.env.VITE_PHOTON_APP_ID as string) || "3fa819a4-e442-4730-81e2-3c7420a8e033";
const PHOTON_APP_VERSION = "1.0";
const KOS_ROOM_NAME = "king-of-seas-arena";
const LOBBY_SECONDS = 10;
const SLOTS = 10;

const KOS_EVENT_STATE = 10;
const KOS_EVENT_HIT = 11;
const KOS_EVENT_START = 12;
const KOS_EVENT_ISLAND = 13;

type CaptainState = { id: string; name: string; avatar_index: number; avatar_url: string | null };
type SeaState = { pos: { x: number; y: number; z: number }; hp: number; alive: boolean; yaw?: number };
type SeaHit = { id: string; shooterId: string; targetId: string; damage: number };

export function KingOfSeas({ player, playerName, onClose }: { player?: Player | null; playerName: string; onClose: () => void }) {
  const [phase, setPhase] = useState<"lobby" | "loading" | "game" | "error">("lobby");
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [humans, setHumans] = useState<Seat[]>([]);
  const [bots, setBots] = useState<Seat[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [joinedAt] = useState(() => Date.now());

  const frame = useRef<HTMLIFrameElement>(null);
  const clientRef = useRef<any>(null);
  const blobRef = useRef<string | null>(null);
  const launchedRef = useRef(false);

  const myId = useRef(player?.id ?? `guest-${Math.random().toString(36).slice(2, 9)}`).current;
  const myName = playerName || player?.name || "القبطان";
  const myAvatarIndex = player?.avatar_index ?? nameSeed(myName);
  const myAvatarUrl = player?.avatar_url ?? null;

  const me: Seat = useMemo(() => ({
    id: myId,
    name: myName,
    isBot: false,
    me: true,
    avatar_index: myAvatarIndex,
    avatar_url: myAvatarUrl,
    joined: joinedAt,
  }), [myId, myName, myAvatarIndex, myAvatarUrl, joinedAt]);

  // تحميل HTML اللعبة ومجسم التنين قبل بدء القتال
  useEffect(() => {
    prepareGame().then(() => setReady(true)).catch((err) => {
      console.warn("Preload notice:", err);
      setReady(false);
    });
  }, []);

  // استقبال طلبات الإغلاق من إطار اللعبة
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if ((e.data as { type?: string })?.type === "kos-exit") exit();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // الحصول على قائمة اللاعبين المتصلين بغرفة فوتون
  const syncPhotonActors = (client: any) => {
    try {
      if (!client || !client.isJoinedToRoom?.()) return;
      const actors = client.myRoomActorsArray?.() || [];
      const others: Seat[] = [];
      for (const actor of actors) {
        if (actor.isLocal) continue;
        const custom = actor.getCustomProperty?.("captain") as CaptainState | undefined;
        const aName = custom?.name || actor.name || `قبطان ${actor.actorNr}`;
        const aId = custom?.id || `actor-${actor.actorNr}`;
        others.push({
          id: aId,
          name: aName,
          isBot: false,
          avatar_index: custom?.avatar_index ?? actor.actorNr,
          avatar_url: custom?.avatar_url ?? null,
          joined: joinedAt - 1000,
        });
      }
      setHumans(others);
    } catch {
      // تجاهل تغيّر قائمة اللاعبين أثناء الاتصال
    }
  };

  // الاتصال بغرفة فوتون للّوبي واللعب الجماعي
  useEffect(() => {
    let cancelled = false;

    try {
      const P = (Photon?.default || Photon) as any;
      if (!P) return;

      if (typeof window !== "undefined" && window.WebSocket && P.PhotonPeer) {
        P.PhotonPeer.setWebSocketImpl(window.WebSocket);
      }

      const LBC = P.LoadBalancing?.LoadBalancingClient;
      if (!LBC) return;

      const client = new LBC(P.ConnectionProtocol.Wss, PHOTON_APP_ID, PHOTON_APP_VERSION);
      clientRef.current = client;

      client.setUserId(myId);

      client.onStateChange = (state: number) => {
        if (cancelled) return;
        if (state === LBC.State.ConnectedToMaster) {
          client.joinRoom(KOS_ROOM_NAME, { createIfNotExists: true }, { maxPlayers: SLOTS });
        } else if (state === LBC.State.Joined) {
          const actor = client.myActor();
          if (actor) {
            actor.setName(myName);
            actor.setCustomProperties({
              captain: {
                id: myId,
                name: myName,
                avatar_index: myAvatarIndex,
                avatar_url: myAvatarUrl,
              },
            });
          }
          syncPhotonActors(client);
        }
      };

      client.onActorJoin = () => {
        if (cancelled) return;
        syncPhotonActors(client);
        playSfx("click", 0.4);
      };

      client.onActorLeave = () => {
        if (cancelled) return;
        syncPhotonActors(client);
      };

      client.onActorPropertiesChange = () => {
        if (cancelled) return;
        syncPhotonActors(client);
      };

      client.onEvent = (code: number, content: any) => {
        if (cancelled || !content) return;

        if (code === KOS_EVENT_START) {
          const remoteSeats = content.seats as RoyaleSeat[] | undefined;
          if (remoteSeats && Array.isArray(remoteSeats)) {
            const adapted = remoteSeats.map((s) => ({ ...s, me: s.id === myId }));
            void launchWithSeats(adapted);
          }
        } else if (code === KOS_EVENT_ISLAND) {
          frame.current?.contentWindow?.postMessage({ type: "kos-go-island" }, "*");
        } else if (code === KOS_EVENT_STATE) {
          frame.current?.contentWindow?.postMessage({
            type: "kos-remote",
            id: content.id,
            name: content.name,
            state: content.state,
          }, "*");
        } else if (code === KOS_EVENT_HIT) {
          frame.current?.contentWindow?.postMessage({ type: "kos-hit", hit: content }, "*");
        }
      };

      client.connectToRegionMaster("EU");
    } catch (err) {
      console.warn("Photon lobby error:", err);
    }

    return () => {
      cancelled = true;
      if (clientRef.current) {
        try {
          if (clientRef.current.isJoinedToRoom?.()) clientRef.current.leaveRoom();
          clientRef.current.disconnect();
        } catch {
          // تجاهل أخطاء إغلاق الاتصال
        }
        clientRef.current = null;
      }
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [myId, myName, myAvatarIndex, myAvatarUrl]);

  // تحديث عداد الردهة
  useEffect(() => {
    if (phase !== "lobby") return;
    const t = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(t);
  }, [phase]);

  const roomStart = Math.min(joinedAt, ...humans.map((h) => h.joined));
  const left = Math.max(0, Math.ceil((roomStart + LOBBY_SECONDS * 1000 - now) / 1000));
  const realSeats = [me, ...humans].slice(0, SLOTS);

  // ملء المقاعد الفارغة بقباطنة آليين قبل انتهاء العداد
  useEffect(() => {
    if (phase !== "lobby") return;
    const free = SLOTS - realSeats.length;
    const want = left <= 2
      ? free
      : Math.min(free - 1, Math.floor(((LOBBY_SECONDS - left) / LOBBY_SECONDS) * free * 0.9));

    if (want > bots.length) {
      setBots((cur) => {
        const used = new Set([...realSeats, ...cur].map((s) => s.name));
        const pool = BOT_NAMES.filter((n) => !used.has(n));
        const add: Seat[] = [];
        for (let i = cur.length; i < want; i++) {
          add.push({
            id: `bot-${i}`,
            name: pool[i - cur.length] ?? `قبطان ${i + 1}`,
            isBot: true,
            avatar_index: (i * 3 + 1) % 10,
            joined: Date.now(),
          });
        }
        if (add.length) playSfx("click", 0.35);
        return [...cur, ...add];
      });
    }
    if (left <= 0) launch();
  }, [left, phase, realSeats.length]);

  const launchWithSeats = async (seatsList: RoyaleSeat[]) => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    playSfx("click", 1);
    setPhase("loading");

    try {
      const html = await prepareGame();
      const url = openGame(html, seatsList, myId);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = url;
      setGameUrl(url);
      setPhase("game");
    } catch (e) {
      console.error("Game launch error:", e);
      launchedRef.current = false;
      setPhase("error");
    }
  };

  const launch = () => {
    if (launchedRef.current) return;
    const fullSeats: RoyaleSeat[] = [...realSeats, ...bots].slice(0, SLOTS).map((s) => ({
      id: s.id,
      name: s.name,
      isBot: s.isBot,
      me: !!s.me,
      avatar_index: s.avatar_index,
      avatar_url: s.avatar_url,
    }));

    // إبلاغ جميع لاعبي الغرفة لبدء القتال في اللحظة نفسها
    try {
      if (clientRef.current?.isJoinedToRoom?.()) {
        clientRef.current.raiseEvent(KOS_EVENT_START, { seats: fullSeats }, { receivers: 0 });
      }
    } catch (e) {
      console.warn("Failed to raise KOS_EVENT_START:", e);
    }
    void launchWithSeats(fullSeats);
  };

  // مزامنة الحركة والإصابات والانتقال إلى الجزيرة بين إطارات اللعبة
  useEffect(() => {
    if (phase !== "game" || !gameUrl) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: string; state?: SeaState; hit?: SeaHit };

      if (data.type === "kos-state" && data.state) {
        if (clientRef.current?.isJoinedToRoom?.()) {
          clientRef.current.raiseEvent(KOS_EVENT_STATE, { id: myId, name: myName, state: data.state }, { receivers: 0 });
        }
      } else if (data.type === "kos-hit" && data.hit) {
        if (clientRef.current?.isJoinedToRoom?.()) {
          clientRef.current.raiseEvent(KOS_EVENT_HIT, data.hit, { receivers: 0 });
        }
      } else if (data.type === "kos-trigger-island") {
        if (clientRef.current?.isJoinedToRoom?.()) {
          clientRef.current.raiseEvent(KOS_EVENT_ISLAND, {}, { receivers: 0 });
        }
      } else if (data.type === "kos-exit") {
        exit();
      }
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [phase, gameUrl, myId, myName]);

  const exit = () => {
    if (clientRef.current) {
      try {
        if (clientRef.current.isJoinedToRoom?.()) clientRef.current.leaveRoom();
        clientRef.current.disconnect();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
    onClose();
  };

  const seats = [...realSeats, ...bots].slice(0, SLOTS);
  const ring = 2 * Math.PI * 44;

  return (
    <div className="kos-root" role="dialog" aria-label="ملك البحار">
      {phase === "game" && gameUrl ? (
        <>
          <iframe
            ref={frame}
            className="kos-frame"
            src={gameUrl}
            title="ملك البحار — لعب حي"
            allow="autoplay; fullscreen"
            onLoad={(e) => {
              const w = e.currentTarget.contentWindow;
              [400, 1200, 2500].forEach((ms) =>
                window.setTimeout(() => w?.postMessage({ type: "kos-start" }, "*"), ms)
              );
            }}
          />
          <button type="button" className="kos-exit" onClick={exit} aria-label="الخروج من المعركة">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" /></svg>
            خروج
          </button>
        </>
      ) : (
        <div className="kos-lobby">
          <header className="kos-head">
            <img src={crest} alt="" width={256} height={256} className="kos-head-crest" />
            <h2>ملك البحار</h2>
            <p>عشرة قباطنة في بحر واحد — يقاتلون التنين وبعضهم للانتقال إلى جزيرة المصير</p>
          </header>

          <div className="kos-versus">
            <div className="kos-hero">
              <CaptainAvatar seed={me.avatar_index ?? 0} url={me.avatar_url} className="kos-hero-img" />
              <b>{me.name}</b>
              <em>قبطانك الحقيقي</em>
            </div>
            <div className="kos-clock" aria-live="polite">
              <svg viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" className="kos-clock-bg" />
                <circle cx="50" cy="50" r="44" className="kos-clock-fg" strokeDasharray={ring} strokeDashoffset={ring * (1 - left / LOBBY_SECONDS)} />
              </svg>
              <span>{phase === "loading" ? "…" : left}</span>
              <small>{phase === "loading" ? "تجهيز البحر" : phase === "error" ? "تعذّر التحميل" : "تبدأ الحرب"}</small>
            </div>
            <div className="kos-hero kos-hero-foe">
              <div className="kos-count-big">{seats.length}<small>/{SLOTS}</small></div>
              <b>قباطنة في الردهة</b>
              <em>{humans.length ? `${humans.length + 1} لاعبين حقيقيين متصلين` : "بانتظار المنضمين عبر فوتون"}</em>
            </div>
          </div>

          <ul className="kos-seats">
            {Array.from({ length: SLOTS }, (_, i) => {
              const s = seats[i];
              return (
                <li key={s?.id ?? `e${i}`} className={s ? (s.me ? "me" : s.isBot ? "bot" : "human") : "empty"}>
                  {s ? (
                    <>
                      <CaptainAvatar seed={s.avatar_index ?? i} url={s.avatar_url} className="kos-seat-img" />
                      <b>{s.name}</b>
                      <em>{s.me ? "أنت" : s.isBot ? "قبطان آلي" : "لاعب حقيقي"}</em>
                    </>
                  ) : (
                    <em>بانتظار قبطان…</em>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="kos-foot">
            <button type="button" className="kos-ghost" onClick={exit}>مغادرة</button>
            {phase === "error" ? (
              <button type="button" className="kos-go" onClick={launch}>إعادة المحاولة</button>
            ) : (
              <button type="button" className="kos-go" disabled={phase === "loading"} onClick={launch}>ابدأ الآن</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
