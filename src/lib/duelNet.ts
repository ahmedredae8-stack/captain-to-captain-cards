/**
 * Live 1v1 duels over Lovable Cloud Realtime (public channels, publishable key only — no DB writes).
 *
 * Layers:
 *  1. Lobby channel `duel-lobby`: presence shows which captains are online; broadcast carries
 *     challenge / accept / decline handshakes.
 *  2. Pair handshake: the challenger generates the matchId and both sides join `duel-<matchId>`.
 *  3. Battle channel: every state-changing play (fire / shield / burn / move / leave) is broadcast;
 *     the acting client is authoritative and both clients replay the same event on the same
 *     deterministic initial state, so views stay in lockstep.
 */
import { useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Player } from "@/lib/player";
import type { DuelFireEvent } from "@/fx/weapons/playFireEvent";
import type { Side } from "@/game/duel";

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

    // Leave the online list the moment the game is hidden or closed; rejoin when it's back.
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

  /** Announce (or withdraw) my "looking for a duel" state. */
  useEffect(() => {
    const chan = chanRef.current;
    if (chan && me && chan.presenceState()) void chan.track(metaOf(me, queueing, whereRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueing, where]);

  /** Manual refresh: re-announce myself and re-read who is connected right now. */
  const refresh = async () => {
    const chan = chanRef.current, m = meRef.current;
    if (!chan || !m) return;
    await chan.track(metaOf(m, queueingRef.current, whereRef.current));
    readRef.current?.();
  };

  /** Challenge a captain; resolves with the matchId when they accept, else declined/timeout. */
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

  /** Answer an incoming challenge. Returns match info when accepted. */
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

/** Live battle events travel through a dedicated Realtime channel for this accepted match. */
type DuelEnvelope = { id: string; event: DuelWire };

export class DuelSession {
  private onEvent: (ev: DuelWire) => void;
  private onFoeGone: () => void;
  private onError: (() => void) | undefined;
  private channel: RealtimeChannel | null = null;
  private eventKey: string;
  private seen = new Set<string>();
  private pending: DuelEnvelope[] = [];
  private foeSeen = false;
  private lastSeen = 0;
  private timer: number;
  private closed = false;
  private notified = false;

  private constructor(matchId: string, role: "host" | "guest", handlers: { onEvent: (ev: DuelWire) => void; onFoeGone: () => void; onError?: () => void }) {
    this.onEvent = handlers.onEvent;
    this.onFoeGone = handlers.onFoeGone;
    this.onError = handlers.onError;
    this.eventKey = `duel-${matchId}`;
    const channel = supabase.channel(this.eventKey, {
      config: { presence: { key: `${role}-${crypto.randomUUID()}` }, broadcast: { self: false, ack: true } },
    });
    this.channel = channel;
    channel.on("broadcast", { event: "play" }, ({ payload }) => {
      const envelope = payload as DuelEnvelope;
      if (!envelope?.id || this.seen.has(envelope.id)) return;
      this.seen.add(envelope.id);
      this.onEvent(envelope.event);
    });
    channel.on("presence", { event: "sync" }, () => {
      const peers = Object.values(channel.presenceState() as Record<string, unknown[]>).flat();
      if (peers.length > 1) {
        this.foeSeen = true;
        this.lastSeen = Date.now();
        this.notified = false;
      }
    });
    void channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        void channel.track({ role });
        const queued = this.pending.splice(0);
        queued.forEach((envelope) => this.publish(envelope));
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (!this.closed) this.onError?.();
      }
    });
    this.timer = window.setInterval(() => {
      if (this.closed || !this.channel || !this.foeSeen) return;
      const peers = Object.values(this.channel.presenceState() as Record<string, unknown[]>).flat();
      if (peers.length > 1) { this.lastSeen = Date.now(); return; }
      if (Date.now() - this.lastSeen > 10_000 && !this.notified) {
        this.notified = true;
        this.onFoeGone();
      }
    }, 1_000);
  }

  static open(matchId: string, role: "host" | "guest", handlers: { onEvent: (ev: DuelWire) => void; onFoeGone: () => void; onError?: () => void }): DuelSession {
    return new DuelSession(matchId, role, handlers);
  }

  send(ev: DuelWire): void {
    if (this.closed) return;
    const envelope = { id: crypto.randomUUID(), event: ev };
    if (!this.channel || this.channel.state !== "joined") this.pending.push(envelope);
    else this.publish(envelope);
  }

  private publish(event: DuelEnvelope) {
    const channel = this.channel;
    if (!channel || channel.state !== "joined") { this.pending.push(event); return; }
    void channel.send({ type: "broadcast", event: "play", payload: event }).then((status) => {
      if (status !== "ok" && !this.closed && !this.seen.has(event.id)) {
        window.setTimeout(() => this.publish(event), 350);
      }
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    window.clearInterval(this.timer);
    const channel = this.channel;
    this.channel = null;
    if (channel) void supabase.removeChannel(channel);
  }
}
