import { useCallback, useEffect, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";
import { savePlayerId, touchPresence, type Player } from "@/lib/player";

// حالة مشتركة موحدة للاعب عبر جميع مكونات اللعبة لمنع تكرار القنوات والأخطاء
let globalPlayer: Player | null = null;
let globalLoading: boolean = true;
let hasInitialized = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((cb) => cb());

let activeChannel: ReturnType<typeof supabase.channel> | null = null;
let activePlayerId: string | null = null;

function setGlobalPlayer(action: Player | null | ((prev: Player | null) => Player | null)) {
  const next = typeof action === "function" ? action(globalPlayer) : action;
  if (next !== globalPlayer) {
    globalPlayer = next;
    if (next?.id) {
      savePlayerId(next.id);
    }
    emit();
    syncRealtime(globalPlayer?.id ?? null);
  }
}

function setGlobalLoading(loading: boolean) {
  if (globalLoading !== loading) {
    globalLoading = loading;
    emit();
  }
}

function syncRealtime(playerId: string | null) {
  if (typeof window === "undefined") return;

  if (!playerId) {
    if (activeChannel) {
      void supabase.removeChannel(activeChannel);
      activeChannel = null;
      activePlayerId = null;
    }
    return;
  }

  // إذا كانت القناة نشطة بالفعل لنفس اللاعب لا نكرر الاشتراك
  if (activePlayerId === playerId && activeChannel) {
    return;
  }

  if (activeChannel) {
    void supabase.removeChannel(activeChannel);
    activeChannel = null;
    activePlayerId = null;
  }

  activePlayerId = playerId;
  const channelTopic = `realtime-player-${playerId}-${Date.now()}`;

  const channel = supabase
    .channel(channelTopic)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "players",
        filter: `id=eq.${playerId}`,
      },
      (payload) => {
        if (payload.new && typeof payload.new === "object") {
          setGlobalPlayer((prev) => (prev ? { ...prev, ...(payload.new as any) } : (payload.new as any)));
        } else {
          void globalRefresh();
        }
      }
    )
    .subscribe();

  activeChannel = channel;
}

export async function globalRefresh(): Promise<void> {
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user.id;
    if (!userId) {
      setGlobalPlayer(null);
      setGlobalLoading(false);
      return;
    }
    const { data } = await supabase.from("players").select("*").eq("user_id", userId).maybeSingle();
    const nextPlayer = (data as Player) ?? null;
    setGlobalPlayer(nextPlayer);
  } catch (err) {
    console.error("Error refreshing player:", err);
  } finally {
    setGlobalLoading(false);
  }
}

function initAuthListener() {
  if (hasInitialized || typeof window === "undefined") return;
  hasInitialized = true;

  void globalRefresh();

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
      void globalRefresh();
    }
  });
}

// بدء الاستماع تلقائياً في المتصفح فور تحميل الملف
if (typeof window !== "undefined") {
  initAuthListener();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getPlayerSnap = () => globalPlayer;
const getServerPlayerSnap = (): Player | null => null;

const getLoadingSnap = () => globalLoading;
const getServerLoadingSnap = (): boolean => true;

/** Loads the signed-in captain and keeps their presence and realtime balance fresh. */
export function usePlayer() {
  useEffect(() => {
    initAuthListener();
  }, []);

  const player = useSyncExternalStore(subscribe, getPlayerSnap, getServerPlayerSnap);
  const loading = useSyncExternalStore(subscribe, getLoadingSnap, getServerLoadingSnap);

  const setPlayer = useCallback((action: Player | null | ((prev: Player | null) => Player | null)) => {
    setGlobalPlayer(action);
  }, []);

  const refresh = useCallback(async () => {
    await globalRefresh();
  }, []);

  useEffect(() => {
    if (!player?.id) return;
    void touchPresence(player.id);
    const t = setInterval(() => void touchPresence(player.id), 45_000);
    return () => clearInterval(t);
  }, [player?.id]);

  return { player, loading, setPlayer, refresh };
}
