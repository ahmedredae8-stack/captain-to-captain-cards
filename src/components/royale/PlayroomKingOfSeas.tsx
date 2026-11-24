import { useEffect, useMemo, useRef, useState } from "react";
import type { Player } from "@/lib/player";
import { playSfx } from "@/lib/sound";
import { prepareGame } from "@/components/royale/KingOfSeas";
import { royaleScript, type RoyaleSeat } from "@/components/royale/royaleInject";

// @ts-ignore
import Photon from "photon-realtime";

export const PHOTON_APP_ID =
  (import.meta.env.VITE_PHOTON_APP_ID as string) || "3fa819a4-e442-4730-81e2-3c7420a8e033";
const PHOTON_APP_VERSION = "1.0";
const KOS_ROOM_NAME = "king-of-seas-arena";
const SLOTS = 10;

const KOS_EVENT_STATE = 10;
const KOS_EVENT_HIT = 11;
const KOS_EVENT_START = 12;

const BOT_NAMES = [
  "صقر الخلجان", "الحوت الأسود", "قاهر العواصف", "ذيب اليم", "سيف المرجان",
  "ريّس الموج", "نجم الشمال", "شبح الضباب", "عقاب الصخور", "رعد الأعماق", "ملاح الفجر",
];

type CaptainState = { id: string; name: string; avatar_index: number; avatar_url: string | null };
type SeaState = { pos: { x: number; y: number; z: number }; hp: number; alive: boolean; yaw?: number };
type SeaHit = { id: string; shooterId: string; targetId: string; damage: number };

function makeGameUrl(html: string, seats: RoyaleSeat[], playerId: string) {
  const script = royaleScript(seats, playerId);
  const at = html.lastIndexOf("</body>");
  const source = at >= 0 ? html.slice(0, at) + script + html.slice(at) : html + script;
  return URL.createObjectURL(new Blob([source], { type: "text/html" }));
}

