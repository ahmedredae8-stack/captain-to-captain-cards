import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/player";
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

export type DuelWire =
  | { t: "fire"; cardId: string; weapon: string; dmg: number; roll: number; crit: boolean; burn: boolean }
  | { t: "shield"; cardId: string; weapon: string; amount: number; roll: number; burn: boolean }
  | { t: "burn"; dmg: number }
  | { t: "move"; cardId: string; from: string; to: string }
  | { t: "leave" }
  | { t: "hello"; role: string };

type DuelEnvelope = { id: string; event: DuelWire };

export type Reply = "accept" | "decline" | "ai" | "block";
export type ChallengeResult = { matchId: string } | "declined" | "ai" | "blocked" | "timeout";

const LOBBY_CHANNEL = "duel-lobby";
const CHALLENGE_TTL = 15_000;
const BLOCKED_KEY = "c2c_blocked_captains";

export function blockedIds(): string[] {
  try {
    const raw = localStorage.getItem(BLOCKED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function blockCaptain(id: string) {
  const cur = blockedIds();
  if (!cur.includes(id)) {
    try {
      localStorage.setItem(BLOCKED_KEY, JSON.stringify([...cur, id]));
    } catch {
      // ignore
    }
  }
}

export function metaOf(player: Player, waiting: boolean, where?: string): LobbyMeta {
  return {
    id: player.id,
    name: player.name || "قبطان",
    avatar_index: player.avatar_index,
    avatar_url: player.avatar_url,
    score: player.score ?? 0,
    waiting,
    where,
    ts: Date.now(),
  };
}

export function playerFromMeta(m: LobbyMeta): Player {
  return {
    id: m.id,
    user_id: m.id,
    name: m.name,
    avatar_index: m.avatar_index ?? 0,
    avatar_url: m.avatar_url ?? null,
    score: m.score ?? 0,
    coins: 0,
    pearls: 0,
    level: 1,
    unlocked_ships: ["dhow"],
    active_ship: "dhow",
    active_title: null,
    fleet_layout: null,
    created_at: new Date(m.ts).toISOString(),
    updated_at: new Date(m.ts).toISOString(),
  };
}

/** إدارة قائمة اللاعبين وتحديات النزال عبر Supabase Realtime */
export function useDuelLobby(me: Player | null, queueing = true, where?: string) {
  const [others, setOthers] = useState<LobbyMeta[]>([]);
  const [incoming, setIncoming] = useState<Challenge | null>(null);
  const [outgoing, setOutgoing] = useState<{ matchId: string; to: LobbyMeta } | null>(null);

  const chanRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pending = useRef<{ matchId: string; resolve: (r: ChallengeResult) => void; timer: number; attempts: number } | null>(null);
  const handledChallenges = useRef<Set<string>>(new Set());
  const meRef = useRef(me);
  meRef.current = me;
  const queueingRef = useRef(queueing);
  queueingRef.current = queueing;
  const whereRef = useRef(where);
  whereRef.current = where;
  const readRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!me?.id) {
      setOthers([]);
      return;
    }
    const myId = me.id;
    const chan = supabase.channel(LOBBY_CHANNEL, { config: { presence: { key: myId } } });
    chanRef.current = chan;

    const readPresence = () => {
      const state = chan.presenceState() as Record<string, LobbyMeta[]>;
      const list: LobbyMeta[] = [];
      const blocked = new Set(blockedIds());
      const now = Date.now();
      for (const [k, metas] of Object.entries(state)) {
        if (k === myId) continue;
        const latest = metas[metas.length - 1];
        if (!latest || blocked.has(latest.id)) continue;
        if (now - latest.ts < 60_000) list.push(latest);
      }
      setOthers(list);
    };

    readRef.current = readPresence;
    chan.on("presence", { event: "sync" }, readPresence);

    chan.on("broadcast", { event: "challenge" }, ({ payload }) => {
      const p = payload as { to: string; from: LobbyMeta; matchId: string };
      if (p.to !== myId || p.from?.id === myId || handledChallenges.current.has(p.matchId)) return;
      if (blockedIds().includes(p.from.id)) {
        void chan.send({ type: "broadcast", event: "decline", payload: { to: p.from.id, matchId: p.matchId, blocked: true } });
        return;
      }
      setIncoming((prev) => (prev && prev.until > Date.now() && prev.matchId === p.matchId ? prev : { matchId: p.matchId, from: p.from, until: Date.now() + CHALLENGE_TTL }));
    });

    chan.on("broadcast", { event: "accept" }, ({ payload }) => {
      const p = payload as { to: string; matchId: string };
      if (p.to !== myId) return;
      void chan.send({ type: "broadcast", event: "ack_accept", payload: { to: p.to, matchId: p.matchId } });

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
      if (p.to !== myId) return;
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
  }, [me?.id]);

  useEffect(() => {
    const chan = chanRef.current;
    if (chan && me && chan.presenceState()) void chan.track(metaOf(me, queueing, whereRef.current));
  }, [queueing, where, me]);

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
        if (pend.attempts < 10) window.setTimeout(send, 1_000);
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
      [300, 700, 1200, 2000].forEach((ms) => {
        window.setTimeout(() => {
          if (chanRef.current === chan) void chan.send({ type: "broadcast", event: "accept", payload: response });
        }, ms);
      });
    }
    return accept ? { matchId: c.matchId, role: "guest", foe: playerFromMeta(c.from) } : null;
  };

  const cancelOutgoing = () => {
    if (pending.current) {
      window.clearTimeout(pending.current.timer);
      pending.current.resolve("timeout");
      pending.current = null;
    }
    setOutgoing(null);
  };

  return { others, incoming, outgoing, challenge, respond, cancelOutgoing, refresh };
}

