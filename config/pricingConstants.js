
// ---------------------------------------------------------------------------
// Video length base packages (ZAR per creator slot)
// ---------------------------------------------------------------------------

const VIDEO_LENGTH_PACKAGES = {
  "15sec": { label: "15 Seconds", pricePerCreator: 1250.00 },
  "30sec": { label: "30 Seconds", pricePerCreator: 1950.00 },
  "60sec": { label: "60 Seconds", pricePerCreator: 2850.00 },
};

// ---------------------------------------------------------------------------
// Add-ons (percentage applied to basePackageTotal)
// ---------------------------------------------------------------------------

const ADD_ONS = {
  raw_footage:          { label: "Raw Footage",              percentage: 30 },
  usage_rights_30_day:  { label: "30-Day Paid Usage Rights", percentage: 40 },
  extra_hooks:          { label: "Extra Hooks / Variations", percentage: 25 },
  still_images:         { label: "Still Images",             percentage: 20 },
};


/** Platform service fee: 5% of cart subtotal. Not visible to creators. */
const PLATFORM_SERVICE_FEE_PERCENT = 5;

/** SARS VAT: 15% of amount before tax (cartSubtotal + serviceFee). */
const SARS_VAT_PERCENT = 15;


const VALID_VIDEO_LENGTHS = Object.keys(VIDEO_LENGTH_PACKAGES); // ["15sec","30sec","60sec"]
const VALID_ADD_ON_KEYS   = Object.keys(ADD_ONS);               // ["raw_footage", ...]

module.exports = {
  VIDEO_LENGTH_PACKAGES,
  ADD_ONS,
  PLATFORM_SERVICE_FEE_PERCENT,
  SARS_VAT_PERCENT,
  VALID_VIDEO_LENGTHS,
  VALID_ADD_ON_KEYS,
};
