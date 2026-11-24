// Stillfire Sauna Co. — private calendar feed (.ics) for Google Calendar, Apple Calendar or Outlook.
// Subscribe once with the address shown in the owner dashboard; bookings and blocked dates appear on their own.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const ics = (s: unknown) => String(s ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const ymd = (iso: string) => iso.replaceAll("-", "");
const nextDay = (iso: string) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
};
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");

Deno.serve(async (req: Request) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!token) return new Response("Not found", { status: 404 });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data, error } = await db.rpc("calendar_feed", { p_token: token });
  if (error || !data) return new Response("Not found", { status: 404 });

  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Stillfire Sauna Co//Bookings//EN", "CALSCALE:GREGORIAN",
    "X-WR-CALNAME:Stillfire bookings", "X-WR-TIMEZONE:America/Chicago"];
  for (const b of data.bookings ?? []) {
    const pending = b.status === "pending";
    lines.push("BEGIN:VEVENT", `UID:booking-${b.id}@stillfiresaunaco.com`, `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${ymd(b.delivery_date)}`, `DTEND;VALUE=DATE:${nextDay(b.pickup_date)}`,
      `SUMMARY:${ics((pending ? "REQUEST (not approved): " : "Sauna: ") + b.name)}`,
      `LOCATION:${ics(b.address)}`,
      `DESCRIPTION:${ics(`${b.ref}\nDeliver ${b.delivery_date}, pick up ${b.pickup_date}\nPhone ${b.phone}\nStatus ${b.status}`)}`,
      `STATUS:${pending ? "TENTATIVE" : "CONFIRMED"}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  for (const k of data.blocks ?? []) {
    lines.push("BEGIN:VEVENT", `UID:block-${k.id}@stillfiresaunaco.com`, `DTSTAMP:${stamp()}`,
      `DTSTART;VALUE=DATE:${ymd(k.start_date)}`, `DTEND;VALUE=DATE:${nextDay(k.end_date)}`,
      `SUMMARY:${ics("Blocked: " + (k.reason || "not available"))}`, "TRANSP:OPAQUE", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Cache-Control": "no-store" },
  });
});
