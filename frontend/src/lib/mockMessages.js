/**
 * Local messaging store (auth/backend paused).
 */

const KEY = "skl_mock_messages";
const EVENT = "skl-messages-changed";

const SEED = {
  conversations: [
    {
      id: "c1",
      participant_name: "Northstar Labs",
      participant_letter: "N",
      participant_role: "client",
      preview: "Can you share a Figma link when ready?",
      updated_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      unread: 1,
    },
    {
      id: "c2",
      participant_name: "Learnly",
      participant_letter: "L",
      participant_role: "client",
      preview: "Thanks — we'll review by Friday.",
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      unread: 0,
    },
    {
      id: "c3",
      participant_name: "Aarav Sharma",
      participant_letter: "A",
      participant_role: "student",
      preview: "Happy to start next week if that works.",
      updated_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      unread: 2,
    },
  ],
  messages: {
    c1: [
      {
        id: "m1",
        conversation_id: "c1",
        sender: "them",
        text: "Hi! We liked your application for the brand identity brief.",
        created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      },
      {
        id: "m2",
        conversation_id: "c1",
        sender: "me",
        text: "Thank you — I can deliver a first moodboard in 3 days.",
        created_at: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
      },
      {
        id: "m3",
        conversation_id: "c1",
        sender: "them",
        text: "Can you share a Figma link when ready?",
        created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
      },
    ],
    c2: [
      {
        id: "m4",
        conversation_id: "c2",
        sender: "me",
        text: "Sharing the React landing page repo shortly.",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
      },
      {
        id: "m5",
        conversation_id: "c2",
        sender: "them",
        text: "Thanks — we'll review by Friday.",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      },
    ],
    c3: [
      {
        id: "m6",
        conversation_id: "c3",
        sender: "them",
        text: "Available for the Instagram campaign next month?",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      },
      {
        id: "m7",
        conversation_id: "c3",
        sender: "me",
        text: "Yes — send the brief and brand assets when you can.",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 32).toISOString(),
      },
      {
        id: "m8",
        conversation_id: "c3",
        sender: "them",
        text: "Happy to start next week if that works.",
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
      },
    ],
  },
};

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeAll(data) {
  localStorage.setItem(KEY, JSON.stringify(data));
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(EVENT));
  }
}

function ensureSeeded() {
  const existing = readRaw();
  if (existing?.conversations?.length) return existing;
  const seed = JSON.parse(JSON.stringify(SEED));
  writeAll(seed);
  return seed;
}

export function subscribeMessages(callback) {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => callback();
  const onStorage = (e) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener(EVENT, onCustom);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onCustom);
    window.removeEventListener("storage", onStorage);
  };
}

export function listConversations(query = "") {
  const data = ensureSeeded();
  const q = query.trim().toLowerCase();
  let list = [...data.conversations].sort(
    (a, b) => new Date(b.updated_at) - new Date(a.updated_at),
  );
  if (q) {
    list = list.filter(
      (c) =>
        c.participant_name.toLowerCase().includes(q) ||
        (c.preview || "").toLowerCase().includes(q),
    );
  }
  return list;
}

export function getConversation(id) {
  return ensureSeeded().conversations.find((c) => c.id === id) || null;
}

export function listMessages(conversationId) {
  const data = ensureSeeded();
  const msgs = data.messages[conversationId] || [];
  return [...msgs].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export function markConversationRead(conversationId) {
  const data = ensureSeeded();
  data.conversations = data.conversations.map((c) =>
    c.id === conversationId ? { ...c, unread: 0 } : c,
  );
  writeAll(data);
  return data.conversations.find((c) => c.id === conversationId);
}

export function sendMessage(conversationId, text) {
  const trimmed = (text || "").trim();
  if (!trimmed) throw new Error("Message cannot be empty");
  const data = ensureSeeded();
  if (!data.messages[conversationId]) data.messages[conversationId] = [];
  const msg = {
    id: `m-${Date.now()}`,
    conversation_id: conversationId,
    sender: "me",
    text: trimmed,
    created_at: new Date().toISOString(),
  };
  data.messages[conversationId].push(msg);
  data.conversations = data.conversations.map((c) =>
    c.id === conversationId
      ? { ...c, preview: trimmed, updated_at: msg.created_at, unread: 0 }
      : c,
  );
  writeAll(data);
  return msg;
}

export function formatMessageTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const sameDay = new Date().toDateString() === d.toDateString();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return time;
  return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} · ${time}`;
}

export function totalUnreadMessages() {
  return listConversations("").reduce((sum, c) => sum + (c.unread || 0), 0);
}
