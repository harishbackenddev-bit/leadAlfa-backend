

const { sequelize } = require("../config/database");
const CampaignInvoice = require("../models/campaigns/campaignInvoice.model");
const {
  VIDEO_LENGTH_PACKAGES,
  ADD_ONS,
  PLATFORM_SERVICE_FEE_PERCENT,
  SARS_VAT_PERCENT,
  VALID_VIDEO_LENGTHS,
  VALID_ADD_ON_KEYS,
} = require("../config/pricingConstants");
const AppError = require("../utils/appError");


const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;


const calculateInvoice = (videoLength, numberOfCreators, addOns = []) => {

  if (!videoLength || !VALID_VIDEO_LENGTHS.includes(videoLength)) {
    throw new AppError(
      `Invalid video length. Must be one of: ${VALID_VIDEO_LENGTHS.join(", ")}.`,
      400
    );
  }

  const creators = parseInt(numberOfCreators, 10);
  if (isNaN(creators) || creators < 1) {
    throw new AppError("numberOfCreators must be a positive integer of at least 1.", 400);
  }

  const safeAddOns = Array.isArray(addOns) ? addOns : [];
  const invalidKeys = safeAddOns.filter((k) => !VALID_ADD_ON_KEYS.includes(k));
  if (invalidKeys.length > 0) {
    throw new AppError(
      `Invalid add-on key(s): ${invalidKeys.join(", ")}. Valid keys: ${VALID_ADD_ON_KEYS.join(", ")}.`,
      400
    );
  }


  const basePackagePrice = VIDEO_LENGTH_PACKAGES[videoLength].pricePerCreator;
  const basePackageTotal = round2(basePackagePrice * creators);

  const addOnsPercentage = safeAddOns.reduce(
    (sum, key) => sum + ADD_ONS[key].percentage,
    0
  );
  const addOnsAmount = round2(basePackageTotal * (addOnsPercentage / 100));

  const cartSubtotal = round2(basePackageTotal + addOnsAmount);

  const serviceFeeAmount = round2(cartSubtotal * (PLATFORM_SERVICE_FEE_PERCENT / 100));
  const amountBeforeTax  = round2(cartSubtotal + serviceFeeAmount);

  const vatAmount      = round2(amountBeforeTax * (SARS_VAT_PERCENT / 100));
  const totalAmountDue = round2(amountBeforeTax + vatAmount);

  return {
    videoLength,
    numberOfCreators:  creators,
    appliedAddOns:     safeAddOns,
    basePackagePrice,
    basePackageTotal,
    addOnsPercentage,
    addOnsAmount,
    cartSubtotal,
    serviceFeeAmount,
    amountBeforeTax,
    vatAmount,
    totalAmountDue,
  };
};


const syncInvoice = async (campaign, transaction) => {
  if (!campaign || !campaign.id) {
    throw new AppError("syncInvoice requires a valid saved Campaign instance.", 500);
  }

  if (campaign.compensationType !== "Cash") return null;

  if (!campaign.videoLength) return null;

  const existing = await CampaignInvoice.findOne({
    where: { campaignId: campaign.id },
    transaction,
  });

  if (existing && ["pending", "paid"].includes(existing.paymentStatus)) {
    return existing;
  }

  const breakdown = calculateInvoice(
    campaign.videoLength,
    campaign.numberOfCreators,
    campaign.addOns      
  );

  if (existing) {
    await existing.update(breakdown, { transaction });
    return existing.reload({ transaction });
  }

  return CampaignInvoice.create(
    { campaignId: campaign.id, ...breakdown },
    { transaction }
  );
};


const lockInvoice = async (invoiceId, gatewayReference, transaction) => {
  const invoice = await CampaignInvoice.findOne({
    where: { id: invoiceId },
    lock: transaction.LOCK.UPDATE, 
    transaction,
  });

  if (!invoice) {
    throw new AppError("Invoice not found.", 404);
  }

  if (invoice.paymentStatus === "paid") {
    throw new AppError("This campaign has already been paid for.", 409);
  }

  if (invoice.paymentStatus === "pending") {
    throw new AppError(
      "A payment is already in progress for this campaign. Please wait for it to resolve.",
      409
    );
  }

  await invoice.update(
    { paymentStatus: "pending", gatewayReference },
    { transaction }
  );

  return invoice;
};


const markInvoicePaid = async (gatewayReference, rawPayload, transaction) => {
  const invoice = await CampaignInvoice.findOne({
    where: { gatewayReference },
    lock: transaction.LOCK.UPDATE,   
    transaction,
  });

  if (!invoice) {
    throw new AppError(
      `No invoice found for gateway reference: ${gatewayReference}`,
      404
    );
  }

  if (invoice.paymentStatus === "paid") return invoice;

  await invoice.update(
    {
      paymentStatus:  "paid",
      paidAt:         new Date(),
      gatewayPayload: rawPayload,
    },
    { transaction }
  );

  return invoice;
};


const markInvoiceFailed = async (gatewayReference, rawPayload, transaction) => {
  const invoice = await CampaignInvoice.findOne({
    where: { gatewayReference },
    lock: transaction.LOCK.UPDATE,   
    transaction,
  });

  if (!invoice) {
    throw new AppError(
      `No invoice found for gateway reference: ${gatewayReference}`,
      404
    );
  }

  if (invoice.paymentStatus === "failed") return invoice;

  await invoice.update(
    {
      paymentStatus:  "failed",
      gatewayPayload: rawPayload,
    },
    { transaction }
  );

  return invoice;
};


const getInvoiceByCampaignId = async (campaignId) => {
  const invoice = await CampaignInvoice.findOne({ where: { campaignId } });
  if (!invoice) return null;

  const data = invoice.toJSON();

  return {
    ...data,
    basePackagePrice:  parseFloat(data.basePackagePrice),
    basePackageTotal:  parseFloat(data.basePackageTotal),
    addOnsAmount:      parseFloat(data.addOnsAmount),
    cartSubtotal:      parseFloat(data.cartSubtotal),
    serviceFeeAmount:  parseFloat(data.serviceFeeAmount),
    amountBeforeTax:   parseFloat(data.amountBeforeTax),
    vatAmount:         parseFloat(data.vatAmount),
    totalAmountDue:    parseFloat(data.totalAmountDue),
    creatorVisibleBudget: parseFloat(data.cartSubtotal),
  };
};

module.exports = {
  calculateInvoice,
  syncInvoice,
  lockInvoice,
  markInvoicePaid,
  markInvoiceFailed,
  getInvoiceByCampaignId,
};