/** Photon Realtime Duel Session */
export class DuelSession {
  private client: any = null;
  private closed = false;
  private seen = new Set<string>();
  private pending: DuelEnvelope[] = [];
  private peerPresent = false;
  private foeLeaveTimer: number | null = null;

  private onEvent: (ev: DuelWire) => void;
  private onFoeGone: () => void;
  private onError?: () => void;

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

      const checkPeer = () => {
        try {
          if (!client.isJoinedToRoom?.()) return;
          const rivals = (client.myRoomActorsArray?.() || []).filter((a: any) => !a.isLocal);
          if (rivals.length > 0) {
            this.peerPresent = true;
            if (this.foeLeaveTimer) {
              window.clearTimeout(this.foeLeaveTimer);
              this.foeLeaveTimer = null;
            }
            this.flushPending();
          }
        } catch {
          // ignore
        }
      };

      client.onStateChange = (state: number) => {
        if (this.closed) return;

        if (state === LBC.State.ConnectedToMaster) {
          client.joinRoom(roomName, { createIfNotExists: true }, { maxPlayers: 2 });
        } else if (state === LBC.State.Joined) {
          checkPeer();
          try {
            client.raiseEvent(DUEL_EVENT_CODE, { id: `hello-${role}`, event: { t: "hello", role } }, { receivers: 0 });
          } catch {
            // ignore
          }
        } else if (state === LBC.State.Error) {
          this.onError?.();
        }
      };

      client.onActorJoin = (actor: any) => {
        if (!this.closed && !actor.isLocal) {
          this.peerPresent = true;
          if (this.foeLeaveTimer) {
            window.clearTimeout(this.foeLeaveTimer);
            this.foeLeaveTimer = null;
          }
          this.flushPending();
        }
      };

      client.onActorLeave = (actor: any) => {
        if (this.closed || actor.isLocal || !this.peerPresent || this.foeLeaveTimer) return;
        this.foeLeaveTimer = window.setTimeout(() => {
          if (!this.closed) this.onFoeGone();
        }, 6_000);
      };

      client.onEvent = (code: number, content: any) => {
        if (this.closed || code !== DUEL_EVENT_CODE || !content?.id || this.seen.has(content.id)) return;
        this.seen.add(content.id);
        this.peerPresent = true;
        if (this.foeLeaveTimer) {
          window.clearTimeout(this.foeLeaveTimer);
          this.foeLeaveTimer = null;
        }

        if (content.event?.t === "hello") {
          this.flushPending();
          return;
        }

        this.onEvent(content.event);
      };

      client.onError = () => {
        if (!this.closed) this.onError?.();
      };

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
    if (!this.client?.isJoinedToRoom?.() || !this.peerPresent) {
      this.pending.push(envelope);
    } else {
      this.publish(envelope);
    }
  }

  private flushPending() {
    if (this.closed || !this.client?.isJoinedToRoom?.()) return;
    this.pending.splice(0).forEach((env) => this.publish(env));
  }

  private publish(envelope: DuelEnvelope) {
    if (this.closed || !this.client) return;
    try {
      this.client.raiseEvent(DUEL_EVENT_CODE, envelope, { receivers: 0 });
    } catch {
      this.pending.push(envelope);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.foeLeaveTimer) {
      window.clearTimeout(this.foeLeaveTimer);
      this.foeLeaveTimer = null;
    }
    if (this.client) {
      try {
        if (this.client.isJoinedToRoom?.()) {
          this.client.leaveRoom();
        }
        this.client.disconnect();
      } catch {
        // ignore
      }
      this.client = null;
    }
  }
}
