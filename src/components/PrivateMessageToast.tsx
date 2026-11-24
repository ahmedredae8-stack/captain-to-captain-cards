import { useEffect, useState, useRef } from "react";
import { MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CaptainAvatar, nameSeed } from "@/components/GameSprite";
import { playSfx } from "@/lib/sound";
import type { Message, Player } from "@/lib/player";

interface PrivateMessageToastProps {
  me: Player | null;
  onOpenChat: (peer: Player) => void;
}

export function PrivateMessageToast({ me, onOpenChat }: PrivateMessageToastProps) {
  const [toast, setToast] = useState<{
    id: string;
    sender: Player;
    body: string;
  } | null>(null);

  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!me?.id) return;

    const ch = supabase
      .channel(`pm-toast-${me.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `recipient_id=eq.${me.id}`,
        },
        async (payload) => {
          const m = payload.new as Message;
          if (!m || m.sender_id === me.id) return;

          let sender: Player = {
            id: m.sender_id,
            name: "قبطان مجهول",
            avatar_index: 0,
            avatar_url: null,
            level: 1,
            gold: 0,
            rubies: 0,
            diamonds: 0,
          };

          try {
            const { data } = await supabase
              .from("player_public_profiles")
              .select("*")
              .eq("id", m.sender_id)
              .maybeSingle();

            if (data) {
              sender = data as Player;
            } else {
              sender.name = "قبطان مجهول";
              sender.avatar_index = nameSeed(m.sender_id);
            }
          } catch {
            sender.avatar_index = nameSeed(m.sender_id);
          }

          playSfx("click", 0.6);
          setToast({
            id: m.id,
            sender,
            body: m.body,
          });

          if (timerRef.current) window.clearTimeout(timerRef.current);
          timerRef.current = window.setTimeout(() => {
            setToast(null);
          }, 8500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [me?.id]);

  if (!toast) return null;

  return (
    <aside
      className="pm-toast-card"
      role="alert"
      aria-live="polite"
      dir="rtl"
    >
      <button
        type="button"
        aria-label="إغلاق التنبيه"
        onClick={() => setToast(null)}
        className="pm-toast-close"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <div className="pm-toast-header">
        <span className="pm-toast-kicker">
          <MessageCircle className="h-3 w-3 inline-block ml-1 text-[var(--tos-aqua)]" />
          رسالة خاصة جديدة
        </span>
      </div>

      <div className="pm-toast-body">
        <CaptainAvatar
          seed={toast.sender.avatar_index ?? 0}
          url={toast.sender.avatar_url}
          className="pm-toast-avatar"
        />
        <div className="pm-toast-content">
          <strong className="pm-toast-sender">{toast.sender.name}</strong>
          <p className="pm-toast-text">{toast.body}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          const peer = toast.sender;
          setToast(null);
          onOpenChat(peer);
        }}
        className="tos-btn pm-toast-action"
      >
        فتح المحادثة
      </button>
    </aside>
  );
}
