// Stillfire Sauna Co. — talks to Stripe on behalf of the database and the owner dashboard.
// Actions: create_payment, expire_links, deposit_hold, deposit_release, deposit_capture.
// Callers: the database (x-stillfire-key header) or a signed-in admin (Authorization header).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { cents, db, msg, stripe, stripeKey } from "../_shared/stripe.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
const fmt = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const pct = (n: unknown) => String(Number(n));

async function allowed(req: Request, sb: ReturnType<typeof db>) {
  const key = req.headers.get("x-stillfire-key");
  if (key) {
    const { data } = await sb.rpc("internal_auth", { p_secret: key });
    return data === true;
  }
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const user = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } }, auth: { persistSession: false },
  });
  const { data } = await user.rpc("am_i_admin");
  return data === true;
}

async function expire(id?: string | null) {
  if (!id || !stripeKey()) return;
  try { await stripe("POST", `checkout/sessions/${id}/expire`); } catch (_) { /* already paid or expired */ }
}

async function createPayment(sb: ReturnType<typeof db>, b: any, a: any, site: string) {
  if (b.status !== "approved" || b.payment_status !== "unpaid" || b.pay_links_at) return { skipped: true };
  const done = (patch: Record<string, unknown>) =>
    sb.from("bookings").update({ ...patch, pay_links_at: new Date().toISOString() }).eq("id", b.id).is("pay_links_at", null);
  if (!stripeKey()) { await done({ pay_error: "Stripe is not connected yet, so no payment links were made." }); return { links: 0 }; }
  if (!(Number(a.subtotal) > 0)) { await done({ pay_error: "No total was entered, so no payment links were made." }); return { links: 0 }; }

  const patch: Record<string, unknown> = {};
  const errors: string[] = [];
  try {
    let customer = b.stripe_customer_id;
    if (!customer) {
      customer = (await stripe("POST", "customers", { email: b.email, name: b.customer_name, phone: b.phone, metadata: { booking_ref: b.ref } }, `cus-${b.id}`)).id;
      patch.stripe_customer_id = customer;
    }
    const now = Math.floor(Date.now() / 1000);
    const deadline = Math.floor(new Date(b.pay_deadline).getTime() / 1000);
    const expires_at = Math.max(now + 31 * 60, Math.min(deadline, now + 24 * 3600 - 120));
    const item = (name: string, amount: unknown) => ({ quantity: 1, price_data: { currency: "usd", unit_amount: cents(amount), product_data: { name } } });
    const rental = item(`Sauna rental, ${fmt(b.delivery_date)} to ${fmt(b.pickup_date)} (booking ${b.ref})`, a.subtotal);
    const base = (kind: string) => ({
      mode: "payment", customer, expires_at,
      success_url: `${site}/#paid`, cancel_url: `${site}/`,
      invoice_creation: { enabled: true, invoice_data: { description: `Stillfire Sauna Co. booking ${b.ref}`, metadata: { booking_id: b.id } } },
      metadata: { booking_id: b.id, kind },
      payment_intent_data: { metadata: { booking_id: b.id, kind }, description: `Stillfire booking ${b.ref}` },
    });
    const stamp = String(deadline);

    const cardParams = (types: string[]) => {
      const p: any = base("card");
      p.allowed_payment_method_types = types;
      p.payment_intent_data.setup_future_usage = "off_session";
      p.line_items = [rental, item(`Card processing fee (${pct(a.fee_percent)}%)`, a.card_fee), item(`Minnesota sales tax (${pct(a.tax_percent)}%)`, a.card_tax)];
      return p;
    };
    try {
      // Stripe drops any type here that is not switched on in the account, so Cash App is optional.
      const s = await stripe("POST", "checkout/sessions", cardParams(["card", "cashapp"]), `card3-${b.id}-${stamp}`);
      patch.card_url = s.url; patch.card_session_id = s.id;
    } catch (e) { errors.push("Card link: " + msg(e)); }

    try {
      const p: any = base("bank");
      p.allowed_payment_method_types = ["us_bank_account"];
      p.line_items = [rental, item(`Minnesota sales tax (${pct(a.tax_percent)}%)`, a.tax)];
      const s = await stripe("POST", "checkout/sessions", p, `bank3-${b.id}-${stamp}`);
      patch.bank_url = s.url; patch.bank_session_id = s.id;
    } catch (_) { /* bank transfer not switched on in Stripe: the email simply omits it */ }
  } catch (e) { errors.push(msg(e)); }

  if (errors.length) patch.pay_error = errors.join(" ");
  await done(patch);
  return { links: (patch.card_url ? 1 : 0) + (patch.bank_url ? 1 : 0), error: patch.pay_error ?? null };
}

