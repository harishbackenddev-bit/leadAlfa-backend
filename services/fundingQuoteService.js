// services/fundingQuoteService.js
const {
  VAT_RATE,
  ESTIMATED_TRADESAFE_FEE_RATE_EX_VAT,
  FEE_BASE,
  PAYMENT_METHODS,
} = require("../config/tradesafeFees");
const Invoice = require("../models/campaigns/campaignInvoice.model");
const AppError = require("../utils/appError");

// ============================================================
// ✅ Calculate estimated TradeSafe fee (flat 5.5%)
// ============================================================
const calculateEstimatedTradeSafeFee = (feeBase) => {
  const base = parseFloat(feeBase);
  if (base <= 0) throw new AppError("Invalid fee base", 400);

  const feeExVat = base * ESTIMATED_TRADESAFE_FEE_RATE_EX_VAT;
  const feeVat = feeExVat * VAT_RATE;
  const feeInclVat = feeExVat + feeVat;

  return {
    rateExVat: ESTIMATED_TRADESAFE_FEE_RATE_EX_VAT,
    feeBase: base,
    feeExVat: Number(feeExVat.toFixed(2)),
    feeVat: Number(feeVat.toFixed(2)),
    feeInclVat: Number(feeInclVat.toFixed(2)),
  };
};

// ============================================================
// ✅ Generate estimated funding quote (no payment method)
// ============================================================
const generateEstimatedFundingQuote = async (campaign) => {
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

  // ✅ Fee base
  const feeBase =
    FEE_BASE === "CAMPAIGN_AMOUNT" ? campaignAmount : invoiceTotal;

  // ✅ Flat 5.5% estimate
  const feeData = calculateEstimatedTradeSafeFee(feeBase);

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
    // ✅ Estimated TradeSafe fee
    tradesafeRateExVat: feeData.rateExVat,
    tradesafeFeeBase: feeData.feeBase,
    tradesafeFeeExVat: feeData.feeExVat,
    tradesafeFeeVat: feeData.feeVat,
    tradesafeFeeInclVat: feeData.feeInclVat,
    totalAmountDue: Number(totalAmountDue.toFixed(2)),
    isEstimated: true,
    estimateNote:
      "TradeSafe fee is an estimate based on 5.5%. Final amount depends on payment method selected at TradeSafe.",
    quoteVersion: `${campaign.id}-${Date.now()}`,
    quotedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
};

// ============================================================
// ⚠️ Payment method selection — KEPT FOR FUTURE USE
// Comment out but don't delete
// ============================================================
/*
const calculateTradeSafeFeeByMethod = (campaignAmount, paymentMethodCode) => {
  const method = PAYMENT_METHODS[paymentMethodCode];
  if (!method) throw new AppError("Invalid payment method", 400);
  if (!method.enabled) throw new AppError("Payment method not available", 400);

  const amount = parseFloat(campaignAmount);
  if (method.min && amount < method.min) {
    throw new AppError(`${method.label} minimum is R${method.min}`, 400);
  }
  if (method.max && amount > method.max) {
    throw new AppError(`${method.label} maximum is R${method.max}`, 400);
  }

  const feeBase = FEE_BASE === "CAMPAIGN_AMOUNT" ? amount : amount * 1.05;
  const feeExVat = feeBase * method.rateExVat;
  const feeVat = feeExVat * VAT_RATE;
  const feeInclVat = feeExVat + feeVat;

  return {
    rateExVat: method.rateExVat,
    feeBase,
    feeExVat: Number(feeExVat.toFixed(2)),
    feeVat: Number(feeVat.toFixed(2)),
    feeInclVat: Number(feeInclVat.toFixed(2)),
  };
};

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
*/

module.exports = {
  generateEstimatedFundingQuote,
  calculateEstimatedTradeSafeFee,
  // ❌ Commented out for later
  // calculateTradeSafeFeeByMethod,
  // getAvailablePaymentMethods,
};