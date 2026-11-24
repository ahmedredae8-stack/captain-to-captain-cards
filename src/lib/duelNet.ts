/**
 * Live 1v1 duels over Photon Realtime + Supabase Lobby.
 *
 * Layers:
 *  1. Lobby channel `duel-lobby` (Supabase Realtime): presence shows which captains are online;
 *     broadcast carries challenge / accept / decline handshakes.
 *  2. Pair handshake: the challenger generates the matchId and both sides accept.
 *  3. Battle session (Photon Realtime SDK): both sides join room `duel-<matchId>` on Photon Cloud.
 *     Every state-changing play (fire / shield / burn / move / leave) is raised in real-time
 *     over Photon WebSocket with minimal latency.
 */
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/player";
import type { DuelFireEvent } from "@/fx/weapons/playFireEvent";
import type { Side } from "@/game/duel";

// @ts-ignore
import Photon from "photon-realtime";

export const PHOTON_APP_ID =
  (import.meta.env.VITE_PHOTON_APP_ID as string) || "3fa819a4-e442-4730-81e2-3c7420a8e033";
const PHOTON_APP_VERSION = "1.0";
const DUEL_EVENT_CODE = 1;

export type LobbyMeta = {
  id: string;
  name: string;
  avatar_index?: number | undefined;
  avatar_url?: string | null | undefined;
  score?: number | undefined;
  waiting: boolean;
  where?: string | undefined;
  ts: number;
};

export type Challenge = { matchId: string; from: LobbyMeta; until: number };

/** A state-changing play broadcast between the two battle clients. */
export type DuelWire =
  | { t: "fire"; ev: DuelFireEvent; cost: number }
  | { t: "shield"; side: Side; ship: number; tier: number; cost: number }
  | { t: "burn"; side: Side; ship: number; dmg: number; burnLeft: number }
  | { t: "move"; side: Side; ship: number; spot: number }
  | { t: "leave" };

export const metaOf = (p: Player, waiting: boolean, where?: string): LobbyMeta => ({
  where,
  id: p.id,
  name: p.name,
  avatar_index: p.avatar_index,
  avatar_url: p.avatar_url,
  score: p.score,
  waiting,
  ts: Date.now(),
});

/** Build a display Player from lobby presence metadata (fields the arena needs). */
export const playerFromMeta = (m: LobbyMeta): Player => ({
  id: m.id,
  name: m.name,
  theme_id: "",
  last_seen: new Date().toISOString(),
  created_at: "",
  ...(m.avatar_index !== undefined ? { avatar_index: m.avatar_index } : {}),
  ...(m.avatar_url !== undefined ? { avatar_url: m.avatar_url } : {}),
  ...(m.score !== undefined ? { score: m.score } : {}),
});

const LOBBY = "duel-lobby";
const CHALLENGE_TTL = 15_000;

/**
 * Lobby presence + handshake. Active while the live-duels window is open.
 * `queueing` marks me as openly looking for a duel.
 */
const BLOCK_KEY = "duel-blocked-captains";
export const blockedIds = (): string[] => {
  try { return JSON.parse(localStorage.getItem(BLOCK_KEY) ?? "[]") as string[]; } catch { return []; }
};
export const blockCaptain = (id: string) => {
  const s = new Set(blockedIds()); s.add(id);
  localStorage.setItem(BLOCK_KEY, JSON.stringify([...s]));
};

export type ChallengeResult = { matchId: string } | "declined" | "timeout" | "ai" | "blocked";
export type Reply = "accept" | "decline" | "block" | "ai";

