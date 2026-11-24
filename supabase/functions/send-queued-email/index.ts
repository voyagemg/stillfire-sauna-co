// Stillfire Sauna Co. — sends queued emails through Resend.
// The database queues rows in email_outbox and pings this function; a 10-minute
// schedule pings it again as a backstop, so a failed send is retried on its own.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const FROM = Deno.env.get("STILLFIRE_FROM") ?? "Stillfire Sauna Co. <booking@stillfiresaunaco.com>";

type Biz = {
  base_town?: string; contact_email?: string; contact_phone?: string; delivery_time?: string;
  pickup_time?: string; site_url?: string; review_url?: string; damage_deposit?: number;
};
type P = Record<string, any> & { biz?: Biz };

const esc = (v: unknown) =>
  String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const first = (name: unknown) => esc(String(name ?? "there").trim().split(/\s+/)[0] || "there");
const money = (v: unknown) => (v === null || v === undefined || v === "" ? "" : "$" + Number(v).toFixed(2).replace(/\.00$/, ""));
const day = (iso: unknown) => {
  if (!iso) return "";
  const d = new Date(String(iso) + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
};
const siteUrl = (b?: Biz) => (b?.site_url || "https://stillfiresaunaco.com").replace(/\/+$/, "");
const row = (label: string, value: string) =>
  value ? `<tr><td style="padding:6px 16px 6px 0;color:#6b6762;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:6px 0;color:#1B1917">${value}</td></tr>` : "";
const table = (rows: string) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:15px;line-height:1.5">${rows}</table>`;
const p = (html: string) => `<p style="margin:0 0 16px 0">${html}</p>`;
const list = (items: string[]) => `<ul style="margin:0 0 16px 20px;padding:0">${items.map((i) => `<li style="margin:0 0 8px 0">${i}</li>`).join("")}</ul>`;
const button = (href: string, label: string) =>
  `<p style="margin:24px 0"><a href="${esc(href)}" style="background:#C23E22;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:4px;display:inline-block;font-weight:600">${label}</a></p>`;

function bookingRows(d: P) {
  return table(
    row("Booking", esc(d.ref)) +
      row("Delivery", day(d.delivery_date) + (d.biz?.delivery_time ? `, ${esc(d.biz.delivery_time)}` : "")) +
      row("Pickup", day(d.pickup_date) + (d.biz?.pickup_time ? `, ${esc(d.biz.pickup_time)}` : "")) +
      row("Nights", esc(d.nights)) +
      row("Address", esc(d.address)),
  );
}
function contactLine(b?: Biz) {
  const bits = [b?.contact_phone ? `call or text ${esc(b.contact_phone)}` : "", b?.contact_email ? `email ${esc(b.contact_email)}` : ""].filter(Boolean);
  return bits.length ? `Questions? You can ${bits.join(" or ")}, or just reply to this message.` : "Questions? Just reply to this message.";
}
const guestLink = (d: P) => `${siteUrl(d.biz)}/#agreement`;
const sitePrep = [
  "A firm, level spot with clear access for a truck and trailer.",
  "In winter, the path and the pad cleared of snow and ice.",
  "Space around the sauna kept clear of vehicles, tents and anything that can burn.",
  "A responsible adult on site for the delivery walk-through.",
];

function layout(heading: string, body: string, b?: Biz) {
  return `<!doctype html><html><body style="margin:0;background:#E9EBE8;font-family:Georgia,'Times New Roman',serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#E9EBE8"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff">
<tr><td style="background:#1B1917;padding:26px 32px;text-align:center;color:#E9EBE8;font-size:22px;letter-spacing:6px">STILL<span style="color:#D8472A">&#9679;</span>FIRE<div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:4px;margin-top:8px;color:#C9C6C0">SAUNA CO.</div></td></tr>
<tr><td style="padding:32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#1B1917">
<h1 style="margin:0 0 18px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.3;font-weight:normal">${heading}</h1>
${body}
</td></tr>
<tr><td style="padding:18px 32px;background:#F4F4F2;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#6b6762">Stillfire Sauna Co.${b?.base_town ? " · " + esc(b.base_town) + ", Minnesota" : " · Minnesota"}<br>${esc(siteUrl(b).replace(/^https?:\/\//, ""))}</td></tr>
</table></td></tr></table></body></html>`;
}

function render(template: string, d: P): { subject: string; html: string } | null {
  const b = d.biz;
  switch (template) {
    case "booking_received":
      return { subject: `We have your request (${d.ref})`, html: layout(`Thanks, ${first(d.name)}. Your request is in.`,
        p("We've received your request for the dates below and signed agreement. <strong>Your dates are being held while we review it, but the booking is not confirmed yet.</strong>") +
        bookingRows(d) +
        (d.estimate ? p(`Estimated total: <strong>${money(d.estimate)}</strong>. We'll confirm the final amount, including delivery, when we approve the booking.`) : p("We'll confirm your total, including delivery, when we approve the booking.")) +
        p("<strong>What happens next</strong>") +
        list(["We check the calendar and your delivery location, usually within one day.", "You get a confirmation email, followed by an invoice.", "Your date is locked in once the invoice is paid."]) +
        p(`Other adults in your group need to sign the agreement before they use the sauna. Send them this link and your booking number <strong>${esc(d.ref)}</strong>:<br><a href="${esc(guestLink(d))}">${esc(guestLink(d))}</a>`) +
        p(contactLine(b)), b) };
    case "booking_approved":
      return { subject: `Your Stillfire booking is approved (${d.ref})`, html: layout(`You're on the calendar, ${first(d.name)}.`,
        p("Good news: we've approved your booking.") + bookingRows(d) +
        (d.quoted_total ? p(`Total: <strong>${money(d.quoted_total)}</strong>${b?.damage_deposit ? `, plus a refundable damage deposit of ${money(b.damage_deposit)}` : ""}. Your invoice arrives separately. The date is locked in once it's paid.`) : p("Your invoice arrives separately. The date is locked in once it's paid.")) +
        (d.owner_note ? p(`<strong>A note from us:</strong> ${esc(d.owner_note)}`) : "") +
        p("<strong>Getting your site ready</strong>") + list(sitePrep) +
        p(`Every adult who will use the sauna signs the agreement first. Share this link and booking number <strong>${esc(d.ref)}</strong>:<br><a href="${esc(guestLink(d))}">${esc(guestLink(d))}</a>`) +
        p(contactLine(b)), b) };
    case "booking_declined":
      return { subject: `About your Stillfire request (${d.ref})`, html: layout(`We can't take this one, ${first(d.name)}.`,
        p(`We're sorry. We aren't able to confirm your request for ${day(d.delivery_date)} to ${day(d.pickup_date)}.`) +
        (d.owner_note ? p(`<strong>Why:</strong> ${esc(d.owner_note)}`) : "") +
        p("If other dates could work, the calendar on our site shows what's open.") + button(`${siteUrl(b)}/#book`, "See open dates") + p(contactLine(b)), b) };
    case "booking_cancelled":
      return { subject: `Your Stillfire booking was cancelled (${d.ref})`, html: layout(`Booking ${esc(d.ref)} is cancelled.`,
        p(`Your booking for ${day(d.delivery_date)} to ${day(d.pickup_date)} has been cancelled.`) +
        (d.owner_note ? p(esc(d.owner_note)) : "") + p("If this is a surprise, please get in touch right away.") + p(contactLine(b)), b) };
    case "prep_reminder":
      return { subject: `Three days to go: getting ready for your sauna`, html: layout(`Your sauna arrives ${day(d.delivery_date)}.`,
        bookingRows(d) + p("<strong>Before we arrive</strong>") + list(sitePrep) +
        p("<strong>Good to have on hand</strong>") + list(["Towels and something to sit on.", "Plenty of drinking water.", "Clean water for the stones.", "Warm clothes and footwear for cooling off outside."]) +
        p(`Still need signatures from other adults? Booking number <strong>${esc(d.ref)}</strong>: <a href="${esc(guestLink(d))}">${esc(guestLink(d))}</a>`) +
        p(contactLine(b)), b) };
    case "delivery_tomorrow":
      return { subject: `See you tomorrow`, html: layout(`We deliver tomorrow, ${first(d.name)}.`,
        bookingRows(d) +
        p("We'll set the sauna up, level it and walk you through lighting the stove and the safety rules. Please have the adult who will be in charge there for the walk-through. It takes about 20 minutes.") +
        p("If the weather or your plans change, tell us as early as you can.") + p(contactLine(b)), b) };
    case "pickup_tomorrow":
      return { subject: `Pickup is tomorrow`, html: layout(`We pick up tomorrow.`,
        bookingRows(d) +
        list(["Let the fire burn out completely tonight. Leave the ashes for us.", "Take your towels, bottles and trash with you.", "Keep the path clear so we can hitch up and go."]) +
        p("You don't need to be there for pickup unless we've arranged otherwise.") + p(contactLine(b)), b) };
    case "thank_you":
      return { subject: `Thank you from Stillfire`, html: layout(`Thank you, ${first(d.name)}.`,
        p("We hope the fire was good and the quiet was better. Thank you for having us.") +
        (b?.review_url ? p("If you have two minutes, a short review helps a small Minnesota business more than you'd think.") + button(b.review_url, "Leave a review") : "") +
        p("When you're ready for another round, your details are easy to re-enter and the calendar is always up to date.") + button(`${siteUrl(b)}/#book`, "Book again"), b) };
    case "inquiry_received":
      return { subject: `We got your message`, html: layout(`Thanks for reaching out, ${first(d.name)}.`,
        p("Your message is with us and we'll reply personally, usually within one day.") +
        p("In the meantime, the calendar on our site shows open dates and you can request a booking there at any time.") + button(`${siteUrl(b)}/#book`, "See open dates") + p(contactLine(b)), b) };
    case "inquiry_followup":
      return { subject: `Still thinking about a sauna?`, html: layout(`Still thinking it over, ${first(d.name)}?`,
        p("You asked us a question a few days ago. If anything is still unclear, reply to this email and we'll help.") +
        p("If you have a date in mind, requesting it on the site holds it while we confirm the details.") + button(`${siteUrl(b)}/#book`, "Check dates") +
        p("This is the only follow-up we'll send."), b) };
    case "owner_new_request":
      return { subject: `New booking request: ${d.name}, ${d.delivery_date} to ${d.pickup_date}`, html: layout(`New booking request`,
        table(row("Booking", esc(d.ref)) + row("Name", esc(d.name)) + row("Phone", esc(d.phone)) + row("Email", esc(d.email)) +
          row("Delivery", day(d.delivery_date)) + row("Pickup", day(d.pickup_date)) + row("Nights", esc(d.nights)) + row("Address", esc(d.address)) +
          row("Miles from base", esc(d.miles_from_base)) + row("Occasion", esc(d.occasion)) + row("Group size", esc(d.guest_count)) +
          row("Firewood bundles", d.firewood_bundles ? esc(d.firewood_bundles) : "") + row("Estimate", money(d.estimate)) + row("Notes", esc(d.notes))) +
        p("The dates are held until you approve or decline.") + button(`${siteUrl(b)}/#owner`, "Open the dashboard"), b) };
    case "owner_pending_nudge":
      return { subject: `Still waiting on you: ${d.name} (${d.ref})`, html: layout(`A request is still waiting`,
        p(`${esc(d.name)} asked for ${day(d.delivery_date)} to ${day(d.pickup_date)} more than a day ago. The dates stay blocked until you approve or decline.`) +
        button(`${siteUrl(b)}/#owner`, "Open the dashboard"), b) };
    case "owner_new_inquiry":
      return { subject: `New question from ${d.name}`, html: layout(`New question from the website`,
        table(row("Name", esc(d.name)) + row("Email", esc(d.email)) + row("Phone", esc(d.phone))) + p(esc(d.message).replace(/\n/g, "<br>")) +
        p("They've had an automatic reply saying you'll answer within a day."), b) };
    case "owner_digest": {
      const pend = (d.pending ?? []) as any[];
      const up = (d.upcoming ?? []) as any[];
      return { subject: `Stillfire today: ${pend.length} waiting, ${up.length} in the next 7 days`, html: layout(`Stillfire summary for ${day(d.date)}`,
        p(`<strong>Requests waiting for you: ${pend.length}</strong>`) +
        (pend.length ? list(pend.map((x) => `${esc(x.name)}, ${esc(x.city)}: ${esc(x.delivery_date)} to ${esc(x.pickup_date)} (${esc(x.ref)})`)) : "") +
        p(`<strong>Deliveries and pickups in the next 7 days: ${up.length}</strong>`) +
        (up.length ? list(up.map((x) => `${esc(x.delivery_date)} to ${esc(x.pickup_date)}: ${esc(x.name)}, ${esc(x.address)}, ${esc(x.phone)} (${esc(x.ref)})`)) : "") +
        (d.failed_emails ? p(`<strong style="color:#C23E22">${esc(d.failed_emails)} email(s) failed to send in the last 7 days.</strong> Check the Emails tab in the dashboard.`) : "") +
        button(`${siteUrl(b)}/#owner`, "Open the dashboard"), b) };
    }
    default:
      return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = req.headers.get("x-stillfire-key") ?? "";
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    // Nothing is claimed, so queued emails wait untouched until the key is added.
    return Response.json({ ok: false, reason: "RESEND_API_KEY is not set" }, { status: 200 });
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows, error } = await db.rpc("mailer_claim", { p_secret: secret, p_limit: 20 });
  if (error) return Response.json({ ok: false, reason: error.message }, { status: error.message.includes("forbidden") ? 403 : 500 });

  let sent = 0, failed = 0;
  for (const r of rows ?? []) {
    let ok = false, err = "";
    try {
      const msg = render(r.template, r.payload ?? {});
      if (!msg) throw new Error(`unknown template ${r.template}`);
      const replyTo = r.payload?.biz?.contact_email;
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": `stillfire-${r.id}` },
        body: JSON.stringify({ from: FROM, to: [r.to_email], subject: msg.subject, html: msg.html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      });
      ok = res.ok;
      if (!ok) err = `Resend ${res.status}: ${(await res.text()).slice(0, 300)}`;
    } catch (e) {
      err = e instanceof Error ? e.message : String(e);
    }
    await db.rpc("mailer_result", { p_secret: secret, p_id: r.id, p_ok: ok, p_error: err || null });
    ok ? sent++ : failed++;
  }
  return Response.json({ ok: true, sent, failed });
});
