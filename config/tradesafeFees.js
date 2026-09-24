// config/tradesafeFees.js
module.exports = {
  // ============================================================
  // ✅ All values configurable via .env
  // ============================================================

  VAT_RATE: parseFloat(process.env.VAT_RATE) || 0.15,

  // Estimated TradeSafe processing fee
  // ⚠️ Update .env when TradeSafe confirms final fee structure
  ESTIMATED_TRADESAFE_FEE_RATE_EX_VAT:
    parseFloat(process.env.ESTIMATED_TRADESAFE_FEE_RATE_EX_VAT) || 0.0,

  // Fee base:
  // "CAMPAIGN_AMOUNT" — fee on campaign budget only
  // "TOTAL_WITH_CREATREND_FEES" — fee on invoice total (recommended)
  FEE_BASE: process.env.TRADESAFE_FEE_BASE || "TOTAL_WITH_CREATREND_FEES",

  // Payment method selection DISABLED for now
  PAYMENT_METHOD_SELECTION_ENABLED:
    process.env.PAYMENT_METHOD_SELECTION_ENABLED === "true",

  // Kept for future use — not used currently
  PAYMENT_METHODS: {
    EFT: {
      label: "Manual / EFT",
      rateExVat: parseFloat(process.env.EFT_RATE_EX_VAT) || 0.0075,
      min: 0,
      max: null,
      tradeSafeCode: "EFT",
      enabled: true,
    },
    OZOW: {
      label: "Ozow / Instant EFT",
      rateExVat: parseFloat(process.env.OZOW_RATE_EX_VAT) || 0.015,
      min: 50,
      max: 2000000,
      tradeSafeCode: "OZOW",
      enabled: true,
    },
    CARD: {
      label: "Card (Visa/Mastercard)",
      rateExVat: parseFloat(process.env.CARD_RATE_EX_VAT) || 0.03,
      min: 50,
      max: 25000,
      tradeSafeCode: "CARD",
      enabled: true,
    },
    SNAPSCAN: {
      label: "SnapScan",
      rateExVat: parseFloat(process.env.SNAPSCAN_RATE_EX_VAT) || 0.035,
      min: 50,
      max: 25000,
      tradeSafeCode: "SNAP",
      enabled: true,
    },
  },
};