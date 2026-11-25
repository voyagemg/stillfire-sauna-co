// Stillfire Sauna Co. — public site: page switching, prices, availability calendar,
// booking request with signed agreement, guest signatures and the contact form.
(function () {
  "use strict";
  var CFG = window.STILLFIRE || {};
  var W = window.STILLFIRE_WAIVER;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (v) {
    return String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  var money = function (v) { var n = Number(v); return "$" + (n % 1 === 0 ? n.toFixed(0) : n.toFixed(2)); };
  var toDate = function (iso) { return new Date(iso + "T12:00:00Z"); };
  var toIso = function (d) { return d.toISOString().slice(0, 10); };
  var addDays = function (iso, n) { var d = toDate(iso); d.setUTCDate(d.getUTCDate() + n); return toIso(d); };
  var fmtDate = function (iso) {
    return iso ? toDate(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
  };
  var localToday = function () {
    var n = new Date();
    return n.getFullYear() + "-" + String(n.getMonth() + 1).padStart(2, "0") + "-" + String(n.getDate()).padStart(2, "0");
  };
  var setMsg = function (el, type, text) { if (el) el.innerHTML = text ? '<div class="msg ' + type + '">' + esc(text) + "</div>" : ""; };

  var db = null;
  var preview = true;
  if (CFG.supabaseUrl && CFG.supabaseKey && window.supabase) {
    db = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey);
    preview = false;
  }

  function withDefaults(s) {
    var out = { min_notice_days: 2, max_nights: 14 }, d = CFG.defaults || {}, k;
    for (k in d) out[k] = d[k];
    for (k in (s || {})) if (s[k] !== null && s[k] !== undefined && s[k] !== "") out[k] = s[k];
    return out;
  }
  var info = { today: localToday(), settings: withDefaults(), unavailable: [] };
  function demoInfo() {
    var t = localToday();
    return { today: t, settings: withDefaults(),
      unavailable: [{ start: addDays(t, 6), end: addDays(t, 8) }, { start: addDays(t, 19), end: addDays(t, 22) }, { start: addDays(t, 33), end: addDays(t, 34) }],
      unavailable_tent: [{ start: addDays(t, 10), end: addDays(t, 12) }], unavailable_tub: [{ start: addDays(t, 6), end: addDays(t, 8) }], unavailable_bath: [] };
  }

  var ERR = {
    DATES_TAKEN: "Someone has just requested those dates. Please choose different ones.",
    TUB_TAKEN: "The ice tub has just been booked for those dates. Untick it or choose different dates.",
    BATH_TAKEN: "The ice bath has just been booked for those dates. Untick it or choose different dates.",
    DATES_BLOCKED: "Those dates aren't available. Please choose different ones.",
    TOO_SOON: "That delivery date is too soon to book online. Please pick a later date, or contact us and we'll try to fit you in.",
    TOO_LONG: "That stay is longer than we can book online. Please contact us about longer rentals.",
    TOO_FAR_AHEAD: "We only take bookings up to a year ahead.",
    OUT_OF_AREA: "That address is outside our delivery area. Contact us and we'll see what we can do.",
    MISSING_DETAILS: "Some details are missing or don't look right. Please check your name, email and phone.",
    INVALID_DATES: "Please choose a delivery day and a later pickup day.",
    INVALID_INPUT: "One of the numbers you entered doesn't look right. Please check and try again.",
    SITE_NOT_CONFIRMED: "Please confirm the three statements about your site.",
    WAIVER_NOT_SIGNED: "Please tick every statement and type your name to sign the agreement.",
    TOO_MANY_REQUESTS: "We've had several requests from you in a short time. Please contact us directly.",
    REF_NOT_FOUND: "We couldn't find an open booking with that number. Check it with the person who booked."
  };
  function errText(e) {
    var m = (e && e.message) || "";
    for (var k in ERR) if (m.indexOf(k) >= 0) return ERR[k];
    return "Something went wrong and nothing was sent. Please try again, or contact us directly.";
  }

  // ------------------------------------------------------------ settings on the page
  function applySettings() {
    var s = info.settings || {};
    $$("[data-s]").forEach(function (el) {
      var v = s[el.getAttribute("data-s")];
      var ph = el.getAttribute("data-ph") || "";
      if (v === null || v === undefined || v === "") {
        el.innerHTML = ph.charAt(0) === "[" ? '<span class="ph">' + esc(ph) + "</span>" : esc(ph);
      } else {
        el.textContent = el.getAttribute("data-fmt") === "money" ? money(v) : String(v);
      }
    });
  }

  function loadInfo() {
    if (preview) { info = demoInfo(); applySettings(); renderCal(); return Promise.resolve(); }
    return db.rpc("get_public_info").then(function (r) {
      if (r.error) throw r.error;
      info = r.data;
      info.settings = withDefaults(info.settings);
      applySettings(); renderCal();
    }).catch(function () {
      // Could not reach the booking system (for example inside a sandboxed preview).
      preview = true; SF.preview = true;
      $("#previewBar").hidden = false;
      info = demoInfo(); applySettings(); renderCal();
    });
  }

  // ------------------------------------------------------------ page switching
  var VIEWS = ["book", "agreement", "owner", "paid"];
  function route() {
    var h = (location.hash || "").replace("#", "");
    var view = VIEWS.indexOf(h) >= 0 ? h : (h === "guest" ? "agreement" : "home");
    $$("[data-view]").forEach(function (el) { el.hidden = el.getAttribute("data-view") !== view; });
    requestAnimationFrame(function () {
      var target = h && h !== "top" && VIEWS.indexOf(h) < 0 ? document.getElementById(h) : null;
      if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    });
    if (view === "owner" && window.SF_OWNER) window.SF_OWNER.show();
    homeShown = view === "home"; paintBrand();
  }

  // The big logo sits in the hero; the small one in the menu appears once the hero logo scrolls away.
  var homeShown = true, heroLogoSeen = true;
  function paintBrand() { document.documentElement.classList.toggle("logo-in-hero", homeShown && heroLogoSeen); }
  function watchHeroLogo() {
    var el = $("#heroLogo");
    if (!el || !("IntersectionObserver" in window)) { heroLogoSeen = false; paintBrand(); return; }
    new IntersectionObserver(function (entries) {
      heroLogoSeen = entries[entries.length - 1].isIntersecting; paintBrand();
    }, { rootMargin: "-70px 0px 0px 0px" }).observe(el);
  }

  // ------------------------------------------------------------ calendar
  var sel = { start: null, end: null };
  var viewMonth = null;
  var product = "trailer";
  function isTaken(iso) {
    var lists = (product !== "tent" ? info.unavailable || [] : []).concat(product !== "trailer" ? info.unavailable_tent || [] : []);
    return lists.some(function (r) { return r.start <= iso && iso <= r.end; });
  }
  function clash(list) { return !!(sel.start && sel.end) && (list || []).some(function (r) { return r.start <= sel.end && sel.start <= r.end; }); }
  function on(id) { var el = $("#" + id); return !!(el && el.checked && !el.disabled); }
  function syncAddons() {
    [["bTub", "bTubIce", "bTubNote", info.unavailable_tub], ["bBath", "bBathIce", "bBathNote", info.unavailable_bath]].forEach(function (x) {
      var box = $("#" + x[0]), ice = $("#" + x[1]), note = $("#" + x[2]);
      if (!box) return;
      var gone = clash(x[3]);
      box.disabled = gone; if (gone) box.checked = false;
      note.hidden = !gone;
      ice.disabled = !box.checked; if (!box.checked) ice.checked = false;
      ice.parentNode.hidden = !box.checked;
    });
  }
  function itemsText() {
    var wood = Number(($("#bWood") || {}).value || 0);
    return [product === "tent" ? "Tent Sauna (1 to 2 people)" : product === "both" ? "Cedar Sauna and Tent Sauna" : "Cedar Sauna",
      on("bTub") ? "ice tub" + (on("bTubIce") ? " with first-day ice" : " (no ice)") : "",
      on("bBath") ? "ice bath" + (on("bBathIce") ? " with first-day ice" : " (no ice)") : "",
      wood ? wood + " firewood bundle" + (wood > 1 ? "s" : "") : ""].filter(Boolean).join("; ");
  }
  function minDate() { return addDays(info.today, Number(info.settings.min_notice_days || 0)); }
  function estimate() {
    var s = info.settings;
    if (!sel.start || !sel.end || s.first_night_price == null) return null;
    var nights = Math.round((toDate(sel.end) - toDate(sel.start)) / 86400000);
    var miles = Number(($("#bMiles") || {}).value || 0);
    var wood = Number(($("#bWood") || {}).value || 0);
    var n = function (v) { return Number(v || 0); };
    var tentMore = n(s.tent_additional_night_price != null ? s.tent_additional_night_price : s.tent_first_night_price), cedarMore = n(s.additional_night_price != null ? s.additional_night_price : s.first_night_price);
    var first = (product !== "tent" ? n(s.first_night_price) : 0) + (product !== "trailer" ? n(s.tent_first_night_price) : 0);
    var more = (product !== "tent" ? cedarMore : 0) + (product !== "trailer" ? tentMore : 0);
    return first + (nights - 1) * more +
      Math.max(miles - n(s.free_delivery_miles), 0) * n(s.per_mile_fee) + wood * n(s.firewood_bundle_price) +
      (on("bTub") ? n(s.ice_tub_first_price) + (nights - 1) * n(s.ice_tub_additional_price) + (on("bTubIce") ? n(s.ice_tub_ice_price) : 0) : 0) +
      (on("bBath") ? n(s.ice_bath_first_price) + (nights - 1) * n(s.ice_bath_additional_price) + (on("bBathIce") ? n(s.ice_bath_ice_price) : 0) : 0);
  }
  function nights() { return sel.start && sel.end ? Math.round((toDate(sel.end) - toDate(sel.start)) / 86400000) : 0; }

  function monthHtml(firstIso) {
    var first = toDate(firstIso);
    var y = first.getUTCFullYear(), m = first.getUTCMonth();
    var title = first.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
    var days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    var html = '<div class="cal-month"><p class="cal-title">' + esc(title) + '</p><div class="cal-grid">';
    ["S", "M", "T", "W", "T", "F", "S"].forEach(function (d) { html += '<div class="cal-dow" aria-hidden="true">' + d + "</div>"; });
    for (var i = 0; i < first.getUTCDay(); i++) html += "<div></div>";
    var lo = minDate(), hi = addDays(info.today, 365);
    for (var d = 1; d <= days; d++) {
      var iso = toIso(new Date(Date.UTC(y, m, d, 12)));
      var taken = isTaken(iso);
      var off = taken || iso < lo || iso > hi;
      var cls = "day" + (taken ? " taken" : "");
      if (iso === sel.start || iso === sel.end) cls += " sel";
      else if (sel.start && sel.end && iso > sel.start && iso < sel.end) cls += " in";
      var label = fmtDate(iso) + (taken ? ", taken" : off ? ", not available" : iso === sel.start ? ", delivery day" : iso === sel.end ? ", pickup day" : "");
      html += '<button type="button" class="' + cls + '" data-d="' + iso + '"' + (off ? " disabled" : "") + ' aria-label="' + esc(label) + '">' + d + "</button>";
    }
    return html + "</div></div>";
  }
  function renderCal() {
    var box = $("#calMonths");
    if (!box) return;
    if (!viewMonth) viewMonth = minDate().slice(0, 8) + "01";
    var next = toDate(viewMonth); next.setUTCMonth(next.getUTCMonth() + 1);
    box.innerHTML = monthHtml(viewMonth) + monthHtml(toIso(next));
    $("#calPrev").disabled = viewMonth <= info.today.slice(0, 8) + "01";
    renderSummary();
  }
  function renderSummary() {
    var box = $("#dateSummary");
    syncAddons();
    var gh = $("#groupHint"); if (gh) gh.hidden = !(product === "tent" && Number(($("#bGuests") || {}).value || 0) > 2);
    if (!sel.start) { box.innerHTML = '<p style="margin:0">No dates chosen yet.</p>'; return; }
    if (!sel.end) { box.innerHTML = "<dl><dt>Delivery</dt><dd>" + esc(fmtDate(sel.start)) + "</dd><dt>Pickup</dt><dd>Now tap your pickup day</dd></dl>"; return; }
    var est = estimate(), n = nights();
    box.innerHTML = "<dl><dt>Delivery</dt><dd>" + esc(fmtDate(sel.start)) + "</dd><dt>Pickup</dt><dd>" + esc(fmtDate(sel.end)) + "</dd><dt>Nights</dt><dd>" + n + "</dd><dt>Renting</dt><dd>" + esc(itemsText()) +
      "</dd><dt>Estimate</dt><dd>" + (est == null ? "We'll confirm your total by email" : esc(money(est)) + " before sales tax and any delivery fee we confirm") + "</dd></dl>";
  }
  function shiftMonth(delta) {
    var d = toDate(viewMonth); d.setUTCMonth(d.getUTCMonth() + delta); viewMonth = toIso(d).slice(0, 8) + "01"; renderCal();
  }
  function pickDay(iso) {
    var msg = $("#bookMsg");
    setMsg(msg, "", "");
    if (!sel.start || sel.end || iso <= sel.start) { sel = { start: iso, end: null }; renderCal(); return; }
    for (var d = addDays(sel.start, 1); d <= iso; d = addDays(d, 1)) {
      if (isTaken(d)) { setMsg(msg, "err", "Those dates run across a day that's already taken. Please choose a shorter stay or different dates."); return; }
    }
    var max = Number(info.settings.max_nights || 14);
    if (Math.round((toDate(iso) - toDate(sel.start)) / 86400000) > max) {
      setMsg(msg, "err", "Online bookings are for up to " + max + " nights. Contact us about longer stays."); return;
    }
    sel.end = iso; renderCal();
  }

  // ------------------------------------------------------------ booking steps
  function showPane(name) {
    $$("[data-pane]").forEach(function (el) { el.hidden = el.getAttribute("data-pane") !== String(name); });
    $$("#steps li").forEach(function (li) {
      var n = Number(li.getAttribute("data-step"));
      li.className = name === "done" || n < Number(name) ? "done" : n === Number(name) ? "on" : "";
    });
    $("#steps").hidden = name === "done";
    setMsg($("#bookMsg"), "", "");
    $("#steps").parentNode.scrollIntoView();
  }
  function firstInvalid(form) {
    var bad = $$("input, select, textarea", form).filter(function (el) { return !el.closest(".hp") && !el.checkValidity(); })[0];
    if (bad) bad.focus();
    return bad;
  }
  function val(id) { return ($("#" + id).value || "").trim(); }

  function reviewHtml() {
    var est = estimate();
    var rows = [["Renting", itemsText()], ["Delivery", fmtDate(sel.start)], ["Pickup", fmtDate(sel.end)], ["Nights", nights()], ["Name", val("bName")], ["Phone", val("bPhone")], ["Email", val("bEmail")],
      ["Deliver to", val("bAddr") + ", " + val("bCity") + ", " + val("bState") + " " + val("bZip")], ["Group size", val("bGuests")], ["Occasion", val("bOccasion")],
      ["Notes", val("bNotes")], ["Agreement", "Signed as " + val("aSig")],
      ["Estimate", est == null ? "We'll confirm your total by email" : money(est) + " before sales tax and any delivery fee we confirm"]];
    return "<dl>" + rows.filter(function (r) { return r[1] !== "" && r[1] != null; }).map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("") + "</dl>";
  }
  function sha256(text) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve(null);
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }).catch(function () { return null; });
  }
  function guestUrl(ref) { return location.href.split("#")[0].split("?")[0] + (ref ? "?b=" + encodeURIComponent(ref) : "") + "#agreement"; }

  function sendRequest() {
    var btn = $("#sendRequest"), msg = $("#bookMsg");
    btn.disabled = true; btn.textContent = "Sending…";
    var wtext = W.text();
    sha256(wtext).then(function (hash) {
      var payload = {
        delivery_date: sel.start, pickup_date: sel.end, name: val("bName"), email: val("bEmail"), phone: val("bPhone"),
        address_line: val("bAddr"), city: val("bCity"), state: val("bState"), zip: val("bZip"),
        miles_from_base: val("bMiles"), guest_count: val("bGuests"), occasion: val("bOccasion"), firewood_bundles: val("bWood") || "0",
        product: product, ice_tub: on("bTub"), ice_tub_ice: on("bTubIce"), ice_bath: on("bBath"), ice_bath_ice: on("bBathIce"),
        notes: val("bNotes"), site_confirmed: true, signature: val("aSig"), statements: [true, true, true, true],
        waiver_version: W.version, waiver_sha256: hash, waiver_text: wtext, user_agent: navigator.userAgent, website: val("bWebsite")
      };
      if (preview) return { data: { ok: true, ref: "SF-PREVIEW" }, preview: true };
      return db.rpc("request_booking", { p: payload });
    }).then(function (r) {
      if (r.error) throw r.error;
      setMsg($("#doneMsg"), "", "");
      $("#doneMsg").textContent = r.preview
        ? "Preview only: this is what a customer sees after sending. Nothing was saved or emailed."
        : "Thank you. Your request is in and your booking number is " + r.data.ref + ". We've emailed a copy to " + val("bEmail") + ".";
      $("#guestLink").textContent = guestUrl(r.data.ref);
      showPane("done");
      sel = { start: null, end: null };
      if (!preview) loadInfo();
    }).catch(function (e) {
      setMsg(msg, "err", errText(e));
      if (/(TUB|BATH)_TAKEN/.test((e && e.message) || "")) { loadInfo().then(function () { showPane(1); renderCal(); setMsg($("#bookMsg"), "err", errText(e)); }); }
      if (/DATES_(TAKEN|BLOCKED)/.test((e && e.message) || "")) { sel = { start: null, end: null }; loadInfo().then(function () { showPane(1); setMsg($("#bookMsg"), "err", errText(e)); }); }
    }).then(function () { btn.disabled = false; btn.textContent = "Send request"; });
  }

  // ------------------------------------------------------------ wiring
  function init() {
    if (preview) $("#previewBar").hidden = false;
    $("#agreementBox").innerHTML = W.html();
    $("#agreementFull").innerHTML = W.html();
    applySettings();
    $$('input[name="bProduct"]').forEach(function (r) { r.addEventListener("change", function () { product = r.value; sel = { start: null, end: null }; setMsg($("#bookMsg"), "", ""); renderCal(); }); });
    ["bTub", "bTubIce", "bBath", "bBathIce"].forEach(function (id) { var el = $("#" + id); if (el) el.addEventListener("change", renderSummary); });

    $("#calMonths").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-d]");
      if (b && !b.disabled) pickDay(b.getAttribute("data-d"));
    });
    $("#calPrev").addEventListener("click", function () { shiftMonth(-1); });
    $("#calNext").addEventListener("click", function () { shiftMonth(1); });

    $$("[data-next]").forEach(function (b) {
      b.addEventListener("click", function () {
        var to = b.getAttribute("data-next");
        if (to === "2" && !(sel.start && sel.end)) { setMsg($("#bookMsg"), "err", "Please choose a delivery day and a pickup day first."); return; }
        showPane(to);
      });
    });
    $("#detailsForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (firstInvalid(e.target)) { setMsg($("#bookMsg"), "err", "Please fill in every required field and confirm the three statements about your site."); return; }
      showPane(3);
    });
    $("#agreeForm").addEventListener("submit", function (e) {
      e.preventDefault();
      if (firstInvalid(e.target)) { setMsg($("#bookMsg"), "err", ERR.WAIVER_NOT_SIGNED); return; }
      if (val("aSig").toLowerCase().replace(/\s+/g, " ") !== val("bName").toLowerCase().replace(/\s+/g, " ")) {
        setMsg($("#bookMsg"), "err", "Your signature needs to match the name you gave: " + val("bName") + "."); $("#aSig").focus(); return;
      }
      $("#reviewBox").innerHTML = reviewHtml();
      showPane(4);
    });
    $("#sendRequest").addEventListener("click", sendRequest);

    $("#contactForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, msg = $("#contactMsg");
      if (firstInvalid(f)) { setMsg(msg, "err", "Please add your name, a valid email and your question."); return; }
      var p = { name: val("cName"), email: val("cEmail"), phone: val("cPhone"), message: val("cMessage"), website: val("cWebsite") };
      var done = function () { f.reset(); setMsg(msg, "ok", preview ? "Preview only: a customer would see a thank-you here. Nothing was sent." : "Thank you. Your message is with us and we've emailed you a confirmation."); };
      if (preview) { done(); return; }
      db.rpc("submit_inquiry", { p: p }).then(function (r) { if (r.error) throw r.error; done(); }).catch(function (err) { setMsg(msg, "err", errText(err)); });
    });

    $("#guestForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, msg = $("#guestMsg");
      if (firstInvalid(f)) { setMsg(msg, "err", "Please fill in the booking number and your name, tick both statements and type your name to sign."); return; }
      if (val("gSig").toLowerCase().replace(/\s+/g, " ") !== val("gName").toLowerCase().replace(/\s+/g, " ")) { setMsg(msg, "err", "Your signature needs to match your name."); return; }
      var wtext = W.text();
      sha256(wtext).then(function (hash) {
        var p = { ref: val("gRef"), name: val("gName"), email: val("gEmail"), minors: val("gMinors"), signature: val("gSig"), statements: [true, true],
          waiver_version: W.version, waiver_sha256: hash, waiver_text: wtext, user_agent: navigator.userAgent, website: val("gWebsite") };
        if (preview) return { data: { ok: true } };
        return db.rpc("sign_guest_waiver", { p: p });
      }).then(function (r) {
        if (r.error) throw r.error;
        f.reset(); setMsg(msg, "ok", preview ? "Preview only: a guest would see a confirmation here. Nothing was saved." : "Signed. Thank you, you're all set.");
      }).catch(function (err) { setMsg(msg, "err", errText(err)); });
    });

    ["bMiles", "bWood", "bGuests"].forEach(function (id) { $("#" + id).addEventListener("input", renderSummary); });
    // A guest link carries the booking number (?b=SF-XXXXXX), so guests don't have to type it.
    var linkRef = (new URLSearchParams(location.search).get("b") || "").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 20);
    if (linkRef && $("#gRef")) { $("#gRef").value = linkRef; $("#gRef").readOnly = true; }
    // Occasions: tap one to see how it tends to go, then carry it into the booking form.
    var OCC = [
      { t: "Cabin weekends", opt: "Cabin weekend", p: "Park it by the lake and make the sauna the centre of the stay. Fire it up in the afternoon and let people drift in and out all evening.", l: ["Two or three nights gives everyone a turn", "Set it near the water for the walk to the dock", "Add a few firewood bundles for long evenings"] },
      { t: "Family gatherings", opt: "Family gathering", p: "Reunions, holidays and birthdays, with something to do besides eat. Grandparents and teenagers tend to find their own rounds.", l: ["Works well in a driveway or back yard", "A parent stays inside with any children", "Plan turns so no one waits in the cold"] },
      { t: "Weddings and celebrations", opt: "Wedding or celebration", p: "A quiet place for the wedding party the day before, or a slow morning after. It gives a celebration somewhere calm to land.", l: ["Deliver the day before so it is ready", "Check with your venue about a wood stove on site", "Save the toasts for after the last round"] },
      { t: "Retreats and teams", opt: "Retreat or team event", p: "A reset between sessions that people will actually remember. Small groups rotate through while the rest of the day carries on.", l: ["Run it in rounds of six or seven", "Every adult signs the agreement before using it", "Pair it with a fire pit for the people waiting"] },
      { t: "Hunting and ice-fishing camp", opt: "Hunting or fishing camp", p: "Warm up properly after a long day in the cold. Nothing ends a day in the stand or on the ice like real heat.", l: ["We need a plowed, level spot to set it down", "No power hookup needed", "Light it before the last light and it is ready when you are back"] },
      { t: "After the race", opt: "Race or sporting event", p: "Heat for tired legs after a ski, a ride or a long run. Bring it to the cabin where the team is staying.", l: ["Drink water before and between rounds", "Short rounds beat one long one", "Book early for race weekends"] }
    ];
    var occPanel = $("#occPanel");
    function showOcc(i) {
      var o = OCC[i];
      $$(".occ-tab").forEach(function (b) { b.setAttribute("aria-selected", String(Number(b.getAttribute("data-occ")) === i)); });
      occPanel.innerHTML = "<div><h3>" + esc(o.t) + "</h3><p>" + esc(o.p) + '</p><p style="margin-top:20px"><button class="btn" type="button" id="occBook">Check dates for this</button></p></div>' +
        '<div><p class="eyebrow">Good to know</p><ul>' + o.l.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul></div>";
      occPanel.style.animation = "none"; void occPanel.offsetWidth; occPanel.style.animation = "";
      $("#occBook").addEventListener("click", function () { $("#bOccasion").value = o.opt; location.hash = "#book"; });
    }
    $("#occ").addEventListener("click", function (e) { var b = e.target.closest(".occ-tab"); if (b) showOcc(Number(b.getAttribute("data-occ"))); });
    showOcc(0);

    // Phone menu: a button fixed at the bottom that opens the navigation from anywhere.
    var fab = $("#fab"), sheet = $("#sheet"), back = $("#sheetBack");
    var burger = $("#burger");
    function setSheet(open) {
      sheet.hidden = !open; back.hidden = !open;
      fab.setAttribute("aria-expanded", String(open)); burger.setAttribute("aria-expanded", String(open));
    }
    fab.addEventListener("click", function () { setSheet(sheet.hidden); });
    burger.addEventListener("click", function () { setSheet(sheet.hidden); });
    back.addEventListener("click", function () { setSheet(false); });
    sheet.addEventListener("click", function (e) { if (e.target.closest("a")) setSheet(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) { setSheet(false); fab.focus(); } });

    var themeBtn = $("#themeBtn");
    var paintTheme = function () {
      var light = document.documentElement.getAttribute("data-theme") === "light";
      $("#themeLabel").textContent = light ? "Dark" : "Light";
      themeBtn.setAttribute("aria-label", "Switch to " + (light ? "dark" : "light") + " version");
    };
    themeBtn.addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("stillfire-theme", next); } catch (e) {}
      paintTheme();
    });
    paintTheme();
    window.addEventListener("hashchange", route);
    watchHeroLogo();
    route();
    loadInfo();
  }

  var SF = window.SF = {
    db: db, preview: preview, esc: esc, money: money, fmtDate: fmtDate, addDays: addDays, setMsg: setMsg, $: $, $$: $$,
    today: function () { return info.today; }, reloadInfo: loadInfo
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
