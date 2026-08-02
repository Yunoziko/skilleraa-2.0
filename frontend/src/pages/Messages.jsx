import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardShell from "@/components/layout/DashboardShell";
import ConversationList from "@/components/chat/ConversationList";
import ChatWindow from "@/components/chat/ChatWindow";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { subscribeApplications } from "@/lib/applicationsService";
import {
  applyRealtimeToConversations,
  fetchConversations,
  fetchMessages,
  mapMessageRow,
  markConversationRead,
  resolveConversationAccess,
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
  const [listError, setListError] = useState("");
  const [threadError, setThreadError] = useState("");
  const [sending, setSending] = useState(false);
  const [threadLoading, setThreadLoading] = useState(false);

  const activeIdRef = useRef(activeId);
  const queryRef = useRef(query);
  const uidRef = useRef(user?.id || "");
  const loadSeqRef = useRef(0);
  const threadSeqRef = useRef(0);

  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    uidRef.current = user?.id || "";
  }, [user?.id]);

  const active = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const refreshList = useCallback(async () => {
    const seq = ++loadSeqRef.current;
    try {
      const list = await fetchConversations(queryRef.current);
      if (seq !== loadSeqRef.current) return;
      setConversations(list);
      setListError("");
      return list;
    } catch (e) {
      if (seq !== loadSeqRef.current) return;
      const msg = e?.message || "Failed to load conversations";
      setListError(msg);
      setConversations([]);
      toast.error(msg);
      return [];
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  }, []);

  const openThread = useCallback(async (id) => {
    if (!id) {
      setMessages([]);
      setThreadError("");
      return;
    }

    const seq = ++threadSeqRef.current;
    setThreadLoading(true);
    setThreadError("");

    try {
      const access = await resolveConversationAccess(id);
      if (seq !== threadSeqRef.current) return;

      if (!access) {
        setMessages([]);
        setThreadError("Chat unlocks after the application is accepted.");
        setActiveId("");
        setParams({}, { replace: true });
        toast.error("Chat is only available for accepted applications");
        return;
      }

      const list = await fetchMessages(id);
      if (seq !== threadSeqRef.current) return;
      setMessages(list);

      await markConversationRead(id);
      if (seq !== threadSeqRef.current) return;

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
    } catch (e) {
      if (seq !== threadSeqRef.current) return;
      const msg = e?.message || "Failed to load messages";
      setThreadError(msg);
      setMessages([]);
      toast.error(msg);
    } finally {
      if (seq === threadSeqRef.current) setThreadLoading(false);
    }
  }, [setParams]);

  // Initial + search refresh
  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    refreshList();
  }, [user?.id, query, refreshList]);

  // Shared realtime: messages + application accept/reject (unlocks chat)
  useEffect(() => {
    if (!user?.id) return undefined;

    const unsubMessages = subscribeMessages((payload) => {
      const event = payload?.eventType || payload?.event;
      const row = payload?.new;
      const uid = uidRef.current;
      if (!row || !uid) return;

      setConversations((prev) => applyRealtimeToConversations(prev, payload, uid));

      const openId = activeIdRef.current;
      if (!openId || row.application_id !== openId) return;

      if (event === "INSERT") {
        const mapped = mapMessageRow(row, uid);
        setMessages((prev) => {
          if (prev.some((m) => m.id === mapped.id)) return prev;
          return [...prev, mapped];
        });
        if (row.receiver_id === uid && !row.read_at) {
          markConversationRead(openId)
            .then(() => {
              setConversations((prev) =>
                prev.map((c) => (c.id === openId ? { ...c, unread: 0 } : c))
              );
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === mapped.id
                    ? { ...m, read_at: m.read_at || new Date().toISOString(), read: true }
                    : m
                )
              );
            })
            .catch(() => {});
        }
      } else if (event === "UPDATE") {
        setMessages((prev) =>
          prev.map((m) => (m.id === row.id ? mapMessageRow(row, uid) : m))
        );
      }
    });

    const unsubApps = subscribeApplications((payload) => {
      const row = payload?.new;
      const event = payload?.eventType || payload?.event;
      if (event !== "UPDATE" && event !== "INSERT") return;
      // Accept unlocks a conversation; reject removes it from inbox
      refreshList().then((list) => {
        const openId = activeIdRef.current;
        if (!openId) return;
        const stillAllowed = (list || []).some((c) => c.id === openId);
        if (!stillAllowed) {
          setActiveId("");
          setMessages([]);
          setThreadError(
            row?.status === "rejected"
              ? "This application was rejected. Chat is unavailable."
              : "Chat unlocks after the application is accepted."
          );
        } else if (row?.id === openId && String(row.status).toLowerCase() === "accepted") {
          openThread(openId);
        }
      });
    });

    return () => {
      unsubMessages();
      unsubApps();
    };
  }, [user?.id, refreshList, openThread]);

  // Sync active id from URL
  useEffect(() => {
    const fromUrl = params.get("c");
    if (fromUrl && fromUrl !== activeId) setActiveId(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  // After list loads: validate / select conversation
  useEffect(() => {
    if (loading) return;

    if (activeId) {
      const allowed = conversations.some((c) => c.id === activeId);
      if (!allowed && conversations.length > 0) {
        // Deep-link may still be valid but filtered by search — verify access separately
        if (query.trim()) return;
        resolveConversationAccess(activeId).then((access) => {
          if (!access) {
            setActiveId(conversations[0]?.id || "");
            toast.error("Unauthorized conversation");
          }
        });
      }
      return;
    }

    if (conversations[0]) setActiveId(conversations[0].id);
  }, [loading, conversations, activeId, query]);

  // Open thread when active conversation changes
  useEffect(() => {
    if (!user?.id || !activeId) {
      setMessages([]);
      return;
    }
    setParams({ c: activeId }, { replace: true });
    openThread(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, user?.id]);

  const onSend = async (e) => {
    e.preventDefault();
    if (!activeId || !draft.trim() || sending) return;
    const text = draft.trim();
    setSending(true);
    setDraft("");

    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      application_id: activeId,
      conversation_id: activeId,
      sender_id: user.id,
      receiver_id: active?.participant_id,
      text,
      message: text,
      created_at: new Date().toISOString(),
      read_at: null,
      mine: true,
      read: false,
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setConversations((prev) => {
      const idx = prev.findIndex((c) => c.id === activeId);
      if (idx === -1) return prev;
      const next = prev.slice();
      const current = {
        ...next[idx],
        preview: text,
        updated_at: optimistic.created_at,
        has_messages: true,
      };
      next.splice(idx, 1);
      next.unshift(current);
      return next;
    });

    try {
      const msg = await sendChatMessage(activeId, text);
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        if (withoutTemp.some((m) => m.id === msg.id)) return withoutTemp;
        return [...withoutTemp, msg];
      });
      setThreadError("");
    } catch (err) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraft(text);
      const msg = err?.message || "Failed to send";
      setThreadError(msg);
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const emptyDescription =
    user?.role === "client"
      ? "Accept an applicant to unlock chat with them here."
      : "Chat unlocks here after a client accepts your application.";

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
          error={listError}
          onRetry={() => {
            setLoading(true);
            refreshList();
          }}
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
          error={threadError}
        />
      </div>
    </DashboardShell>
  );
}
