import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import ConversationList from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import {
  fetchConversations,
  fetchMessages,
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
  const activeIdRef = useRef(activeId);
  const queryRef = useRef(query);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const refreshList = useCallback(async () => {
    try {
      const list = await fetchConversations(queryRef.current);
      setConversations(list);
    } catch (e) {
      toast.error(e?.message || "Failed to load conversations");
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
  }, [user?.id, query, refreshList]);

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
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          query={query}
          onQueryChange={setQuery}
          onSelect={setActiveId}
          loading={loading}
          emptyDescription={emptyDescription}
        />
        <ChatWindow
          conversation={active}
          messages={messages}
          draft={draft}
          onDraftChange={setDraft}
          onSend={onSend}
          sending={sending}
          threadLoading={threadLoading}
        />
      </div>
    </DashboardShell>
  );
}
