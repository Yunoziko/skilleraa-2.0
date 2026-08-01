/**
 * Supabase real-time messaging scoped to applications.
 * One shared Realtime channel for the whole app (ref-counted).
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchClientApplications,
  fetchMyApplications,
  isChatEnabled,
} from "@/lib/applicationsService";

const MESSAGE_COLUMNS =
  "id, application_id, sender_id, receiver_id, message, created_at, read_at";

/** @type {Set<(payload: object) => void>} */
const realtimeListeners = new Set();
/** @type {import('@supabase/supabase-js').RealtimeChannel | null} */
let sharedChannel = null;
let sharedChannelRefCount = 0;

function assertClient() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

async function currentUserId() {
  const client = assertClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const uid = data?.user?.id;
  if (!uid) throw new Error("You must be signed in.");
  return uid;
}

export function formatMessageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function mapMessageRow(row, uid) {
  if (!row) return null;
  return {
    id: row.id,
    application_id: row.application_id,
    conversation_id: row.application_id,
    sender_id: row.sender_id,
    receiver_id: row.receiver_id,
    text: row.message || "",
    message: row.message || "",
    created_at: row.created_at,
    read_at: row.read_at || null,
    mine: row.sender_id === uid,
    read: Boolean(row.read_at),
  };
}

function participantFromApplication(app, uid) {
  const clientId = app.job?.client_id;
  const freelancerId = app.freelancer_id;
  if (freelancerId === uid) {
    const name = app.job?.company_name || "Client";
    return {
      id: clientId,
      name,
      letter: (name || "C").charAt(0).toUpperCase(),
      role: "client",
    };
  }
  const name = app.student?.name || "Freelancer";
  return {
    id: freelancerId,
    name,
    letter: app.student?.avatar_letter || (name || "F").charAt(0).toUpperCase(),
    role: "student",
  };
}

function isParticipant(app, uid) {
  if (!app || !uid) return false;
  const clientId = app.job?.client_id;
  return app.freelancer_id === uid || clientId === uid;
}

/** Accepted applications the current user may chat on (RLS-scoped). */
export async function fetchChatApplications() {
  const uid = await currentUserId();
  const client = assertClient();
  const { data: profile, error } = await client
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;

  const role = profile?.role;
  const all =
    role === "client" ? await fetchClientApplications() : await fetchMyApplications();
  const apps = (all || []).filter((a) => isChatEnabled(a.status));
  return { uid, role, apps };
}

/**
 * Resolve a conversation the user is allowed to access.
 * Requires accepted application + participant membership.
 */
export async function resolveConversationAccess(applicationId) {
  if (!applicationId) return null;
  const { uid, apps } = await fetchChatApplications();
  const app = apps.find((a) => a.id === applicationId);
  if (!app || !isChatEnabled(app.status) || !isParticipant(app, uid)) return null;
  const participant = participantFromApplication(app, uid);
  return {
    uid,
    app,
    conversation: {
      id: app.id,
      application_id: app.id,
      application_status: app.status,
      job_title: app.job?.title || "Application",
      participant_id: participant.id,
      participant_name: participant.name,
      participant_letter: participant.letter,
      participant_role: participant.role,
      preview: "No messages yet — say hello",
      updated_at: app.created_at,
      unread: 0,
      has_messages: false,
    },
  };
}

/**
 * Conversation list: one thread per application.
 * Loads only latest-message metadata + unread rows (not full history).
 */