async function depositHold(sb: ReturnType<typeof db>, b: any, a: any) {
  if (b.payment_status !== "paid" || !["pending", "failed"].includes(b.deposit_status)) return { skipped: true };
  const fail = async (note: string) => { await sb.from("bookings").update({ deposit_status: "failed", deposit_note: note }).eq("id", b.id); return { held: false, note }; };
  if (!b.stripe_customer_id || !b.stripe_payment_method_id) return await fail("No card on file.");
  try {
    const pi = await stripe("POST", "payment_intents", {
      amount: cents(a.deposit), currency: "usd", customer: b.stripe_customer_id, payment_method: b.stripe_payment_method_id,
      capture_method: "manual", off_session: true, confirm: true,
      description: `Stillfire damage deposit hold, booking ${b.ref}`, metadata: { booking_id: b.id, kind: "deposit" },
    }, `dep-${b.id}-${b.deposit_status}-${new Date().toISOString().slice(0, 10)}`);
    if (pi.status !== "requires_capture") return await fail(`The card did not authorize the hold (${pi.status}).`);
    await sb.from("bookings").update({ deposit_status: "held", deposit_pi_id: pi.id, deposit_note: null }).eq("id", b.id);
    return { held: true };
  } catch (e) { return await fail(msg(e)); }
}

async function depositRelease(sb: ReturnType<typeof db>, b: any) {
  if (b.deposit_status !== "held" || !b.deposit_pi_id) return { error: "There is no hold to release." };
  // Mark released first so the webhook for the cancelled hold does not report it as lapsed.
  await sb.from("bookings").update({ deposit_status: "released" }).eq("id", b.id);
  try { await stripe("POST", `payment_intents/${b.deposit_pi_id}/cancel`); return { released: true }; }
  catch (e) {
    const pi = await stripe("GET", `payment_intents/${b.deposit_pi_id}`).catch(() => null);
    if (pi?.status === "canceled") return { released: true };
    await sb.from("bookings").update({ deposit_status: "held" }).eq("id", b.id);
    return { error: msg(e) };
  }
}

async function depositCapture(sb: ReturnType<typeof db>, b: any, a: any, amount: unknown, note: unknown) {
  if (b.deposit_status !== "held" || !b.deposit_pi_id) return { error: "There is no hold to charge." };
  const amt = Number(amount);
  if (!(amt > 0) || amt > Number(a.deposit)) return { error: `Enter an amount between $0.01 and $${Number(a.deposit).toFixed(2)}.` };
  const why = String(note ?? "").trim().slice(0, 300);
  if (!why) return { error: "Add a short reason. The customer sees it." };
  try {
    await stripe("POST", `payment_intents/${b.deposit_pi_id}/capture`, { amount_to_capture: cents(amt) }, `cap-${b.id}`);
    await sb.from("bookings").update({ deposit_status: "captured", deposit_captured: amt, deposit_note: why }).eq("id", b.id);
    return { captured: amt };
  } catch (e) { return { error: msg(e) }; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const sb = db();
  if (!(await allowed(req, sb))) return json({ error: "forbidden" }, 403);
  const body = await req.json().catch(() => ({}));
  const { data: ctx, error } = await sb.rpc("pay_context", { p_booking: body.booking_id });
  if (error || !ctx) return json({ error: "Booking not found" }, 404);
  const b = ctx.booking, a = ctx.amounts, site = String(ctx.site_url).replace(/\/+$/, "");
  try {
    switch (body.action) {
      case "create_payment": return json(await createPayment(sb, b, a, site));
      case "expire_links": await expire(b.card_session_id); await expire(b.bank_session_id); return json({ ok: true });
      case "deposit_hold": return json(await depositHold(sb, b, a));
      case "deposit_release": return json(await depositRelease(sb, b));
      case "deposit_capture": return json(await depositCapture(sb, b, a, body.amount, body.note));
      default: return json({ error: "Unknown action" }, 400);
    }
  } catch (e) { return json({ error: msg(e) }, 500); }
});
