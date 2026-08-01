import { useEffect, useRef } from "react";
import EmptyState from "@/components/EmptyState";
import { AlertCircle, Check, CheckCheck, MessageSquare, Send } from "lucide-react";
import { formatMessageTime } from "@/lib/messagesService";

export default function ChatWindow({
  conversation,
  messages,
  draft,
  onDraftChange,
  onSend,
  sending,
  threadLoading,
  error,
}) {
  const bottomRef = useRef(null);
  const scrollerRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, conversation?.id]);

  if (!conversation && !threadLoading && !error) {
    return (
      <section className="flex flex-col min-h-[50vh]">
        <div className="flex-1 grid place-items-center p-8">
          <EmptyState
            title="Select a conversation"
            description="Choose a thread from the inbox to start chatting."
            icon={MessageSquare}
          />
        </div>
      </section>
    );
  }

  if (error && !conversation) {
    return (
      <section className="flex flex-col min-h-[50vh]">
        <div className="flex-1 grid place-items-center p-8" data-testid="chat-error">
          <EmptyState
            title="Conversation unavailable"
            description={error}
            icon={AlertCircle}
          />
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col min-h-[50vh]">
      {conversation && (
        <header className="px-5 py-4 border-b skl-border flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-black text-white grid place-items-center font-display font-semibold text-sm">
            {conversation.participant_letter}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{conversation.participant_name}</div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold truncate">
              {conversation.participant_role} · {conversation.job_title}
            </div>
          </div>
        </header>
      )}

      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto p-5 space-y-3 bg-white"
        data-testid="chat-thread"
      >
        {error && (
          <div
            className="text-sm border skl-border rounded-xl px-3 py-2 bg-neutral-50 text-neutral-700"
            data-testid="chat-thread-error"
          >
            {error}
          </div>
        )}

        {threadLoading && messages.length === 0 ? (
          <div className="text-sm text-neutral-500">Loading messages…</div>
        ) : messages.length === 0 ? (
          <div className="h-full min-h-[200px] grid place-items-center">
            <EmptyState
              title="No messages yet"
              description="Say hello to start the conversation."
              icon={MessageSquare}
              compact
            />
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.mine;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"} ${
                  m.pending ? "opacity-70" : ""
                }`}
                data-testid={`message-${m.id}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    mine
                      ? "bg-black text-white rounded-br-md"
                      : "border skl-border bg-neutral-50 rounded-bl-md"
                  }`}
                >
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                  <div
                    className={`mt-1 flex items-center gap-1.5 text-[10px] ${
                      mine ? "text-neutral-400 justify-end" : "text-neutral-400"
                    }`}
                  >
                    <span>{formatMessageTime(m.created_at)}</span>
                    {mine && !m.pending && (
                      <span
                        className="inline-flex items-center"
                        title={m.read ? "Read" : "Sent"}
                        data-testid={`read-status-${m.id}`}
                      >
                        {m.read ? <CheckCheck size={12} /> : <Check size={12} />}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={onSend}
        className="p-4 border-t skl-border flex items-center gap-2"
        data-testid="chat-composer"
      >
        <input
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border skl-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-black"
          data-testid="chat-input"
          disabled={sending || !conversation}
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending || !conversation}
          className="h-10 w-10 rounded-full bg-black text-white grid place-items-center hover:bg-black/90 disabled:opacity-50"
          aria-label="Send"
          data-testid="chat-send"
        >
          <Send size={14} />
        </button>
      </form>
    </section>
  );
}
