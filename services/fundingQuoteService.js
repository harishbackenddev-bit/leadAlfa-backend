// services/fundingQuoteService.js
const {
  VAT_RATE,
  FEE_BASE,
  PAYMENT_METHODS,
} = require("../config/tradesafeFees");
const Invoice = require("../models/campaigns/campaignInvoice.model");
const AppError = require("../utils/appError");

// ============================================================
// ✅ Calculate gateway-specific TradeSafe fee
// No 0.4% — TradeSafe handles internally
// ============================================================
const calculateTradeSafeFee = (feeBase, paymentMethodCode) => {
  const method = PAYMENT_METHODS[paymentMethodCode];
  if (!method) throw new AppError("Invalid payment method", 400);
  if (!method.enabled) throw new AppError(`${method.label} not available`, 400);

  const base = parseFloat(feeBase);
  if (base <= 0) throw new AppError("Invalid fee base", 400);

  // Validate threshold
  if (method.min && base < method.min) {
    throw new AppError(`${method.label} minimum is R${method.min}`, 400);
  }
  if (method.max && base > method.max) {
    throw new AppError(`${method.label} maximum is R${method.max}`, 400);
  }

  // ✅ Gateway fee only
  const feeExVat = base * method.rateExVat;
  const feeVat = feeExVat * VAT_RATE;
  const feeInclVat = feeExVat + feeVat;

  return {
    rateExVat: method.rateExVat,
    feeBase: base,
    feeExVat: Number(feeExVat.toFixed(2)),
    feeVat: Number(feeVat.toFixed(2)),
    feeInclVat: Number(feeInclVat.toFixed(2)),
  };
};

// ============================================================
// ✅ Get available payment methods for amount
// ============================================================
const getAvailablePaymentMethods = (campaignAmount) => {
  const amount = parseFloat(campaignAmount);

  return Object.entries(PAYMENT_METHODS)
    .filter(([_, method]) => {
      if (!method.enabled) return false;
      if (method.min && amount < method.min) return false;
      if (method.max && amount > method.max) return false;
      return true;
    })
    .map(([code, method]) => ({
      code,
      label: method.label,
      min: method.min,
      max: method.max,
      rateExVat: method.rateExVat,
    }));
};

// ============================================================
// ✅ Generate funding quote (method-based)
// ============================================================
const generateFundingQuote = async (campaign, paymentMethodCode) => {
  if (!paymentMethodCode) throw new AppError("Payment method required", 400);

  const invoice = await Invoice.findOne({
    where: { campaignId: campaign.id },
    attributes: [
      "cartSubtotal",
      "serviceFeeAmount",
      "amountBeforeTax",
      "vatAmount",
      "totalAmountDue",
    ],
  });

  if (!invoice) {
    throw new AppError("Invoice not found. Please save the campaign first.", 400);
  }

  const campaignAmount = parseFloat(invoice.cartSubtotal || 0);
  const brandServiceFee = parseFloat(invoice.serviceFeeAmount || 0);
  const amountBeforeTax = parseFloat(invoice.amountBeforeTax || 0);
  const creatrendVat = parseFloat(invoice.vatAmount || 0);
  const invoiceTotal = parseFloat(invoice.totalAmountDue || 0);

  if (campaignAmount <= 0) {
    throw new AppError("Invalid campaign amount", 400);
  }

  const feeBase =
    FEE_BASE === "CAMPAIGN_AMOUNT" ? campaignAmount : invoiceTotal;

  const feeData = calculateTradeSafeFee(feeBase, paymentMethodCode);
  const totalAmountDue = invoiceTotal + feeData.feeInclVat;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);

  return {
    campaignId: campaign.id,
    currency: "ZAR",
    campaignAmount,
    creatrendBrandServiceFee: brandServiceFee,
    creatrendVat,
    amountBeforeTax,
    invoiceTotal,
    paymentMethod: paymentMethodCode,
    paymentMethodLabel: PAYMENT_METHODS[paymentMethodCode]?.label,
    tradesafeRateExVat: feeData.rateExVat,
    tradesafeFeeBase: feeData.feeBase,
    tradesafeFeeExVat: feeData.feeExVat,
    tradesafeFeeVat: feeData.feeVat,
    tradesafeFeeInclVat: feeData.feeInclVat,
    totalAmountDue: Number(totalAmountDue.toFixed(2)),
    isEstimated: false,
    quoteNote: `TradeSafe fee for ${PAYMENT_METHODS[paymentMethodCode]?.label} — official rate.`,
    quoteVersion: `${campaign.id}-${paymentMethodCode}-${Date.now()}`,
    quotedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
};

module.exports = {
  generateFundingQuote,
  calculateTradeSafeFee,
  getAvailablePaymentMethods,
};