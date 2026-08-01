import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import EmptyState from "@/components/EmptyState";
import { ListRowSkeleton } from "@/components/Skeleton";
import { Check, CheckCheck, MessageSquare, Search, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  fetchConversations,
  fetchMessages,
  formatMessageTime,
  markConversationRead,
  sendChatMessage,
  subscribeMessages,
} from "@/lib/messagesService";

export default function Messages() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(params.get("c") || "");
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);
  const bottomRef = useRef(null);
  const activeIdRef = useRef(activeId);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const refreshList = useCallback(async () => {
    try {
      const list = await fetchConversations(query);
      setConversations(list);
    } catch (e) {
      toast.error(e?.message || "Failed to load conversations");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const refreshThread = useCallback(async (id, { markRead = true } = {}) => {
    if (!id) {
      setMessages([]);
      return;
    }
    setThreadLoading(true);
    try {
      const list = await fetchMessages(id);
      setMessages(list);
      if (markRead) {
        await markConversationRead(id);
        setConversations((prev) =>
          prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c))
        );
        setMessages((prev) =>
          prev.map((m) =>
            m.mine || m.read_at
              ? m
              : { ...m, read_at: m.read_at || new Date().toISOString(), read: true }
          )
        );
      }
    } catch (e) {
      toast.error(e?.message || "Failed to load messages");
      setMessages([]);
    } finally {
      setThreadLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    refreshList();
  }, [user?.id, refreshList]);

  useEffect(() => {
    if (!user?.id) return undefined;
    return subscribeMessages(() => {
      refreshList();
      if (activeIdRef.current) {
        refreshThread(activeIdRef.current, { markRead: true });
      }
    });
  }, [user?.id, refreshList, refreshThread]);

  useEffect(() => {
    const fromUrl = params.get("c");
    if (fromUrl) setActiveId(fromUrl);
  }, [params]);

  useEffect(() => {
    if (!activeId && conversations[0]) {
      setActiveId(conversations[0].id);
    }
  }, [conversations, activeId]);

  useEffect(() => {
    if (!activeId || !user?.id) return;
    refreshThread(activeId);
    setParams({ c: activeId }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeId]);

  const onSend = async (e) => {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    setDraft("");
    try {
      const msg = await sendChatMessage(activeId, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      await refreshList();
    } catch (err) {
      setDraft(text);
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const emptyDescription =
    user?.role === "client"
      ? "When freelancers apply to your jobs, you can message them here."
      : "Apply to a job to start a conversation with the client.";

  return (
    <DashboardShell title="Messages">
      <div
        className="border skl-border rounded-2xl overflow-hidden grid lg:grid-cols-[320px_1fr] min-h-[70vh]"
        data-testid="messages-layout"
      >
        <aside className="border-b lg:border-b-0 lg:border-r skl-border flex flex-col bg-white">
          <div className="p-4 border-b skl-border">
            <div className="flex items-center gap-2 border skl-border rounded-full px-3 py-2">
              <Search size={14} className="text-neutral-400" />
              <input
                id="messages-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search conversations…"
                aria-label="Search conversations"
                className="flex-1 bg-transparent text-sm focus:outline-none"
                data-testid="messages-search"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[40vh] lg:max-h-none">
            {loading ? (
              <div className="p-3">
                <ListRowSkeleton count={4} />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No conversations"
                  description={
                    query.trim()
                      ? "Search returned no matches."
                      : emptyDescription
                  }
                  icon={MessageSquare}
                />
              </div>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setActiveId(c.id)}
                  className={`w-full text-left px-4 py-3 border-b skl-border hover:bg-neutral-50 transition ${
                    c.id === activeId ? "bg-neutral-50" : ""
                  }`}
                  data-testid={`conversation-${c.id}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-black text-white grid place-items-center font-display font-semibold text-sm shrink-0">
                      {c.participant_letter}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium truncate">{c.participant_name}</div>
                        {c.unread > 0 && (
                          <span
                            className="text-[10px] font-semibold bg-black text-white rounded-full min-w-[18px] h-[18px] grid place-items-center px-1"
                            data-testid={`unread-${c.id}`}
                          >
                            {c.unread}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{c.job_title}</p>
                      <p className="text-xs text-neutral-500 truncate mt-0.5">{c.preview}</p>
                      <div className="text-[10px] text-neutral-400 mt-1">
                        {formatMessageTime(c.updated_at)}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        <section className="flex flex-col min-h-[50vh]">
          {!active ? (
            <div className="flex-1 grid place-items-center p-8">
              <EmptyState
                title="Select a conversation"
                description="Choose a thread from the inbox to start chatting."
                icon={MessageSquare}
              />
            </div>
          ) : (
            <>
              <header className="px-5 py-4 border-b skl-border flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-black text-white grid place-items-center font-display font-semibold text-sm">
                  {active.participant_letter}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{active.participant_name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-neutral-500 font-semibold truncate">
                    {active.participant_role} · {active.job_title}
                  </div>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto p-5 space-y-3 bg-white" data-testid="chat-thread">
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
                        className={`flex ${mine ? "justify-end" : "justify-start"}`}
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
                            {mine && (
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
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 border skl-border rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-black"
                  data-testid="chat-input"
                  disabled={sending}
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  className="h-10 w-10 rounded-full bg-black text-white grid place-items-center hover:bg-black/90 disabled:opacity-50"
                  aria-label="Send"
                  data-testid="chat-send"
                >
                  <Send size={14} />
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
