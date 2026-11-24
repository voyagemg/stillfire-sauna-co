// Stillfire Sauna Co. — site configuration.
// Prices, service area and contact details are NOT set here: the owner edits those
// in the dashboard (Owner sign-in > Settings) and the site updates on its own.
window.STILLFIRE = {
  // Booking database. Both values are safe to publish: the key only allows the
  // public booking functions, never direct access to customer records.
  supabaseUrl: "",
  supabaseKey: "",

  // Change the version whenever the agreement wording changes. Every signature
  // records the version and the full text that was signed.
  waiverVersion: "2026-11-23.1",

  // Fill these in after the attorney review. They are inserted into the agreement.
  legal: {
    entity: "[LEGAL ENTITY NAME]",
    address: "[BUSINESS ADDRESS]",
    clearanceFt: "[CLEARANCE FT]",
    maxTemp: "[MAX TEMP]",
    maxOccupancy: "[MAX OCCUPANCY]",
    minAge: "[MINIMUM AGE]",
    deposit: "[DEPOSIT AMOUNT]",
    cleaningFee: "[CLEANING FEE]",
    lostRentalRate: "[LOST-RENTAL DAILY RATE]",
    cancellation: "[CANCELLATION TERMS]",
    county: "[COUNTY]"
  }
};