export function KingOfSeas({ player, playerName, onClose }: { player?: Player | null; playerName: string; onClose: () => void }) {
  const [phase, setPhase] = useState<"lobby" | "loading" | "game" | "error">("lobby");
  const [message, setMessage] = useState("جارٍ الاتصال بشبكة فوتون…");
  const [gameUrl, setGameUrl] = useState<string | null>(null);
  const [seatCount, setSeatCount] = useState(1);
  const [connected, setConnected] = useState(false);

  const frame = useRef<HTMLIFrameElement>(null);
  const clientRef = useRef<any>(null);
  const blobRef = useRef<string | null>(null);
  const seatsRef = useRef<RoyaleSeat[]>([]);
  const isStartedRef = useRef(false);

  const myId = useRef(player?.id ?? `guest-${Math.random().toString(36).slice(2, 9)}`).current;
  const myName = playerName || player?.name || "القبطان";

  const buildSeatsList = (actors: any[]): RoyaleSeat[] => {
    const list: RoyaleSeat[] = [];
    const usedNames = new Set<string>();

    // Add self first
    list.push({
      id: myId,
      name: myName,
      isBot: false,
      me: true,
      avatar_index: player?.avatar_index ?? 0,
      avatar_url: player?.avatar_url ?? null,
    });
    usedNames.add(myName);

    // Add other connected human actors
    for (const actor of actors) {
      if (actor.isLocal) continue;
      const custom = actor.getCustomProperty?.("captain") as CaptainState | undefined;
      const actorName = custom?.name || actor.name || `قبطان ${actor.actorNr}`;
      const actorId = custom?.id || `actor-${actor.actorNr}`;
      list.push({
        id: actorId,
        name: actorName,
        isBot: false,
        me: false,
        avatar_index: custom?.avatar_index ?? 0,
        avatar_url: custom?.avatar_url ?? null,
      });
      usedNames.add(actorName);
      if (list.length >= SLOTS) break;
    }

    // Fill remaining slots with bot captains up to SLOTS
    const pool = BOT_NAMES.filter((n) => !usedNames.has(n));
    let botIndex = 0;
    while (list.length < SLOTS) {
      const bName = pool[botIndex] || `قرصان ${botIndex + 1}`;
      list.push({
        id: `bot-${botIndex + 1}`,
        name: bName,
        isBot: true,
        me: false,
        avatar_index: (botIndex * 3 + 1) % 10,
      });
      botIndex++;
    }

    return list.slice(0, SLOTS);
  };

  const launchBattle = async (seats: RoyaleSeat[]) => {
    if (isStartedRef.current) return;
    isStartedRef.current = true;
    seatsRef.current = seats;

    setPhase("loading");
    setMessage("نجهّز المعركة عبر سيرفرات فوتون…");

    try {
      const html = await prepareGame();
      const url = makeGameUrl(html, seats, myId);
      if (blobRef.current) URL.revokeObjectURL(blobRef.current);
      blobRef.current = url;
      setGameUrl(url);
      setPhase("game");
      playSfx("click", 0.8);
    } catch (err) {
      console.error("Failed to prepare game:", err);
      isStartedRef.current = false;
      setPhase("error");
      setMessage("تعذّر تجهيز المعركة. حاول مجدداً.");
    }
  };

  // Connect to Photon Realtime and join room
  useEffect(() => {
    let unmounted = false;

    try {
      const P = (Photon?.default || Photon) as any;
      if (!P) {
        setPhase("error");
        setMessage("تعذّر تحميل مكتبة Photon.");
        return;
      }

      if (typeof window !== "undefined" && window.WebSocket && P.PhotonPeer) {
        P.PhotonPeer.setWebSocketImpl(window.WebSocket);
      }

      const LBC = P.LoadBalancing?.LoadBalancingClient;
      if (!LBC) {
        setPhase("error");
        setMessage("مكونات عميل فوتون غير متوفرة.");
        return;
      }

      const client = new LBC(P.ConnectionProtocol.Wss, PHOTON_APP_ID, PHOTON_APP_VERSION);
      clientRef.current = client;

      client.setUserId(myId);

      const updateActors = () => {
        if (unmounted) return;
        try {
          const actors = client.myRoomActorsArray?.() || [];
          setSeatCount(Math.max(1, actors.length));
        } catch {
          // ignore
        }
      };

      client.onStateChange = (state: number) => {
        if (unmounted) return;

        if (state === LBC.State.ConnectedToMaster) {
          setMessage("متصل بفوتون — جاري الانضمام للغرفة…");
          client.joinRoom(KOS_ROOM_NAME, { createIfNotExists: true }, { maxPlayers: SLOTS });
        } else if (state === LBC.State.Joined) {
          setConnected(true);
          setMessage("أنت في الغرفة — بانتظار بدء المعركة");

          const actor = client.myActor();
          if (actor) {
            actor.setName(myName);
            actor.setCustomProperties({
              captain: {
                id: myId,
                name: myName,
                avatar_index: player?.avatar_index ?? 0,
                avatar_url: player?.avatar_url ?? null,
              },
            });
          }
          updateActors();
        } else if (state === LBC.State.Error) {
          setPhase("error");
          setMessage("حدث خطأ أثناء الاتصال بشبكة فوتون.");
        }
      };

      client.onActorJoin = () => {
        updateActors();
        playSfx("click", 0.4);
      };

      client.onActorLeave = () => {
        updateActors();
      };

      client.onActorPropertiesChange = () => {
        updateActors();
      };

      client.onEvent = (code: number, content: any) => {
        if (unmounted || !content) return;

        if (code === KOS_EVENT_START) {
          // Remote host started the game
          const remoteSeats = content.seats as RoyaleSeat[] | undefined;
          if (remoteSeats && Array.isArray(remoteSeats)) {
            const adaptedSeats = remoteSeats.map((s) => ({
              ...s,
              me: s.id === myId,
            }));
            void launchBattle(adaptedSeats);
          }
        } else if (code === KOS_EVENT_STATE) {
          // Ship position/health update from another player
          const target = frame.current?.contentWindow;
          if (target && content.id && content.state) {
            target.postMessage(
              {
                type: "kos-remote",
                id: content.id,
                name: content.name || "قبطان",
                state: content.state,
              },
              "*"
            );
          }
        } else if (code === KOS_EVENT_HIT) {
          // Missile hit from another player
          const target = frame.current?.contentWindow;
          if (target && content) {
            target.postMessage({ type: "kos-hit", hit: content }, "*");
          }
        }
      };

      client.onError = () => {
        if (!unmounted && phase !== "game") {
          setPhase("error");
          setMessage("تعذّر الاتصال بخوادم فوتون.");
        }
      };

      client.connectToRegionMaster("EU");
    } catch (e) {
      console.error("Photon setup failed:", e);
      if (!unmounted) {
        setPhase("error");
        setMessage("فشل تشغيل محرك شبكة فوتون.");
      }
    }

    return () => {
      unmounted = true;
      if (clientRef.current) {
        try {
          if (clientRef.current.isJoinedToRoom?.()) {
            clientRef.current.leaveRoom();
          }
          clientRef.current.disconnect();
        } catch {
          // ignore
        }
        clientRef.current = null;
      }
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [myId, myName, player?.avatar_index, player?.avatar_url]);

  const handleStart = () => {
    if (!clientRef.current || phase === "loading" || isStartedRef.current) return;
    const actors = clientRef.current.myRoomActorsArray?.() || [];
    const seats = buildSeatsList(actors);

    // Notify all other players in the room to start together
    try {
      clientRef.current.raiseEvent(
        KOS_EVENT_START,
        { seats },
        { receivers: 0 }
      );
    } catch (e) {
      console.warn("Failed to broadcast start event:", e);
    }

    void launchBattle(seats);
  };

  // Handle postMessage communication with game iframe
  useEffect(() => {
    if (phase !== "game" || !gameUrl) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: string; state?: SeaState; hit?: SeaHit };

      if (data.type === "kos-state" && data.state) {
        if (clientRef.current?.isJoinedToRoom?.()) {
          try {
            clientRef.current.raiseEvent(
              KOS_EVENT_STATE,
              { id: myId, name: myName, state: data.state },
              { receivers: 0 }
            );
          } catch {
            // ignore packet drops
          }
        }
      } else if (data.type === "kos-hit" && data.hit) {
        if (clientRef.current?.isJoinedToRoom?.()) {
          try {
            clientRef.current.raiseEvent(KOS_EVENT_HIT, data.hit, { receivers: 0 });
          } catch {
            // ignore packet drops
          }
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
        if (clientRef.current.isJoinedToRoom?.()) {
          clientRef.current.leaveRoom();
        }
        clientRef.current.disconnect();
      } catch {
        // ignore
      }
      clientRef.current = null;
    }
    onClose();
  };

  const header = useMemo(
    () =>
      phase === "game"
        ? "معركة ملك البحار — مباشر"
        : phase === "error"
        ? "تعذّر تشغيل ملك البحار"
        : "ملك البحار — شبكة فوتون",
    [phase]
  );

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
          />
          <button
            type="button"
            className="kos-exit"
            onClick={exit}
            aria-label="الخروج من المعركة"
          >
            خروج
          </button>
        </>
      ) : (
        <div className="kos-lobby">
          <header className="kos-head">
            <h2>{header}</h2>
            <p>{message}</p>
          </header>
          <div className="kos-versus">
            <div className="kos-hero">
              <b>{myName}</b>
              <em>قبطانك الحقيقي</em>
            </div>
            <div className="kos-clock">
              <span>{phase === "loading" ? "…" : seatCount}</span>
              <small>{phase === "loading" ? "تجهيز البحر" : "لاعبون متصلون"}</small>
            </div>
            <div className="kos-hero kos-hero-foe">
              <div className="kos-count-big">
                {seatCount}
                <small>/{SLOTS}</small>
              </div>
              <b>الغرفة المباشرة</b>
              <em>سيرفرات Photon Realtime</em>
            </div>
          </div>
          <div className="kos-foot">
            <button type="button" className="kos-ghost" onClick={exit}>
              مغادرة
            </button>
            {phase === "error" ? (
              <button
                type="button"
                className="kos-go"
                onClick={() => window.location.reload()}
              >
                إعادة المحاولة
              </button>
            ) : (
              <button
                type="button"
                className="kos-go"
                disabled={!connected || phase === "loading"}
                onClick={handleStart}
              >
                ابدأ الآن
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
