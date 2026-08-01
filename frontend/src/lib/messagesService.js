/**
 * Supabase real-time messaging (scoped to applications).
 */

import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  fetchClientApplications,
  fetchMyApplications,
} from "@/lib/applicationsService";

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

function mapMessageRow(row, uid) {
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
  const iAmFreelancer = freelancerId === uid;
  if (iAmFreelancer) {
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

/** Applications the current user can chat on (must exist). */
export async function fetchChatApplications() {
  const uid = await currentUserId();
  const client = assertClient();
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .maybeSingle();

  const role = profile?.role;
  const apps =
    role === "client" ? await fetchClientApplications() : await fetchMyApplications();
  return { uid, role, apps: apps || [] };
}

/**
 * Conversation list: one thread per application the user participates in.
 * Includes threads with no messages yet (empty chat ready to start).
 */
export async function fetchConversations(searchQuery = "") {
  const { uid, apps } = await fetchChatApplications();
  if (!apps.length) return [];

  const client = assertClient();
  const ids = apps.map((a) => a.id);
  const { data: rows, error } = await client
    .from("messages")
    .select("id, application_id, sender_id, receiver_id, message, created_at, read_at")
    .in("application_id", ids)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const byApp = new Map();
  for (const row of rows || []) {
    const list = byApp.get(row.application_id) || [];
    list.push(row);
    byApp.set(row.application_id, list);
  }

  const q = String(searchQuery || "").trim().toLowerCase();

  const conversations = apps
    .map((app) => {
      const msgs = byApp.get(app.id) || [];
      const last = msgs[msgs.length - 1] || null;
      const unread = msgs.filter((m) => m.receiver_id === uid && !m.read_at).length;
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
        unread,
        has_messages: msgs.length > 0,
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

  return conversations;
}

export async function fetchMessages(applicationId) {
  const uid = await currentUserId();
  const client = assertClient();
  const { data, error } = await client
    .from("messages")
    .select("id, application_id, sender_id, receiver_id, message, created_at, read_at")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data || []).map((row) => mapMessageRow(row, uid));
}

export async function sendChatMessage(applicationId, text) {
  const uid = await currentUserId();
  const body = String(text || "").trim();
  if (!body) throw new Error("Message cannot be empty.");

  const { apps } = await fetchChatApplications();
  const app = apps.find((a) => a.id === applicationId);
  if (!app) throw new Error("You can only chat on your applications.");

  const participant = participantFromApplication(app, uid);
  if (!participant.id) throw new Error("Could not resolve chat recipient.");

  const client = assertClient();
  const { data, error } = await client
    .from("messages")
    .insert({
      application_id: applicationId,
      sender_id: uid,
      receiver_id: participant.id,
      message: body,
    })
    .select("id, application_id, sender_id, receiver_id, message, created_at, read_at")
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
 * Subscribe to message changes for the signed-in user (RLS-filtered).
 * Returns an unsubscribe function.
 */
export function subscribeMessages(onChange) {
  if (!supabase || !isSupabaseConfigured) return () => {};

  const channel = supabase
    .channel(`skl-messages-${Date.now()}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "messages" },
      (payload) => {
        try {
          onChange?.(payload);
        } catch {
          // ignore subscriber errors
        }
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
