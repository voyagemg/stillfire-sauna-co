// Small Stripe helper shared by stripe-ops and stripe-webhook. Uses the REST API directly.
import { createClient } from "jsr:@supabase/supabase-js@2";

export const db = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function flatten(v: unknown, key: string, out: [string, string][]) {
  if (v === null || v === undefined) return;
  if (Array.isArray(v)) v.forEach((x, i) => flatten(x, `${key}[${i}]`, out));
  else if (typeof v === "object") for (const [k, x] of Object.entries(v as Record<string, unknown>)) flatten(x, key ? `${key}[${k}]` : k, out);
  else out.push([key, String(v)]);
}

export const stripeKey = () => Deno.env.get("STRIPE_SECRET_KEY") ?? "";

export async function stripe(method: "GET" | "POST", path: string, params?: Record<string, unknown>, idem?: string) {
  const pairs: [string, string][] = [];
  if (params) flatten(params, "", pairs);
  const qs = new URLSearchParams(pairs).toString();
  const res = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && qs ? "?" + qs : ""}`, {
    method,
    headers: {
      Authorization: `Bearer ${stripeKey()}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idem ? { "Idempotency-Key": idem } : {}),
    },
    body: method === "POST" ? qs : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error?.message ?? `Stripe ${res.status}`);
  return json;
}

export const cents = (n: unknown) => Math.round(Number(n ?? 0) * 100);
export const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 400);