export function useDuelLobby(me: Player | null, queueing: boolean, where?: string) {
  const whereRef = useRef(where);
  whereRef.current = where;
  const [others, setOthers] = useState<LobbyMeta[]>([]);
  const [incoming, setIncoming] = useState<Challenge | null>(null);
  const [outgoing, setOutgoing] = useState<{ matchId: string; to: LobbyMeta } | null>(null);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const queueingRef = useRef(queueing);
  queueingRef.current = queueing;
  const pending = useRef<{ matchId: string; resolve: (v: ChallengeResult) => void; timer: number; attempts: number } | null>(null);
  const handledChallenges = useRef(new Set<string>());
  const readRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!me) return;
    const chan = supabase.channel(LOBBY, { config: { presence: { key: me.id } } });
    chanRef.current = chan;

    const readPresence = () => {
      const state = chan.presenceState() as Record<string, LobbyMeta[]>;
      const list: LobbyMeta[] = [];
      for (const [key, arr] of Object.entries(state)) {
        if (key === me.id) continue;
        const m = arr[arr.length - 1];
        if (m?.id && m.name) list.push(m);
      }
      setOthers(list);
    };
    readRef.current = readPresence;
    chan.on("presence", { event: "sync" }, readPresence);

    chan.on("broadcast", { event: "challenge" }, ({ payload }) => {
      const p = payload as { to: string; from: LobbyMeta; matchId: string };
      if (p.to !== me.id || p.from?.id === me.id || handledChallenges.current.has(p.matchId)) return;
      if (blockedIds().includes(p.from.id)) {
        void chan.send({ type: "broadcast", event: "decline", payload: { to: p.from.id, matchId: p.matchId, blocked: true } });
        return;
      }
      setIncoming((prev) => (prev && prev.until > Date.now() && prev.matchId === p.matchId ? prev : { matchId: p.matchId, from: p.from, until: Date.now() + CHALLENGE_TTL }));
    });

    chan.on("broadcast", { event: "accept" }, ({ payload }) => {
      const p = payload as { to: string; matchId: string };
      if (p.to !== me.id) return;
      const pend = pending.current;
      if (pend && pend.matchId === p.matchId) {
        window.clearTimeout(pend.timer);
        pending.current = null;
        setOutgoing(null);
        pend.resolve({ matchId: p.matchId });
      }
    });

    chan.on("broadcast", { event: "decline" }, ({ payload }) => {
      const p = payload as { to: string; matchId: string; ai?: boolean; blocked?: boolean };
      if (p.to !== me.id) return;
      const pend = pending.current;
      if (pend && pend.matchId === p.matchId) {
        window.clearTimeout(pend.timer);
        pending.current = null;
        setOutgoing(null);
        pend.resolve(p.ai ? "ai" : p.blocked ? "blocked" : "declined");
      }
    });

    void chan.subscribe((status) => {
      if (status === "SUBSCRIBED" && meRef.current) {
        void chan.track(metaOf(meRef.current, queueingRef.current, whereRef.current));
      }
    });

    const tick = window.setInterval(() => {
      setIncoming((c) => (c && c.until < Date.now() ? null : c));
      if (!document.hidden && meRef.current) void chan.track(metaOf(meRef.current, queueingRef.current, whereRef.current));
    }, 5_000);

    const onVis = () => {
      if (document.hidden) void chan.untrack();
      else if (meRef.current) void chan.track(metaOf(meRef.current, queueingRef.current, whereRef.current));
    };
    const onLeave = () => { void chan.untrack(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onLeave);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onLeave);
      window.clearInterval(tick);
      window.clearTimeout(pending.current?.timer);
      if (pending.current) { pending.current.resolve("timeout"); pending.current = null; }
      chanRef.current = null;
      void supabase.removeChannel(chan);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  useEffect(() => {
    const chan = chanRef.current;
    if (chan && me && chan.presenceState()) void chan.track(metaOf(me, queueing, whereRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueing, where]);

  const refresh = async () => {
    const chan = chanRef.current, m = meRef.current;
    if (!chan || !m) return;
    await chan.track(metaOf(m, queueingRef.current, whereRef.current));
    readRef.current?.();
  };

  const challenge = (peer: LobbyMeta) =>
    new Promise<ChallengeResult>((resolve) => {
      const chan = chanRef.current, m = meRef.current;
      if (!chan || !m) { resolve("timeout"); return; }
      const matchId = crypto.randomUUID();
      const timer = window.setTimeout(() => {
        const pend = pending.current;
        if (pend && pend.matchId === matchId) { pending.current = null; setOutgoing(null); pend.resolve("timeout"); }
      }, CHALLENGE_TTL);
      pending.current = { matchId, resolve, timer, attempts: 0 };
      setOutgoing({ matchId, to: peer });
      const send = () => {
        const pend = pending.current;
        if (!pend || pend.matchId !== matchId || !chanRef.current) return;
        pend.attempts += 1;
        void chan.send({ type: "broadcast", event: "challenge", payload: { to: peer.id, from: metaOf(m, queueingRef.current, whereRef.current), matchId, ts: Date.now() } });
        if (pend.attempts < 8) window.setTimeout(send, 1_200);
      };
      send();
    });

  const respond = (c: Challenge, reply: Reply | boolean): { matchId: string; role: "host" | "guest"; foe: Player } | null => {
    const r: Reply = reply === true ? "accept" : reply === false ? "decline" : reply;
    const chan = chanRef.current;
    setIncoming(null);
    handledChallenges.current.add(c.matchId);
    if (r === "block") blockCaptain(c.from.id);
    if (!chan) return null;
    const accept = r === "accept";
    const response = { to: c.from.id, matchId: c.matchId, ai: r === "ai", blocked: r === "block" };
    void chan.send({ type: "broadcast", event: accept ? "accept" : "decline", payload: response });
    if (accept) {
      window.setTimeout(() => { if (chanRef.current === chan) void chan.send({ type: "broadcast", event: "accept", payload: response }); }, 700);
      window.setTimeout(() => { if (chanRef.current === chan) void chan.send({ type: "broadcast", event: "accept", payload: response }); }, 1_500);
    }
    return accept ? { matchId: c.matchId, role: "guest", foe: playerFromMeta(c.from) } : null;
  };

  const cancelOutgoing = () => {
    const pend = pending.current;
    if (pend) { window.clearTimeout(pend.timer); pend.resolve("timeout"); pending.current = null; }
    setOutgoing(null);
  };

  return { others, incoming, outgoing, challenge, respond, cancelOutgoing, refresh };
}

/** Live battle events travel through a dedicated Photon Realtime room for this match. */
type DuelEnvelope = { id: string; event: DuelWire };

export class DuelSession {
  private onEvent: (ev: DuelWire) => void;
  private onFoeGone: () => void;
  private onError: (() => void) | undefined;
  private client: any = null;
  private seen = new Set<string>();
  private pending: DuelEnvelope[] = [];
  private closed = false;

  private constructor(
    matchId: string,
    role: "host" | "guest",
    handlers: { onEvent: (ev: DuelWire) => void; onFoeGone: () => void; onError?: () => void }
  ) {
    this.onEvent = handlers.onEvent;
    this.onFoeGone = handlers.onFoeGone;
    this.onError = handlers.onError;

    const roomName = `duel-${matchId}`;
    this.initPhoton(roomName, role);
  }

  private initPhoton(roomName: string, role: "host" | "guest") {
    if (typeof window === "undefined" || this.closed) return;

    try {
      const P = (Photon?.default || Photon) as any;
      if (!P) {
        this.onError?.();
        return;
      }

      // Ensure browser native WebSocket is used rather than Node 'ws'
      if (typeof window !== "undefined" && window.WebSocket && P.PhotonPeer) {
        P.PhotonPeer.setWebSocketImpl(window.WebSocket);
      }

      const LBC = P.LoadBalancing?.LoadBalancingClient;
      if (!LBC) {
        this.onError?.();
        return;
      }

      const client = new LBC(P.ConnectionProtocol.Wss, PHOTON_APP_ID, PHOTON_APP_VERSION);
      this.client = client;

      client.setUserId(`${role}-${crypto.randomUUID().slice(0, 8)}`);

      client.onStateChange = (state: number) => {
        if (this.closed) return;

        // When connected to Master Server, join or create the private duel room
        if (state === LBC.State.ConnectedToMaster) {
          client.joinRoom(roomName, { createIfNotExists: true }, { maxPlayers: 2 });
        } else if (state === LBC.State.Joined) {
          // Flush any events queued while connecting
          const queued = this.pending.splice(0);
          queued.forEach((env) => this.publish(env));
        } else if (state === LBC.State.Error) {
          this.onError?.();
        }
      };

      client.onEvent = (code: number, content: any) => {
        if (this.closed || code !== DUEL_EVENT_CODE || !content) return;
        const envelope = content as DuelEnvelope;
        if (!envelope.id || this.seen.has(envelope.id)) return;
        this.seen.add(envelope.id);
        this.onEvent(envelope.event);
      };

      client.onActorLeave = () => {
        if (!this.closed) {
          this.onFoeGone();
        }
      };

      client.onError = () => {
        if (!this.closed) {
          this.onError?.();
        }
      };

      // Connect to Photon Global/European Region Master
      client.connectToRegionMaster("EU");
    } catch (err) {
      console.error("Photon initialization error:", err);
      if (!this.closed) this.onError?.();
    }
  }

  static open(
    matchId: string,
    role: "host" | "guest",
    handlers: { onEvent: (ev: DuelWire) => void; onFoeGone: () => void; onError?: () => void }
  ): DuelSession {
    return new DuelSession(matchId, role, handlers);
  }

  send(ev: DuelWire): void {
    if (this.closed) return;
    const envelope: DuelEnvelope = { id: crypto.randomUUID(), event: ev };
    if (!this.client || !this.client.isJoinedToRoom?.()) {
      this.pending.push(envelope);
    } else {
      this.publish(envelope);
    }
  }

  private publish(envelope: DuelEnvelope) {
    if (this.closed || !this.client) return;
    try {
      // ReceiverGroup.Others (0): send to rival only
      this.client.raiseEvent(DUEL_EVENT_CODE, envelope, { receivers: 0 });
    } catch {
      this.pending.push(envelope);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.client) {
      try {
        if (this.client.isJoinedToRoom?.()) {
          this.client.leaveRoom();
        }
        this.client.disconnect();
      } catch {
        // cleanup ignore
      }
      this.client = null;
    }
  }
}
