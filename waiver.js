// Stillfire Sauna Co. — the rental agreement text shown and signed on the site.
// Keep this wording identical to the attorney-reviewed agreement. **double asterisks** mark bold.
(function () {
  var L = (window.STILLFIRE && window.STILLFIRE.legal) || {};
  var S = [
    { t: "1. Parties and rental", b: [
      { p: "This Rental Agreement, Assumption of Risk, Release and Indemnity (the \"Agreement\") is between " + L.entity + ", doing business as Stillfire Sauna Co., of " + L.address + " (\"Stillfire\", \"we\", \"us\"), and the person who signs as the renter (\"Renter\", \"you\", \"I\")." },
      { ol: [
        "**The equipment.** Stillfire rents you a mobile wood-fired sauna trailer and the accessories delivered with it (together, the \"Sauna\").",
        "**Where and when.** The rental is for the dates and delivery address in your booking confirmation (the \"Site\"). It begins when we finish setup and the walk-through at the Site, and ends when we pick the Sauna up.",
        "**Delivery only, no supervision.** Stillfire delivers, sets up and picks up the Sauna. Stillfire staff are not present during your rental and do not supervise, monitor or operate the Sauna. You operate it yourself and you are in charge of everyone who uses it.",
        "**Who may rent.** You must be at least 18 years old and able to enter a binding contract.",
        "**Users.** \"Users\" means you and every person who enters, uses or is near the Sauna during your rental, invited or not."
      ] }
    ] },
    { t: "2. Your responsibilities", b: [
      { p: "You are responsible for the Sauna, the Site and every User from the end of the delivery walk-through until pickup." },
      { ol: [
        "**A safe site.** You will provide a firm, level spot with clear access for a truck and trailer. In winter you will clear the path and the pad of snow and ice.",
        "**Clearance.** The Sauna must stay at least " + L.clearanceFt + " feet from buildings, vehicles, tents, trees, overhangs, fuel and anything else that can burn.",
        "**Permission.** You confirm that you own the Site or have the owner's permission, and that placing and firing a wood stove there is allowed by local rules, burn restrictions and any association or rental rules.",
        "**Do not move it.** You will not move, tow, unhitch, re-level or modify the Sauna.",
        "**A responsible adult.** A sober adult who attended the walk-through, or whom you have fully instructed, will be present whenever the stove is lit or hot.",
        "**Everyone signs.** Each adult User must sign this Agreement before using the Sauna. A parent or legal guardian must sign for each minor. You are responsible for any User who has not signed.",
        "**Follow the instructions.** You will follow the walk-through, the posted rules, the operating instructions and Section 3.",
        "**Private use only.** You will not sublet the Sauna, charge for its use or use it for a commercial event without Stillfire's written consent.",
        "**Access.** You will give Stillfire access to the Site for delivery, pickup and any service call."
      ] }
    ] },
    { t: "3. Safety rules", b: [
      { p: "Breaking these rules can cause serious injury, death or fire. Stillfire may end the rental without a refund if they are broken." },
      { h: "Stove and fire" },
      { ul: [
        "Burn only dry, untreated firewood supplied or approved by Stillfire. Never burn trash, treated or painted wood, or cardboard.",
        "Never use gasoline, lighter fluid or any other accelerant.",
        "Never leave a fire burning without a responsible adult present. Let the fire burn out before everyone leaves or goes to sleep.",
        "Keep the hot room at or below " + L.maxTemp + ". Do not overload the firebox.",
        "Do not remove ashes or coals. Stillfire handles them at pickup.",
        "Put only clean water on the stones. No oils, alcohol or scents unless Stillfire has approved them.",
        "No candles, smoking, vaping, fireworks, grills, heaters or other open flame in or near the Sauna.",
        "Know where the fire extinguisher is. Call 911 for any fire you cannot put out at once."
      ] },
      { h: "Air and carbon monoxide" },
      { ul: [
        "Never block the vents, chimney or door. Never tamper with or disable the smoke and carbon monoxide alarm.",
        "If the alarm sounds, or anyone has a headache, dizziness, nausea or confusion, everyone leaves immediately and gets fresh air. Call 911.",
        "Never sleep in the Sauna or the changing room."
      ] },
      { h: "People" },
      { ul: [
        "No more than " + L.maxOccupancy + " people in the hot room at once.",
        "No alcohol, cannabis or other drugs before or during use.",
        "No one under " + L.minAge + " in the hot room. Older minors only with their parent or guardian inside with them the whole time.",
        "No one uses the Sauna alone.",
        "Keep sessions short, cool down between rounds and drink water.",
        "No pets, glass or food in the hot room.",
        "The stove, chimney, stones, door glass and nearby metal are hot enough to burn skin instantly. Floors and steps are slippery when wet."
      ] },
      { h: "Cold water and weather" },
      { ul: [
        "Stillfire does not provide, inspect or supervise any lake, river, ice, snow, pool or cold plunge. Using them is entirely at your own risk. Never enter cold water alone, never dive, and stay off ice of unknown thickness.",
        "Stop using the Sauna in lightning, high wind or any weather that makes the Site unsafe."
      ] }
    ] },
    { t: "4. Health warnings", b: [
      { p: "Sauna heat and sudden cold put real stress on the body. Stillfire does not give medical advice and does not screen Users." },
      { p: "Talk to a doctor before using the Sauna if you:" },
      { ul: [
        "are pregnant or may be pregnant;",
        "have heart disease, high or low blood pressure, a history of stroke, fainting or seizures;",
        "have diabetes, a breathing condition, or a condition that affects how you sense heat or sweat;",
        "take medication that affects blood pressure, heart rate, alertness or heat tolerance;",
        "have an implanted medical device, a fever, an infection or an open wound."
      ] },
      { p: "Leave the hot room at once if you feel dizzy, faint, sick, short of breath or unwell, and call 911 in an emergency. You are responsible for deciding whether you and each User, including each minor, are fit to use the Sauna." }
    ] },
    { t: "5. Risks I understand and accept", b: [
      { p: "I understand that using a wood-fired sauna, and cooling off afterwards, involves risks that cannot be removed even with care. They include:" },
      { ul: [
        "burns and scalds from the stove, chimney, stones, steam, hot water and hot surfaces;",
        "heat illness, dehydration, fainting, heart attack, stroke and other medical events;",
        "fire, smoke inhalation and carbon monoxide poisoning;",
        "slips, trips and falls on steps, wet floors, snow and ice;",
        "cold shock, hypothermia and drowning in lakes, ice, snow or cold plunges;",
        "injury from firewood, tools, the trailer, its hitch, jacks and steps;",
        "the actions of other Users, including children and anyone who has been drinking;",
        "delayed emergency help at remote sites;",
        "damage to my property, the Site and nearby property."
      ] },
      { p: "These risks can cause serious injury, permanent disability, death and property damage. I have read the safety rules and health warnings. I am choosing to rent and use the Sauna voluntarily, and **I accept and assume all of these risks, known and unknown, for myself and for each minor I sign for.**" }
    ] },
    { t: "6. Release and waiver of liability", b: [
      { p: "**PLEASE READ CAREFULLY. THIS SECTION GIVES UP LEGAL RIGHTS, INCLUDING THE RIGHT TO SUE.**" },
      { ol: [
        "**Who is released.** The \"Released Parties\" are " + L.entity + ", doing business as Stillfire Sauna Co., and its owners, members, managers, employees, contractors, agents and insurers.",
        "**What I release.** To the fullest extent allowed by Minnesota law, **I release the Released Parties from, and agree not to sue them for, any claim for injury, illness, death, or loss of or damage to property that arises from the delivery, setup, presence, condition or use of the Sauna, INCLUDING ANY CLAIM BASED ON THE ORDINARY NEGLIGENCE OF A RELEASED PARTY.**",
        "**Who is bound.** This release binds me and my spouse, children, heirs, estate, insurers and anyone else who could bring a claim through me.",
        "**Minors.** If I sign for a minor, I give this release for myself and, to the extent the law allows, for the minor. I confirm I am the minor's parent or legal guardian.",
        "**What is not released.** This release does not cover a claim that arises from conduct of a Released Party that is greater than ordinary negligence, such as willful, wanton or intentional misconduct. Minnesota law does not allow those claims to be released, and this Agreement does not try to."
      ] }
    ] },
    { t: "7. Indemnification", b: [
      { p: "**I will defend, indemnify and hold harmless the Released Parties** from every claim, demand, lawsuit, loss, damage, fine and cost, including reasonable attorneys' fees, that is brought by me, a User, a minor I signed for, the Site's owner, a neighbor or anyone else, and that arises from:" },
      { ol: [
        "the presence, use or misuse of the Sauna during my rental;",
        "a breach of this Agreement or its safety rules by me or any User;",
        "fire, smoke, water or other damage to the Site or to nearby property during my rental;",
        "any person who used the Sauna without signing this Agreement;",
        "any lake, ice, pool, cold plunge or other feature at or near the Site."
      ] },
      { p: "**THIS DUTY APPLIES EVEN IF THE CLAIM ALLEGES THE ORDINARY NEGLIGENCE OF A RELEASED PARTY.** It does not apply to the extent a claim is caused by conduct of a Released Party that is greater than ordinary negligence." },
      { p: "I understand that Stillfire's insurance does not cover me, my guests or my property. I am responsible for checking my own homeowner's, renter's or event insurance." }
    ] },
    { t: "8. Damage, loss and cleaning", b: [
      { ol: [
        "**You are responsible for the Sauna.** From the end of the walk-through until pickup, you are responsible for loss of or damage to the Sauna beyond normal wear, whoever causes it. This includes damage to the stove, glass, benches, floor, trailer, tires and accessories, and theft or vandalism.",
        "**What you pay.** You will pay the reasonable cost to repair or replace what is damaged or lost, plus " + L.lostRentalRate + " for each day the Sauna cannot be rented while it is repaired, up to 30 days.",
        "**Damage deposit.** Stillfire holds a refundable deposit of " + L.deposit + ". We refund it after inspecting the Sauna at pickup, less any amount owed under this section. If the cost is more than the deposit, you owe the difference.",
        "**Cleaning.** Remove your trash and belongings. If the Sauna needs more than ordinary cleaning, a cleaning fee of " + L.cleaningFee + " applies.",
        "**Report problems.** Tell Stillfire right away about any damage, malfunction, alarm or injury. Do not try to repair the Sauna yourself, and stop using it if something seems unsafe."
      ] }
    ] },
    { t: "9. Payment, cancellation and ending the rental", b: [
      { ol: [
        "**Payment.** The rental price, delivery fee, deposit and due dates are in your booking confirmation and invoice. A date is held only once Stillfire has approved the booking and received payment as the invoice requires.",
        "**If you cancel.** " + L.cancellation,
        "**Weather and unsafe sites.** Stillfire may delay, reschedule or cancel a delivery if roads, weather, a burn ban or the Site make it unsafe, or if the Site does not match what you told us. If we cancel for weather or a burn ban, you may choose a new date or a refund of what you paid. If the Site is unsuitable through no fault of ours, the delivery fee is not refunded.",
        "**Ending the rental early.** Stillfire may end the rental and remove the Sauna, without a refund, if the safety rules are broken, the Sauna is being damaged, or it is being used in a way that puts people or property at risk.",
        "**If something goes wrong with the Sauna.** If the Sauna cannot be used because of a fault that is not caused by you or a User, your only remedy is a refund of the rental price for the unused time. Stillfire is not liable for the cost of a spoiled event, travel, lodging or other indirect losses."
      ] }
    ] },
    { t: "10. General terms", b: [
      { ol: [
        "**Minnesota law.** Minnesota law governs this Agreement. Any lawsuit must be brought in the state or federal courts for " + L.county + " County, Minnesota.",
        "**If part is unenforceable.** If a court finds any part of this Agreement void or unenforceable, that part is removed or narrowed as little as needed and the rest stays in force. This applies in particular to Sections 6 and 7.",
        "**Whole agreement.** This Agreement and your booking confirmation are the whole agreement between you and Stillfire. Nothing said in person, by phone, text or email changes it unless Stillfire agrees in writing.",
        "**Electronic signature.** You agree to sign and receive this Agreement electronically. Typing your name and submitting the form has the same effect as signing on paper. Stillfire keeps a record of the name, time, internet address and version of the text you signed.",
        "**Photos.** Stillfire will not use photos of you or your guests in its marketing without asking first.",
        "**Reading and understanding.** I have read this whole Agreement. I understand that I am giving up legal rights, including the right to sue for ordinary negligence, and that I am agreeing to pay for damage and to indemnify Stillfire. I am signing freely."
      ] }
    ] }
  ];

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function rich(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>"); }
  function plain(s) { return String(s).replace(/\*\*/g, ""); }

  function html() {
    return S.map(function (sec) {
      return "<h3>" + esc(sec.t) + "</h3>" + sec.b.map(function (b) {
        if (b.p) return "<p>" + rich(b.p) + "</p>";
        if (b.h) return "<h4>" + esc(b.h) + "</h4>";
        var tag = b.ol ? "ol" : "ul";
        return "<" + tag + ">" + (b.ol || b.ul).map(function (i) { return "<li>" + rich(i) + "</li>"; }).join("") + "</" + tag + ">";
      }).join("");
    }).join("");
  }
  function text() {
    return S.map(function (sec) {
      return sec.t.toUpperCase() + "\n" + sec.b.map(function (b) {
        if (b.p) return plain(b.p);
        if (b.h) return plain(b.h) + ":";
        return (b.ol || b.ul).map(function (i, n) { return (b.ol ? (n + 1) + ". " : "- ") + plain(i); }).join("\n");
      }).join("\n");
    }).join("\n\n");
  }
  window.STILLFIRE_WAIVER = { html: html, text: text, version: (window.STILLFIRE && window.STILLFIRE.waiverVersion) || "unversioned" };
})();
