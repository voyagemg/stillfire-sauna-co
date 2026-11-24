// Stillfire Sauna Co. — site configuration.
// Prices, service area and contact details are NOT set here: the owner edits those
// in the dashboard (Owner sign-in > Settings) and the site updates on its own.
window.STILLFIRE = {
  // Booking database. Both values are safe to publish: the key only allows the
  // public booking functions, never direct access to customer records.
  supabaseUrl: "",
  supabaseKey: "",

  // Shown until the booking database answers, and whenever a dashboard setting is left empty.
  defaults: {
    base_town: "Perham",
    first_night_price: 300,
    additional_night_price: 250,
    free_delivery_miles: 30,
    per_mile_fee: 2.5,
    damage_deposit: 500,
    firewood_bundle_price: 15
  },

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
    deposit: "$500",
    cleaningFee: "[CLEANING FEE]",
    lostRentalRate: "[LOST-RENTAL DAILY RATE]",
    cancellation: "[CANCELLATION TERMS]",
    county: "[COUNTY]"
  }
};
