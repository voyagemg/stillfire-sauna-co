// Stillfire Sauna Co. — owner dashboard: approve or decline requests, block dates,
// answer questions, watch the email queue and edit prices. Only emails on the admin list get in.
(function () {
  "use strict";
  var SF = window.SF, CFG = window.STILLFIRE || {};
  var $ = SF.$, $$ = SF.$$, esc = SF.esc, money = SF.money, fmtDate = SF.fmtDate;
  var root, st = { tab: "requests", email: "", stage: "loading", data: null, note: null };
  var cameFromLink = /access_token=|[?&]code=/.test(location.href);

  var FIELDS = [
    ["base_town", "Base town", "text"], ["contact_email", "Public contact email", "email"], ["contact_phone", "Public phone", "tel"],
    ["owner_notify_email", "Send owner alerts to", "email"], ["first_night_price", "First night ($)", "number"],
    ["additional_night_price", "Each additional night ($)", "number"], ["free_delivery_miles", "Free delivery within (miles)", "number"],
    ["per_mile_fee", "Per mile beyond that ($)", "number"], ["max_delivery_miles", "Farthest delivery (miles)", "number"],
    ["damage_deposit", "Damage deposit ($)", "number"], ["firewood_bundle_price", "Firewood bundle ($)", "number"], ["seats", "Seats", "number"],
    ["min_notice_days", "Minimum notice (days)", "number"], ["max_nights", "Longest online booking (nights)", "number"],
    ["delivery_time", "Usual delivery time", "text"], ["pickup_time", "Usual pickup time", "text"],
    ["site_url", "Website address", "text"], ["review_url", "Review link", "text"]
  ];
  var TEMPLATE_NAMES = {
    booking_received: "Request received", owner_new_request: "Owner: new request", booking_approved: "Booking approved",
    booking_declined: "Booking declined", booking_cancelled: "Booking cancelled", prep_reminder: "3-day prep reminder",
    delivery_tomorrow: "Delivery tomorrow", pickup_tomorrow: "Pickup tomorrow", thank_you: "Thank-you", inquiry_received: "Question auto-reply",
    inquiry_followup: "Question follow-up", owner_new_inquiry: "Owner: new question", owner_pending_nudge: "Owner: request waiting", owner_digest: "Owner: daily summary"
  };

  function demo() {
    var t = SF.today(), a = SF.addDays;
    var mk = function (id, status, d1, d2, name, city, extra) {
      return Object.assign({ id: id, ref: "SF-" + id, status: status, delivery_date: a(t, d1), pickup_date: a(t, d2), nights: d2 - d1, customer_name: name,
        email: "customer@example.com", phone: "218-555-0100", address_line: "100 Example Lake Rd", city: city, state: "MN", zip: "56501",
        miles_from_base: 22, occasion: "Cabin weekend", guest_count: 6, firewood_bundles: 2, notes: "Gravel drive, plowed.", estimate: 500, quoted_total: null,
        owner_note: null, created_at: new Date().toISOString() }, extra || {});
    };
    return {
      bookings: [mk("DEMO01", "pending", 19, 22, "Sample Customer", "Detroit Lakes"), mk("DEMO02", "approved", 6, 8, "Example Renter", "Park Rapids", { quoted_total: 540 }),
        mk("DEMO03", "completed", -12, -10, "Past Guest", "Perham", { quoted_total: 480 })],
      waivers: [{ booking_id: "DEMO01", role: "renter", signer_name: "Sample Customer", signed_at: new Date().toISOString() },
        { booking_id: "DEMO02", role: "renter", signer_name: "Example Renter", signed_at: new Date().toISOString() },
        { booking_id: "DEMO02", role: "guest", signer_name: "Guest One", signed_at: new Date().toISOString() }],
      blocks: [{ id: "B1", start_date: a(t, 33), end_date: a(t, 34), reason: "Stove service" }],
      inquiries: [{ id: "Q1", name: "Curious Visitor", email: "visitor@example.com", phone: "", message: "Do you deliver to the north side of the lake in January?", handled: false, created_at: new Date().toISOString() }],
      emails: [{ id: "E1", template: "booking_received", to_email: "customer@example.com", status: "sent", attempts: 1, last_error: null, created_at: new Date().toISOString() },
        { id: "E2", template: "owner_new_request", to_email: "owner@example.com", status: "sent", attempts: 1, last_error: null, created_at: new Date().toISOString() }],
      settings: { calendar_token: "example-token" }
    };
  }

  // ------------------------------------------------------------ data
  function q(p) { return p.then(function (r) { if (r.error) throw r.error; return r.data; }); }
  function load() {
    if (SF.preview) { st.data = st.data || demo(); st.stage = "in"; render(); return Promise.resolve(); }
    var d = SF.db;
    return Promise.all([
      q(d.from("bookings").select("*").order("delivery_date", { ascending: true })),
      q(d.from("waivers").select("booking_id, role, signer_name, minors, signed_at").order("signed_at", { ascending: true })),
      q(d.from("blocked_dates").select("*").order("start_date", { ascending: true })),
      q(d.from("inquiries").select("*").order("created_at", { ascending: false }).limit(50)),
      q(d.from("email_outbox").select("id, template, to_email, status, attempts, last_error, created_at, sent_at").order("created_at", { ascending: false }).limit(60)),
      q(d.from("settings").select("*").limit(1))
    ]).then(function (r) {
      st.data = { bookings: r[0], waivers: r[1], blocks: r[2], inquiries: r[3], emails: r[4], settings: r[5][0] || {} };
      st.stage = "in"; render();
    }).catch(function (e) { st.note = ["err", "Couldn't load the dashboard: " + ((e && e.message) || "unknown error")]; st.stage = "in"; st.data = st.data || demo(); render(); });
  }
  function act(promise, okText) {
    if (SF.preview) { st.note = ["info", "Preview only: in the live dashboard this would save and email the customer."]; render(); return; }
    q(promise).then(function () { st.note = ["ok", okText]; SF.reloadInfo(); return load(); }).catch(function (e) {
      var m = (e && e.message) || "";
      st.note = ["err", m.indexOf("BLOCK_OVERLAPS_BOOKING") >= 0 ? "Those dates overlap a live booking. Cancel or decline the booking first."
        : m.indexOf("DATES_BLOCKED") >= 0 || m.indexOf("bookings_no_overlap") >= 0 ? "Those dates clash with another booking or a block."
        : "That didn't save: " + m];
      render();
    });
  }

  // ------------------------------------------------------------ views
  function signInHtml() {
    return '<div class="o-card" style="max-width:520px"><h3>Owner sign-in</h3><p>Enter your email and we\'ll send a sign-in link. Only emails on the admin list can open the dashboard.</p>' +
      '<div id="oMsg"></div><form id="oSignIn" novalidate><div class="field"><label for="oEmail">Email</label><input id="oEmail" type="email" autocomplete="email" required value="' + esc(st.email) + '"></div>' +
      '<button class="btn" type="submit">Email me a sign-in link</button></form>' +
      (st.stage === "sent" ? '<form id="oCode" novalidate style="margin-top:24px"><p>Check your inbox. Click the link in the email, or type the 6-digit code here if the email shows one.</p><div class="field"><label for="oToken">Code</label><input id="oToken" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></div><button class="btn ghost" type="submit">Sign in with code</button></form>' : "") + "</div>";
  }
  function sigs(id) {
    var w = st.data.waivers.filter(function (x) { return x.booking_id === id; });
    if (!w.length) return "No signatures yet";
    return w.map(function (x) { return esc(x.signer_name) + " (" + esc(x.role) + (x.minors ? ", for: " + esc(x.minors) : "") + ")"; }).join("; ");
  }
  function bookingCard(b, mode) {
    var h = '<div class="o-card"><span class="tag ' + esc(b.status) + '">' + esc(b.status) + "</span><h3>" + esc(b.customer_name) + " · " + esc(b.ref) + "</h3>" +
      '<div class="o-meta"><div><b>Delivery</b> ' + esc(fmtDate(b.delivery_date)) + "</div><div><b>Pickup</b> " + esc(fmtDate(b.pickup_date)) + " (" + esc(b.nights) + " nights)</div>" +
      "<div><b>Address</b> " + esc(b.address_line) + ", " + esc(b.city) + ", " + esc(b.state) + " " + esc(b.zip) + "</div><div><b>Miles from base</b> " + esc(b.miles_from_base == null ? "not given" : b.miles_from_base) + "</div>" +
      "<div><b>Phone</b> " + esc(b.phone) + "</div><div><b>Email</b> " + esc(b.email) + "</div>" +
      "<div><b>Group</b> " + esc(b.guest_count || "not given") + (b.occasion ? ", " + esc(b.occasion) : "") + "</div><div><b>Extra firewood</b> " + esc(b.firewood_bundles || 0) + " bundle(s)</div>" +
      "<div><b>Estimate</b> " + (b.estimate == null ? "prices not set" : esc(money(b.estimate))) + "</div><div><b>Quoted</b> " + (b.quoted_total == null ? "not yet" : esc(money(b.quoted_total))) + "</div>" +
      "<div><b>Signed</b> " + sigs(b.id) + "</div>" + (b.notes ? "<div><b>Notes</b> " + esc(b.notes) + "</div>" : "") + "</div>";
    if (mode === "pending") {
      h += '<div class="o-actions"><div class="field"><label for="t-' + esc(b.id) + '">Total to quote ($)</label><input id="t-' + esc(b.id) + '" type="number" min="0" step="0.01" value="' + esc(b.estimate == null ? "" : b.estimate) + '"></div>' +
        '<div class="field" style="flex:2 1 260px"><label for="n-' + esc(b.id) + '">Note to the customer (optional)</label><input id="n-' + esc(b.id) + '" type="text" maxlength="500"></div>' +
        '<button class="btn small" type="button" data-act="approve" data-id="' + esc(b.id) + '">Approve</button><button class="btn ghost small" type="button" data-act="decline" data-id="' + esc(b.id) + '">Decline</button></div>';
    } else if (mode === "approved") {
      h += '<div class="o-actions"><button class="btn ghost small" type="button" data-act="cancel" data-id="' + esc(b.id) + '">Cancel this booking</button></div>';
    }
    return h + "</div>";
  }
  function requestsHtml() {
    var bs = st.data.bookings, t = SF.today();
    var pend = bs.filter(function (b) { return b.status === "pending"; });
    var appr = bs.filter(function (b) { return b.status === "approved" && b.pickup_date >= t; });
    var rest = bs.filter(function (b) { return pend.indexOf(b) < 0 && appr.indexOf(b) < 0; }).reverse().slice(0, 40);
    return "<h3>Waiting for you (" + pend.length + ")</h3>" + (pend.length ? pend.map(function (b) { return bookingCard(b, "pending"); }).join("") : "<p>Nothing waiting. New requests appear here and arrive by email.</p>") +
      '<h3 style="margin-top:36px">Approved and upcoming (' + appr.length + ")</h3>" + (appr.length ? appr.map(function (b) { return bookingCard(b, "approved"); }).join("") : "<p>No upcoming rentals.</p>") +
      '<h3 style="margin-top:36px">Past and closed</h3>' + (rest.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Booking</th><th>Name</th><th>Dates</th><th>Status</th><th>Quoted</th></tr></thead><tbody>' +
        rest.map(function (b) { return "<tr><td>" + esc(b.ref) + "</td><td>" + esc(b.customer_name) + "</td><td>" + esc(b.delivery_date) + " to " + esc(b.pickup_date) + '</td><td><span class="tag ' + esc(b.status) + '">' + esc(b.status) + "</span></td><td>" + (b.quoted_total == null ? "" : esc(money(b.quoted_total))) + "</td></tr>"; }).join("") + "</tbody></table></div>" : "<p>Nothing yet.</p>");
  }
  function calendarHtml() {
    var d = st.data, t = SF.today();
    var feed = (CFG.supabaseUrl || "https://YOUR-PROJECT.supabase.co") + "/functions/v1/calendar-feed?token=" + (d.settings.calendar_token || "");
    var live = d.bookings.filter(function (b) { return (b.status === "pending" || b.status === "approved") && b.pickup_date >= t; });
    return '<div class="o-card"><h3>Block dates</h3><p>Use this for maintenance, holidays or a booking you took by phone. Blocked dates show as taken on the site.</p><form id="oBlock" novalidate><div class="o-actions">' +
      '<div class="field"><label for="kStart">First day</label><input id="kStart" type="date" required></div><div class="field"><label for="kEnd">Last day</label><input id="kEnd" type="date" required></div>' +
      '<div class="field" style="flex:2 1 220px"><label for="kReason">Reason (only you see this)</label><input id="kReason" type="text" maxlength="200"></div><button class="btn small" type="submit">Block</button></div></form>' +
      (d.blocks.length ? '<div class="tbl-box" style="margin-top:18px"><table class="tbl"><thead><tr><th>From</th><th>To</th><th>Reason</th><th></th></tr></thead><tbody>' + d.blocks.map(function (k) {
        return "<tr><td>" + esc(k.start_date) + "</td><td>" + esc(k.end_date) + "</td><td>" + esc(k.reason || "") + '</td><td><button class="btn ghost small" type="button" data-act="unblock" data-id="' + esc(k.id) + '">Remove</button></td></tr>'; }).join("") + "</tbody></table></div>" : "") + "</div>" +
      '<div class="o-card"><h3>Schedule</h3>' + (live.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Delivery</th><th>Pickup</th><th>Who</th><th>Where</th><th>Status</th></tr></thead><tbody>' + live.map(function (b) {
        return "<tr><td>" + esc(fmtDate(b.delivery_date)) + "</td><td>" + esc(fmtDate(b.pickup_date)) + "</td><td>" + esc(b.customer_name) + "<br>" + esc(b.phone) + "</td><td>" + esc(b.address_line) + ", " + esc(b.city) + '</td><td><span class="tag ' + esc(b.status) + '">' + esc(b.status) + "</span></td></tr>"; }).join("") + "</tbody></table></div>" : "<p>Nothing on the calendar.</p>") + "</div>" +
      '<div class="o-card"><h3>See it in Google Calendar</h3><p>In Google Calendar choose <b>Other calendars, then From URL</b>, and paste this private address. Bookings and blocked dates then appear on their own. Google refreshes subscribed calendars only a few times a day, so rely on this dashboard and the alert emails for anything urgent.</p><p class="mono">' + esc(feed) + "</p><p>Keep this address private: anyone who has it can see customer names and addresses.</p></div>";
  }
  function questionsHtml() {
    var qs = st.data.inquiries;
    return qs.length ? qs.map(function (x) {
      return '<div class="o-card">' + (x.handled ? '<span class="tag completed">answered</span>' : '<span class="tag pending">open</span>') + "<h3>" + esc(x.name) + "</h3><p>" + esc(x.message).replace(/\n/g, "<br>") + "</p>" +
        '<p>Reply to: <a href="mailto:' + esc(x.email) + '">' + esc(x.email) + "</a>" + (x.phone ? " · " + esc(x.phone) : "") + " · " + esc(String(x.created_at).slice(0, 10)) + "</p>" +
        '<div class="o-actions"><button class="btn ghost small" type="button" data-act="' + (x.handled ? "reopen" : "handled") + '" data-id="' + esc(x.id) + '">' + (x.handled ? "Mark as open" : "Mark as answered") + "</button></div></div>";
    }).join("") : "<p>No questions yet. Messages from the contact form appear here and arrive by email.</p>";
  }
  function emailsHtml() {
    var es = st.data.emails;
    var stuck = es.length && es.every(function (e) { return e.status !== "sent"; });
    return (stuck ? '<div class="msg info">Emails are queued but none have been sent. The email key may not be added yet, or the sending domain may not be verified.</div>' : "") +
      "<p>Every automatic email is logged here. A failed email is retried up to five times before it is marked failed.</p>" +
      (es.length ? '<div class="tbl-box"><table class="tbl"><thead><tr><th>Queued</th><th>Email</th><th>To</th><th>Status</th><th>Problem</th></tr></thead><tbody>' + es.map(function (e) {
        return "<tr><td>" + esc(String(e.created_at).slice(0, 16).replace("T", " ")) + "</td><td>" + esc(TEMPLATE_NAMES[e.template] || e.template) + "</td><td>" + esc(e.to_email) + '</td><td><span class="tag ' + esc(e.status) + '">' + esc(e.status) + "</span></td><td>" + esc(e.last_error || "") + "</td></tr>"; }).join("") + "</tbody></table></div>" : "<p>No emails yet.</p>");
  }
  function settingsHtml() {
    var s = st.data.settings || {};
    return '<form id="oSettings" class="o-card" novalidate><h3>Prices, area and contact details</h3><p>These appear on the public site as soon as you save. Leave a field empty to show a placeholder.</p><div class="row2">' +
      FIELDS.map(function (f) { return '<div class="field"><label for="s-' + f[0] + '">' + esc(f[1]) + '</label><input id="s-' + f[0] + '" type="' + f[2] + '"' + (f[2] === "number" ? ' step="0.01" min="0"' : "") + ' value="' + esc(s[f[0]] == null ? "" : s[f[0]]) + '"></div>'; }).join("") +
      '</div><button class="btn" type="submit">Save settings</button></form>';
  }
  function render() {
    if (!root) return;
    if (st.stage === "loading") { root.innerHTML = "<p>Loading…</p>"; return; }
    if (st.stage === "out" || st.stage === "sent") { root.innerHTML = signInHtml(); if (st.note) SF.setMsg($("#oMsg"), st.note[0], st.note[1]); st.note = null; return; }
    if (st.stage === "denied") {
      root.innerHTML = '<div class="msg err">' + esc(st.email) + ' is signed in but is not on the admin list.</div><button class="btn ghost" type="button" data-act="signout">Sign out</button>'; return;
    }
    var tabs = [["requests", "Requests"], ["calendar", "Calendar"], ["questions", "Questions"], ["emails", "Emails"], ["settings", "Settings"]];
    var body = st.tab === "requests" ? requestsHtml() : st.tab === "calendar" ? calendarHtml() : st.tab === "questions" ? questionsHtml() : st.tab === "emails" ? emailsHtml() : settingsHtml();
    root.innerHTML = (SF.preview ? '<div class="msg info">Preview with sample data. Sign-in, saving and emails work once the site is connected to the booking system.</div>' : "") +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (st.tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") +
      (SF.preview ? "" : '<button type="button" data-act="signout" style="margin-left:auto">Sign out</button>') + "</div>" +
      (st.note ? '<div class="msg ' + st.note[0] + '" role="status">' + esc(st.note[1]) + "</div>" : "") + body;
    st.note = null;
  }

  // ------------------------------------------------------------ events
  function onClick(e) {
    var tab = e.target.closest("[data-tab]");
    if (tab) { st.tab = tab.getAttribute("data-tab"); render(); return; }
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var id = b.getAttribute("data-id"), a = b.getAttribute("data-act"), d = SF.db;
    if (a === "signout") { d.auth.signOut().then(function () { st.stage = "out"; st.data = null; render(); }); return; }
    if (a === "approve" || a === "decline") {
      var total = ($("#t-" + id) || {}).value, note = (($("#n-" + id) || {}).value || "").trim();
      if (a === "approve" && (total === "" || total == null)) { st.note = ["err", "Enter the total to quote before approving."]; render(); return; }
      act(SF.preview ? null : d.from("bookings").update({ status: a === "approve" ? "approved" : "declined", quoted_total: total === "" ? null : Number(total), owner_note: note || null }).eq("id", id),
        a === "approve" ? "Approved. The customer has been emailed. Send your invoice next." : "Declined. The customer has been emailed and the dates are open again.");
    } else if (a === "cancel") {
      act(SF.preview ? null : d.from("bookings").update({ status: "cancelled" }).eq("id", id), "Cancelled. The customer has been emailed and the dates are open again.");
    } else if (a === "unblock") {
      act(SF.preview ? null : d.from("blocked_dates").delete().eq("id", id), "Block removed. Those dates are open again.");
    } else if (a === "handled" || a === "reopen") {
      act(SF.preview ? null : d.from("inquiries").update({ handled: a === "handled" }).eq("id", id), "Updated.");
    }
  }
  function onSubmit(e) {
    var f = e.target, d = SF.db;
    if (f.id === "oSignIn") {
      e.preventDefault();
      st.email = ($("#oEmail").value || "").trim();
      if (!st.email) return;
      d.auth.signInWithOtp({ email: st.email, options: { emailRedirectTo: location.href.split("#")[0] } }).then(function (r) {
        if (r.error) throw r.error;
        st.stage = "sent"; st.note = ["ok", "Sign-in email sent to " + st.email + "."]; render();
      }).catch(function (err) { st.note = ["err", "Couldn't send the sign-in email: " + ((err && err.message) || "unknown error")]; render(); });
    } else if (f.id === "oCode") {
      e.preventDefault();
      d.auth.verifyOtp({ email: st.email, token: ($("#oToken").value || "").trim(), type: "email" }).then(function (r) {
        if (r.error) throw r.error; start();
      }).catch(function (err) { st.note = ["err", "That code didn't work: " + ((err && err.message) || "unknown error")]; render(); });
    } else if (f.id === "oBlock") {
      e.preventDefault();
      var s = $("#kStart").value, en = $("#kEnd").value;
      if (!s || !en || en < s) { st.note = ["err", "Choose a first day and a last day on or after it."]; render(); return; }
      act(SF.preview ? null : d.from("blocked_dates").insert({ start_date: s, end_date: en, reason: ($("#kReason").value || "").trim() || null }), "Dates blocked.");
    } else if (f.id === "oSettings") {
      e.preventDefault();
      var patch = {};
      FIELDS.forEach(function (x) {
        var v = ($("#s-" + x[0]).value || "").trim();
        patch[x[0]] = v === "" ? null : x[2] === "number" ? Number(v) : v;
      });
      if (patch.min_notice_days == null) patch.min_notice_days = 2;
      if (patch.max_nights == null) patch.max_nights = 14;
      act(SF.preview ? null : d.from("settings").update(patch).eq("id", true), "Saved. The public site now shows these.");
    }
  }

  function start() {
    if (SF.preview) { load(); return; }
    st.stage = "loading"; render();
    SF.db.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) { st.stage = "out"; render(); return; }
      st.email = s.user.email || "";
      return SF.db.rpc("am_i_admin").then(function (a) {
        if (a.error || a.data !== true) { st.stage = "denied"; render(); return; }
        return load();
      });
    }).catch(function () { st.stage = "out"; render(); });
  }

  var wired = false;
  window.SF_OWNER = {
    show: function () {
      root = $("#ownerRoot");
      if (!wired) { root.addEventListener("click", onClick); root.addEventListener("submit", onSubmit); wired = true; }
      start();
    }
  };
  if (!SF.preview && SF.db) {
    SF.db.auth.onAuthStateChange(function (ev) {
      if (ev === "SIGNED_IN" && cameFromLink) { cameFromLink = false; location.hash = "#owner"; }
    });
  }
})();