export async function fetchConversations(searchQuery = "") {
  const { uid, apps } = await fetchChatApplications();
  if (!apps.length) return [];

  const client = assertClient();
  const ids = apps.map((a) => a.id);

  const [latestRes, unreadRes] = await Promise.all([
    client.rpc("latest_messages_for_applications", { app_ids: ids }),
    client
      .from("messages")
      .select("application_id")
      .in("application_id", ids)
      .eq("receiver_id", uid)
      .is("read_at", null),
  ]);

  if (latestRes.error) throw latestRes.error;
  if (unreadRes.error) throw unreadRes.error;

  const latestByApp = new Map();
  for (const row of latestRes.data || []) {
    latestByApp.set(row.application_id, row);
  }

  const unreadByApp = new Map();
  for (const row of unreadRes.data || []) {
    unreadByApp.set(row.application_id, (unreadByApp.get(row.application_id) || 0) + 1);
  }

  const q = String(searchQuery || "").trim().toLowerCase();

  return apps
    .map((app) => {
      const last = latestByApp.get(app.id) || null;
      const participant = participantFromApplication(app, uid);
      const jobTitle = app.job?.title || "Application";
      return {
        id: app.id,
        application_id: app.id,
        application_status: app.status,
        job_title: jobTitle,
        participant_id: participant.id,
        participant_name: participant.name,
        participant_letter: participant.letter,
        participant_role: participant.role,
        preview: last?.message || "No messages yet — say hello",
        updated_at: last?.created_at || app.created_at,
        unread: unreadByApp.get(app.id) || 0,
        has_messages: Boolean(last),
      };
    })
    .filter((c) => {
      if (!q) return true;
      return (
        c.participant_name.toLowerCase().includes(q) ||
        c.job_title.toLowerCase().includes(q) ||
        c.preview.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
}

/** Thread messages — only if caller is a participant (RLS + explicit guard). */
export async function fetchMessages(applicationId) {
  const access = await resolveConversationAccess(applicationId);
  if (!access) {
    throw new Error("You do not have access to this conversation.");
  }

  const client = assertClient();
  const { data, error } = await client
    .from("messages")
    .select(MESSAGE_COLUMNS)
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => mapMessageRow(row, access.uid));
}

export async function sendChatMessage(applicationId, text) {
  const uid = await currentUserId();
  const body = String(text || "").trim();
  if (!body) throw new Error("Message cannot be empty.");
  if (!applicationId) throw new Error("Missing conversation.");

  const client = assertClient();
  const { data: app, error: appError } = await client
    .from("applications")
    .select(
      `
      id,
      freelancer_id,
      status,
      jobs!applications_job_id_fkey (
        id,
        client_id
      )
    `
    )
    .eq("id", applicationId)
    .maybeSingle();

  if (appError) throw appError;
  if (!app) throw new Error("You can only chat on your applications.");
  if (!isChatEnabled(app.status)) {
    throw new Error("Chat unlocks after the application is accepted.");
  }

  const clientId = app.jobs?.client_id;
  const freelancerId = app.freelancer_id;
  let receiverId = null;
  if (uid === freelancerId) receiverId = clientId;
  else if (uid === clientId) receiverId = freelancerId;
  if (!receiverId) {
    throw new Error("You do not have access to this conversation.");
  }

  const { data, error } = await client
    .from("messages")
    .insert({
      application_id: applicationId,
      sender_id: uid,
      receiver_id: receiverId,
      message: body,
    })
    .select(MESSAGE_COLUMNS)
    .single();

  if (error) throw error;
  return mapMessageRow(data, uid);
}

/** Mark inbound unread messages in a thread as read. */
export async function markConversationRead(applicationId) {
  const uid = await currentUserId();
  const client = assertClient();
  const { error } = await client
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("application_id", applicationId)
    .eq("receiver_id", uid)
    .is("read_at", null);

  if (error) throw error;
}

export async function totalUnreadMessages() {
  const uid = await currentUserId();
  const client = assertClient();
  const { count, error } = await client
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("receiver_id", uid)
    .is("read_at", null);
  if (error) throw error;
  return count || 0;
}

/**
 * Shared Realtime subscription (single channel, many listeners).
 * RLS filters events to sender/receiver only.
 */
export function subscribeMessages(onChange) {
  if (!supabase || !isSupabaseConfigured) return () => {};
  if (typeof onChange !== "function") return () => {};

  realtimeListeners.add(onChange);
  sharedChannelRefCount += 1;

  if (!sharedChannel) {
    sharedChannel = supabase
      .channel("skl-messages-shared")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        (payload) => {
          realtimeListeners.forEach((fn) => {
            try {
              fn(payload);
            } catch {
              // ignore listener errors
            }
          });
        }
      )
      .subscribe();
  }

  return () => {
    realtimeListeners.delete(onChange);
    sharedChannelRefCount = Math.max(0, sharedChannelRefCount - 1);
    if (sharedChannelRefCount === 0 && sharedChannel) {
      supabase.removeChannel(sharedChannel);
      sharedChannel = null;
    }
  };
}

/** Apply a realtime payload onto a conversation list (immutable). */
export function applyRealtimeToConversations(conversations, payload, uid) {
  const event = payload?.eventType || payload?.event;
  const row = payload?.new;
  if (!row?.application_id || !Array.isArray(conversations)) return conversations;

  const idx = conversations.findIndex((c) => c.id === row.application_id);
  if (idx === -1) return conversations;

  const next = conversations.slice();
  const current = { ...next[idx] };

  if (event === "INSERT") {
    current.preview = row.message || current.preview;
    current.updated_at = row.created_at || current.updated_at;
    current.has_messages = true;
    if (row.receiver_id === uid && !row.read_at) {
      current.unread = (current.unread || 0) + 1;
    }
  } else if (event === "UPDATE" && row.read_at && row.receiver_id === uid) {
    current.unread = Math.max(0, (current.unread || 1) - 1);
  }

  next.splice(idx, 1);
  next.unshift(current);
  return next;
}
