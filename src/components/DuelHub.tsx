import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Check, Swords, X, Ban } from "lucide-react";
import { usePlayer } from "@/hooks/usePlayer";
import { useDuelLobby, type Challenge } from "@/lib/duelNet";
import { CaptainAvatar } from "@/components/GameSprite";
import type { Player } from "@/lib/player";
import { playSfx } from "@/lib/sound";

export type PendingMatch = { matchId: string; role: "host" | "guest"; foe: Player };
type Hub = {
  lobby: ReturnType<typeof useDuelLobby>;
  pending: PendingMatch | null;
  clearPending: () => void;
};
const HubCtx = createContext<Hub | null>(null);

export function useDuelHub(): Hub {
  const v = useContext(HubCtx);
  if (!v) throw new Error("useDuelHub outside DuelHubProvider");
  return v;
}

const PLACE: Record<string, string> = { "/": "في الميناء", "/settings": "في الإعدادات", "/chat": "في المحادثة", "/friends": "مع الأصدقاء", "/tribes": "في القبيلة", "/shipyard": "في الترسانة", "/fish-market": "في سوق السمك" };
export const placeLabel = (path?: string) => (path ? PLACE[path] ?? "يتجوّل في اللعبة" : "متصل");

/** App-wide presence + challenge channel: online and reachable on every page of the game. */
export function DuelHubProvider({ children }: { children: ReactNode }) {
  const { player } = usePlayer();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const lobby = useDuelLobby(player, true, pathname);
  const [pending, setPending] = useState<PendingMatch | null>(null);
  const lastIncoming = useRef<string | null>(null);

  useEffect(() => {
    if (lobby.incoming && lobby.incoming.matchId !== lastIncoming.current) {
      lastIncoming.current = lobby.incoming.matchId;
      playSfx("click", 1);
    }
  }, [lobby.incoming]);

  const answer = (c: Challenge, r: "accept" | "decline" | "block") => {
    playSfx("click", 0.8);
    const m = lobby.respond(c, r);
    if (m) {
      setPending(m);
      if (pathname !== "/") void navigate({ to: "/" });
    }
  };

  return (
    <HubCtx.Provider value={{ lobby, pending, clearPending: () => setPending(null) }}>
      {children}
      <DuelInvite incoming={lobby.incoming} outgoing={lobby.outgoing} onAnswer={answer} onCancel={lobby.cancelOutgoing} />
    </HubCtx.Provider>
  );
}

function DuelInvite({ incoming, outgoing, onAnswer, onCancel }: {
  incoming: Challenge | null;
  outgoing: { to: { name: string; avatar_index?: number | undefined; avatar_url?: string | null | undefined } } | null;
  onAnswer: (c: Challenge, r: "accept" | "decline" | "block") => void;
  onCancel: () => void;
}) {
  const [, tick] = useState(0);
  useEffect(() => { const t = window.setInterval(() => tick((v) => v + 1), 500); return () => window.clearInterval(t); }, []);
  if (incoming) {
    const left = Math.max(0, Math.ceil((incoming.until - Date.now()) / 1000));
    return (
      <div className="daily-overlay duel-invite" role="alertdialog" aria-label="دعوة للقتال" dir="rtl">
        <div className="daily-panel duel-invite-panel">
          <header className="daily-head">
            <span className="daily-kicker">نداء من عرض البحر</span>
            <h2 className="daily-title">وصلك تحدٍّ للنزال!</h2>
          </header>
          <div className="duel-invite-foe">
            <CaptainAvatar seed={incoming.from.avatar_index ?? 0} url={incoming.from.avatar_url} className="duel-invite-avatar" />
            <b>{incoming.from.name}</b>
            <span>نقاط المجد: {incoming.from.score ?? 0}</span>
          </div>
          <div className="duel-invite-timer"><i style={{ width: `${(left / 15) * 100}%` }} /><small>{left} ثانية للرد</small></div>
          <button type="button" className="tos-btn daily-claim" onClick={() => onAnswer(incoming, "accept")}><Check className="h-4 w-4" /> قبول النزال</button>
          <div className="duel-invite-row">
            <button type="button" className="tos-btn duel-invite-ghost" onClick={() => onAnswer(incoming, "decline")}><X className="h-4 w-4" /> رفض</button>
            <button type="button" className="tos-btn duel-invite-ghost" onClick={() => onAnswer(incoming, "block")}><Ban className="h-4 w-4" /> رفض نهائي</button>
          </div>
        </div>
      </div>
    );
  }
  if (outgoing) {
    return (
      <div className="duel-requests" dir="rtl">
        <div className="duel-banner" role="status">
          <Swords className="h-4 w-4" /><span>أُرسل التحدي إلى <b>{outgoing.to.name}</b>… بانتظار موافقته</span>
          <button type="button" className="tos-x" aria-label="إلغاء" onClick={onCancel}><X className="h-4 w-4" /></button>
        </div>
      </div>
    );
  }
  return null;
}
