// config/tradesafeFees.js
module.exports = {
  VAT_RATE: parseFloat(process.env.VAT_RATE) || 0.15,

  ESTIMATED_TRADESAFE_FEE_RATE_EX_VAT:
    parseFloat(process.env.ESTIMATED_TRADESAFE_FEE_RATE_EX_VAT) || 0.0,

  FEE_BASE: process.env.TRADESAFE_FEE_BASE || "TOTAL_WITH_CREATREND_FEES",

  PAYMENT_METHOD_SELECTION_ENABLED: true,

  PAYMENT_METHODS: {
    EFT: {
      label: "Manual / EFT",
      rateExVat: parseFloat(process.env.EFT_RATE_EX_VAT) || 0.0075,
      min: 0,
      max: null,
      tradeSafeCode: "EFT",              // ✅ Correct
      enabled: true,
    },
    OZOW: {
      label: "Ozow / Instant EFT",
      rateExVat: parseFloat(process.env.OZOW_RATE_EX_VAT) || 0.015,
      min: 50,
      max: 2000000,
      tradeSafeCode: "OZOW",             // ✅ Correct
      enabled: true,
    },
    CARD: {
      label: "Card (Visa/Mastercard)",
      rateExVat: parseFloat(process.env.CARD_RATE_EX_VAT) || 0.025,
      min: 50,
      max: 25000,
      tradeSafeCode: "CARD",             // ✅ Correct
      enabled: true,
    },
    SNAPSCAN: {
      label: "SnapScan",
      rateExVat: parseFloat(process.env.SNAPSCAN_RATE_EX_VAT) || 0.035,
      min: 50,
      max: 25000,
      tradeSafeCode: "SNAPSCAN",         // ✅ FIXED (was "SNAP")
      enabled: true,
    },
    RCS: {
      label: "RCS",
      rateExVat: parseFloat(process.env.RCS_RATE_EX_VAT) || 0.0275,
      min: 50,
      max: 25000,
      tradeSafeCode: "RCS",              // ✅ Correct
      enabled: false,
    },
    DINERS: {
      label: "Diners Club",
      rateExVat: parseFloat(process.env.DINERS_RATE_EX_VAT) || 0.025,
      min: 50,
      max: 25000,
      tradeSafeCode: "DINERS",           // ✅ Correct
      enabled: false,
    },
    PAYJUSTNOW: {
      label: "PayJustNow",
      rateExVat: parseFloat(process.env.PAYJUSTNOW_RATE_EX_VAT) || 0.0525,
      min: 1250,
      max: 100000,
      tradeSafeCode: "PJN",              // ✅ Correct
      enabled: false,
    },
  },
};