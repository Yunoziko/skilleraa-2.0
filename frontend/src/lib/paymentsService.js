/**
 * Razorpay checkout + payment status helpers.
 */

import api from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

function assertSupabase() {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }
  return supabase;
}

export function formatINR(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export async function fetchPaymentForApplication(applicationId) {
  if (!applicationId) return null;
  try {
    const { data } = await api.get(`/payments/by-application/${applicationId}`);
    return data?.payment || null;
  } catch {
    // Fallback: direct Supabase read (RLS)
    const client = assertSupabase();
    const { data, error } = await client
      .from("payments")
      .select("id, application_id, amount, currency, status, created_at, razorpay_order_id")
      .eq("application_id", applicationId)
      .maybeSingle();
    if (error) throw error;
    return data;
  }
}

export async function fetchPaymentsForApplications(applicationIds) {
  const ids = (applicationIds || []).filter(Boolean);
  if (!ids.length) return {};
  const client = assertSupabase();
  const { data, error } = await client
    .from("payments")
    .select("id, application_id, amount, currency, status, created_at")
    .in("application_id", ids);
  if (error) throw error;
  const map = {};
  for (const row of data || []) {
    map[row.application_id] = row;
  }
  return map;
}

function loadRazorpayScript() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Razorpay requires a browser"));
  }
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector("script[data-razorpay]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay));
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "1";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => reject(new Error("Failed to load Razorpay checkout"));
    document.body.appendChild(script);
  });
}

/**
 * Create order on backend and open Razorpay Checkout.
 * Resolves with verified payment payload on success.
 */
export async function payForApplication(applicationId) {
  const { data: order } = await api.post("/payments/create-order", {
    application_id: applicationId,
  });

  const Razorpay = await loadRazorpayScript();
  if (!Razorpay) throw new Error("Razorpay unavailable");

  return new Promise((resolve, reject) => {
    const options = {
      key: order.razorpay_key_id,
      amount: Math.round(Number(order.amount) * 100),
      currency: order.currency || "INR",
      name: "Skilleraa",
      description: order.job_title || "Application payment",
      order_id: order.razorpay_order_id,
      prefill: {
        name: order.prefill?.name || "",
        email: order.prefill?.email || "",
      },
      theme: { color: "#000000" },
      modal: {
        ondismiss: () => reject(new Error("Payment cancelled")),
      },
      handler: async (response) => {
        try {
          const { data } = await api.post("/payments/verify", {
            payment_id: order.payment_id,
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          resolve(data);
        } catch (err) {
          reject(err);
        }
      },
    };

    const rzp = new Razorpay(options);
    rzp.on("payment.failed", (resp) => {
      reject(new Error(resp?.error?.description || "Payment failed"));
    });
    rzp.open();
  });
}

export async function fetchMyWallet() {
  const client = assertSupabase();
  const { data: auth } = await client.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("You must be signed in.");

  let { data: wallet, error } = await client
    .from("wallets")
    .select("id, user_id, available_balance, pending_balance, lifetime_earnings, updated_at")
    .eq("user_id", uid)
    .maybeSingle();

  if (error) throw error;

  if (!wallet) {
    // Trigger may have missed older users — insert via upsert is blocked by RLS.
    // Return zeroed wallet shape for UI.
    wallet = {
      id: null,
      user_id: uid,
      available_balance: 0,
      pending_balance: 0,
      lifetime_earnings: 0,
      updated_at: null,
    };
  }

  let transactions = [];
  if (wallet.id) {
    const { data: tx, error: txError } = await client
      .from("wallet_transactions")
      .select("id, wallet_id, payment_id, amount, type, description, created_at")
      .eq("wallet_id", wallet.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (txError) throw txError;
    transactions = tx || [];
  }

  return { wallet, transactions };
}
