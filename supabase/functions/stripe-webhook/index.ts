// Stillfire Sauna Co. — receives Stripe events and marks bookings paid.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { db, msg, stripe } from "../_shared/stripe.ts";

const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");

async function verified(raw: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]).filter((x) => x[0] !== "v1"));
  const sigs = header.split(",").filter((kv) => kv.startsWith("v1=")).map((kv) => kv.slice(3));
  const t = Number(parts.t);
  if (!t || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const want = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`)));
  return sigs.some((s) => {
    if (s.length !== want.length) return false;
    let diff = 0;
    for (let i = 0; i < s.length; i++) diff |= s.charCodeAt(i) ^ want.charCodeAt(i);
    return diff === 0;
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function markPaid(sb: ReturnType<typeof db>, session: any) {
  const id = session.metadata?.booking_id;
  if (!id) return;
  const { data: b } = await sb.from("bookings").select("*").eq("id", id).maybeSingle();
  if (!b || b.payment_status === "paid") return;
  if (b.status !== "approved") {
    await sb.from("bookings").update({ pay_error: "A payment arrived after this booking was closed. Refund it in Stripe or re-open the booking." }).eq("id", id);
    return;
  }
  const kind = session.metadata?.kind === "bank" ? "bank" : "card";
  const patch: Record<string, unknown> = {
    payment_status: "paid", amount_paid: Number(session.amount_total ?? 0) / 100, pay_error: null,
    payment_method: kind === "bank" ? "bank transfer" : "card",
  };
  try {
    if (session.payment_intent) {
      const pi = await stripe("GET", `payment_intents/${session.payment_intent}`, { expand: ["payment_method"] });
      const type = pi.payment_method?.type;
      if (type === "card") patch.stripe_payment_method_id = pi.payment_method.id;
      if (type === "cashapp") patch.payment_method = "Cash App";
      const wallet = pi.payment_method?.card?.wallet?.type;
      if (wallet === "apple_pay") patch.payment_method = "Apple Pay";
      if (wallet === "google_pay") patch.payment_method = "Google Pay";
    }
    let invoice = session.invoice;
    if (!invoice) { await sleep(3000); invoice = (await stripe("GET", `checkout/sessions/${session.id}`)).invoice; }
    if (invoice) patch.invoice_url = (await stripe("GET", `invoices/${invoice}`)).hosted_invoice_url ?? null;
  } catch (_) { /* the payment still counts; details can be filled in later */ }
  await sb.from("bookings").update(patch).eq("id", id).neq("payment_status", "paid");
  const other = kind === "bank" ? b.card_session_id : b.bank_session_id;
  if (other) await stripe("POST", `checkout/sessions/${other}/expire`).catch(() => null);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret) return Response.json({ error: "STRIPE_WEBHOOK_SECRET is not set" }, { status: 500 });
  const raw = await req.text();
  if (!(await verified(raw, req.headers.get("Stripe-Signature") ?? "", secret))) return Response.json({ error: "bad signature" }, { status: 400 });
  const event = JSON.parse(raw);
  const o = event.data?.object ?? {};
  const sb = db();
  try {
    switch (event.type) {
      case "checkout.session.completed":
        if (o.payment_status === "paid") await markPaid(sb, o);
        else if (o.metadata?.booking_id) {
          await sb.from("bookings").update({ payment_status: "processing", payment_method: "bank transfer", pay_error: null })
            .eq("id", o.metadata.booking_id).eq("payment_status", "unpaid");
          const { data: b } = await sb.from("bookings").select("card_session_id").eq("id", o.metadata.booking_id).maybeSingle();
          if (b?.card_session_id) await stripe("POST", `checkout/sessions/${b.card_session_id}/expire`).catch(() => null);
        }
        break;
      case "checkout.session.async_payment_succeeded":
        await markPaid(sb, o);
        break;
      case "checkout.session.async_payment_failed":
        if (o.metadata?.booking_id)
          await sb.from("bookings").update({ payment_status: "unpaid", pay_error: "The bank transfer failed." })
            .eq("id", o.metadata.booking_id).eq("payment_status", "processing");
        break;
      case "invoice.paid":
        if (o.metadata?.booking_id && o.hosted_invoice_url)
          await sb.from("bookings").update({ invoice_url: o.hosted_invoice_url }).eq("id", o.metadata.booking_id).is("invoice_url", null);
        break;
      case "payment_intent.canceled":
        if (o.metadata?.kind === "deposit" && o.metadata?.booking_id)
          await sb.from("bookings").update({ deposit_status: "failed", deposit_note: "The hold on the card lapsed or was cancelled by the bank." })
            .eq("id", o.metadata.booking_id).eq("deposit_status", "held").eq("deposit_pi_id", o.id);
        break;
    }
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
  return Response.json({ received: true });
});
