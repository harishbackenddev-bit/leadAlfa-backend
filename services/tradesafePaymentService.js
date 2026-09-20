// services/tradesafePaymentService.js
const { sequelize } = require("../config/database");
const { Op, fn, col, where, QueryTypes } = require("sequelize");
const Campaign = require("../models/campaigns/campaign.model");
const CampaignApplication = require("../models/campaigns/campaignApplication.model");
const Invoice = require("../models/campaigns/campaignInvoice.model");
const User = require("../models/user.model");
const Transaction = require("../models/transaction/transaction.model");
const FundingBatch = require("../models/transaction/fundingBatch.model");
const tradesafeService = require("./tradesafe.service");
const AppError = require("../utils/appError");
const BrandProfile = require('../models/brandProfile/brandProfile.model');
const CreatorProfile = require('../models/creatorProfile/creatorProfile.model');
const { generateEstimatedFundingQuote } = require("./fundingQuoteService");

const { PAYMENT_METHODS } = require("../config/tradesafeFees");
// const CREATOR_COMMISSION_RATE = 0.20;
// const BRAND_SERVICE_FEE_RATE = 0.05;

const CREATOR_COMMISSION_RATE = parseFloat(process.env.CREATOR_COMMISSION_RATE) || 0.20;
const BRAND_SERVICE_FEE_RATE = parseFloat(process.env.BRAND_SERVICE_FEE_RATE) || 0.05;

// ============================================================
// Reconciliation guard
// ============================================================
function assertReconciled({ totalCreatorBudget, totalCommission, totalBrandFee, creatorDetails }) {
  const sumGross = creatorDetails.reduce((s, c) => s + c.grossAmountCents, 0);
  const sumNet = creatorDetails.reduce((s, c) => s + c.creatorNetCents, 0);
  const sumCommission = creatorDetails.reduce((s, c) => s + c.commissionCents, 0);
  const sumBrandFee = creatorDetails.reduce((s, c) => s + c.brandFeeCents, 0);

  if (sumNet + sumCommission !== sumGross) {
    throw new AppError(`Reconciliation failed: creatorNet + commission != gross`, 500);
  }
  if (sumGross !== Math.round(totalCreatorBudget * 100)) {
    throw new AppError(`Reconciliation failed: gross mismatch`, 500);
  }
  if (sumCommission !== Math.round(totalCommission * 100)) {
    throw new AppError(`Reconciliation failed: commission mismatch`, 500);
  }
  if (sumBrandFee !== Math.round(totalBrandFee * 100)) {
    throw new AppError(`Reconciliation failed: brand fee mismatch`, 500);
  }
}

// ============================================================
// Shared read
// ============================================================
const fetchAcceptedApplicationsWithVerification = async (campaignId, transaction = null) => {
  return sequelize.query(
    `
      SELECT
        ca.id AS "applicationId",
        ca."proposedBudget",
        cp.id AS "creatorProfileId",
        cp.email AS "creatorProfileEmail",
        u.id AS "creatorId",
        u."firstName",
        u."lastName",
        u.email,
        u."tradeSafeUserId",
        u."tradeSafeStatus",
        u."bankVerificationStatus"
      FROM "CampaignApplications" ca
      INNER JOIN "CreatorProfiles" cp ON cp.id = ca."creatorId"
      INNER JOIN "Users" u ON LOWER(TRIM(u.email)) = LOWER(TRIM(cp.email))
      WHERE ca."campaignId" = :campaignId
        AND ca."applicationStatus" = 'accepted'
      ORDER BY ca."createdAt" DESC
    `,
    { replacements: { campaignId }, type: QueryTypes.SELECT, transaction }
  );
};

// ============================================================
// 0. GET ACCEPTED CREATORS
// ============================================================
const getAcceptedCreatorsForPayment = async (campaignId, brandId) => {
  const campaign = await Campaign.findOne({
    where: { id: campaignId, brandId, isDeleted: false },
    attributes: ["id", "publicId", "campaignTitle"],
  });
  if (!campaign) throw new AppError("Campaign not found", 404);

  const applications = await fetchAcceptedApplicationsWithVerification(campaignId);

  const creators = applications.map((app) => {
    const isReady = app.tradeSafeStatus === 'VERIFIED' && app.bankVerificationStatus === 'VERIFIED';
    return {
      applicationId: app.applicationId,
      creatorId: app.creatorId,
      name: `${app.firstName} ${app.lastName}`,
      email: app.email,
      proposedBudget: parseFloat(app.proposedBudget) || 0,
      tradeSafeStatus: app.tradeSafeStatus,
      bankVerificationStatus: app.bankVerificationStatus,
      readyForEscrow: isReady,
      blockedReason: isReady ? null : [
        app.tradeSafeStatus !== 'VERIFIED' ? 'TradeSafe identity not verified' : null,
        app.bankVerificationStatus !== 'VERIFIED' ? 'Bank account not verified' : null,
      ].filter(Boolean).join('; '),
    };
  });

  return {
    campaignId,
    campaignPublicId: campaign.publicId,
    totalAccepted: creators.length,
    readyCount: creators.filter((c) => c.readyForEscrow).length,
    blockedCount: creators.filter((c) => !c.readyForEscrow).length,
    creators,
  };
};

// ============================================================
// 0b. SYNC
// ============================================================
const syncAcceptedCreators = async (campaignId, brandId) => {
  const campaign = await Campaign.findOne({
    where: { id: campaignId, brandId, isDeleted: false },
    attributes: ["id"],
  });
  if (!campaign) throw new AppError("Campaign not found", 404);

  const applications = await fetchAcceptedApplicationsWithVerification(campaignId);
  const updated = [];
  const errors = [];

  for (const app of applications) {
    if (!app.tradeSafeUserId) continue;
    try {
      const token = await tradesafeService.getTokenStatus(app.tradeSafeUserId);
      const liveStatus = token ? 'VERIFIED' : app.tradeSafeStatus;
      if (liveStatus !== app.tradeSafeStatus) {
        await User.update({ tradeSafeStatus: liveStatus }, { where: { id: app.creatorId } });
        updated.push({ creatorId: app.creatorId, from: app.tradeSafeStatus, to: liveStatus });
      }
    } catch (error) {
      errors.push({ creatorId: app.creatorId, error: error.message });
    }
  }

  return { campaignId, checked: applications.length, updated, errors };
};

// ============================================================
// EVENT 2: FUND CAMPAIGN WALLET
// ============================================================


const fundCampaign = async (campaignId, brandUserId, options = {}) => {
  const transaction = await sequelize.transaction();

  try {
    const campaign = await Campaign.findOne({
      where: { id: campaignId, brandId: brandUserId, isDeleted: false },
      transaction,
    });
    if (!campaign) throw new AppError("Campaign not found", 404);

    // ✅ Allow retry for AWAITING_FUNDING / FUNDING_FAILED / UNFUNDED
    const fundableStatuses = ['UNFUNDED', 'AWAITING_FUNDING', 'FUNDING_FAILED', 'PENDING_PAYMENT'];
    if (!fundableStatuses.includes(campaign.fundingStatus)) {
      throw new AppError(`Campaign cannot be funded in state: ${campaign.fundingStatus}`, 400);
    }

    const invoice = await Invoice.findOne({
      where: { campaignId: campaign.id },
      transaction,
    });
    if (!invoice) throw new AppError("Invoice not found", 404);

    const baseTotalCents = Math.round(parseFloat(invoice.totalAmountDue) * 100);
    const campaignBudgetCents = Math.round(parseFloat(invoice.cartSubtotal) * 100);
    const brandFeeCents = Math.round(parseFloat(invoice.serviceFeeAmount) * 100);
    const vatCents = Math.round(parseFloat(invoice.vatAmount || 0) * 100);

    // ✅ Generate estimated fee quote (5.5% flat)
    const quote = await generateEstimatedFundingQuote(campaign);
    const tradeSafeFeeCents = Math.round(quote.tradesafeFeeInclVat * 100);

    const totalCents = baseTotalCents + tradeSafeFeeCents;

    if (totalCents <= 0) throw new AppError("Invoice amount invalid", 400);

    // Brand
    const brandDetails = await BrandProfile.findByPk(campaign.brandId, {
      attributes: ["id", "userId", "companyEmail"],
      transaction,
    });
    if (!brandDetails) throw new AppError("Brand profile not found", 404);

    const brand = await User.findByPk(brandDetails.userId, {
      attributes: ["id", "email", "tradeSafeUserId", "tradeSafeStatus"],
      transaction,
    });
    if (!brand) throw new AppError("Brand not found", 404);

    const brandTradeSafeUserId = brand.get("tradeSafeUserId");
    const brandTradeSafeStatus = brand.get("tradeSafeStatus");

    if (brandTradeSafeStatus !== "VERIFIED" || !brandTradeSafeUserId) {
      throw new AppError("Brand not verified with TradeSafe", 400);
    }

    // ✅ NO payment method restriction — TradeSafe handles all methods
    const walletDeposit = await tradesafeService.tokenDeposit(brandTradeSafeUserId, {
      minutes: 60,
      value: Math.ceil(totalCents / 100),   // ✅ Force amount
    });
    if (!walletDeposit?.url) throw new AppError("Failed to generate wallet deposit link", 400);

    const reference = `CAMPAIGN-FUND-${campaign.publicId}-${Date.now()}`;

    // Upsert FundingBatch
    let fundingBatch = await FundingBatch.findOne({
      where: { campaignId: campaign.id, type: 'CAMPAIGN_FUNDING' },
      transaction,
    });

    const batchData = {
      totalValue: totalCents / 100,
      totalValueCents: totalCents,
      brandFee: brandFeeCents / 100,
      brandFeeCents,
      creatorSubtotal: campaignBudgetCents / 100,
      creatorSubtotalCents: campaignBudgetCents,
      tradesafeWalletTokenId: brandTradeSafeUserId,
      checkoutLink: walletDeposit.url,
      checkoutLinkExpiresAt: walletDeposit.expiresAt,
      status: "PENDING_PAYMENT",
      reference,
    };

    if (fundingBatch) {
      await fundingBatch.update(batchData, { transaction });
    } else {
      fundingBatch = await FundingBatch.create({
        campaignId: campaign.id,
        brandUserId: brand.id,
        type: 'CAMPAIGN_FUNDING',
        ...batchData,
        platformFee: brandFeeCents / 100,
        platformFeeCents: brandFeeCents,
      }, { transaction });
    }

    await campaign.update({
      fundingBatchId: fundingBatch.id,
      fundingStatus: 'AWAITING_FUNDING',
      campaignBudgetCents,
      tradeSafeWalletTokenId: brandTradeSafeUserId,
    }, { transaction });

    await transaction.commit();

    return {
      success: true,
      campaignId,
      campaignPublicId: campaign.publicId,
      invoicePublicId: invoice.publicId,
      financialSnapshot: {
        campaignValue: campaignBudgetCents / 100,
        brandFee: brandFeeCents / 100,
        vat: vatCents / 100,
        tradesafeFee: quote.tradesafeFeeInclVat,
        totalAmount: totalCents / 100,
      },
      quote,
      fundingBatch: {
        id: fundingBatch.id,
        reference,
        walletDepositUrl: walletDeposit.url,
        walletDepositExpiresAt: walletDeposit.expiresAt,
        status: "PENDING_PAYMENT",
      },
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

// ============================================================
// CONFIRM CAMPAIGN FUNDED
// ============================================================
const confirmCampaignFunded = async (fundingBatchId, verifiedBalance) => {
  const fundingBatch = await FundingBatch.findByPk(fundingBatchId);
  if (!fundingBatch) throw new AppError("Funding batch not found", 404);

  if (verifiedBalance < parseFloat(fundingBatch.totalValue)) {
    throw new AppError(
      `Wallet balance (${verifiedBalance}) < required (${fundingBatch.totalValue})`,
      400
    );
  }

  const campaign = await Campaign.findByPk(fundingBatch.campaignId);
  if (!campaign) throw new AppError("Campaign not found", 404);

  await fundingBatch.update({
    status: 'FULLY_FUNDED',
    fundedAt: new Date(),
  });

  await campaign.update({
    fundingStatus: 'FUNDS_RECEIVED',
    availableBudgetCents: campaign.campaignBudgetCents,
    status: 'active',
    fundedAt: new Date(),
  });

  // ✅ Update invoice
  const invoice = await Invoice.findOne({
    where: { campaignId: campaign.id },
  });
  if (invoice) {
    await invoice.update({
      paymentStatus: 'paid',
      paidAt: new Date(),
    });
  }

  return { fundingBatch, campaign };
};

// ============================================================
// SANDBOX: SIMULATE CAMPAIGN FUNDED
// ============================================================
const simulateCampaignFundedSandbox = async (fundingBatchId) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Sandbox simulation disabled in production.', 403);
  }

  const fundingBatch = await FundingBatch.findByPk(fundingBatchId);
  if (!fundingBatch) throw new AppError("Funding batch not found", 404);

  await tradesafeService.tokenUpdateBalance({
    id: fundingBatch.tradesafeWalletTokenId,
    value: parseFloat(fundingBatch.totalValue),
    type: 'CREDIT',
  });

  return confirmCampaignFunded(fundingBatchId, parseFloat(fundingBatch.totalValue));
};

// ============================================================
// EVENT 3: RESERVE BUDGET
// ============================================================
const reserveBudgetForCreator = async (campaignId, creatorAmountCents, dbTx) => {
  const campaign = await Campaign.findOne({
    where: { id: campaignId },
    transaction: dbTx,
    lock: dbTx.LOCK.UPDATE,
  });
  if (!campaign) throw new AppError("Campaign not found", 404);

  if (campaign.availableBudgetCents < creatorAmountCents) {
    throw new AppError(
      `Insufficient budget. Available: R${campaign.availableBudgetCents / 100}, Required: R${creatorAmountCents / 100}`,
      400
    );
  }

  await campaign.update({
    availableBudgetCents: campaign.availableBudgetCents - creatorAmountCents,
    reservedBudgetCents: campaign.reservedBudgetCents + creatorAmountCents,
  }, { transaction: dbTx });

  return campaign;
};

// ============================================================
// EVENT 3: CREATE CREATOR ESCROW
// ============================================================
const createCreatorEscrow = async (campaignId, creatorId, creatorAmount, brandUserId) => {
  const transaction = await sequelize.transaction();

  try {
    // ============================================================
    // 1. Campaign
    // ============================================================
    const campaign = await Campaign.findOne({
      where: { id: campaignId, isDeleted: false },
      transaction,
    });
    if (!campaign) throw new AppError("Campaign not found", 404);

    if (!['FUNDS_RECEIVED', 'FUNDED'].includes(campaign.fundingStatus)) {
      throw new AppError("Campaign not funded yet", 400);
    }

    // ============================================================
    // 2. Brand resolve karo — campaign.brandId = BrandProfile.id
    // ============================================================
    const brandProfile = await BrandProfile.findByPk(campaign.brandId, {
      attributes: ["id", "userId", "companyEmail"],
      transaction,
    });
    if (!brandProfile) throw new AppError("Brand profile not found", 404);

    // ✅ companyEmail se User match karo
    const brandUser = await User.findOne({
      where: sequelize.where(
        sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("email"))),
        brandProfile.companyEmail.trim().toLowerCase()
      ),
      attributes: ["id", "email", "tradeSafeUserId", "tradeSafeStatus"],
      transaction,
    });

    if (!brandUser) {
      // Fallback: BrandProfile.userId se lo
      const fallback = await User.findByPk(brandProfile.userId, {
        attributes: ["id", "email", "tradeSafeUserId", "tradeSafeStatus"],
        transaction,
      });
      if (!fallback) throw new AppError("Brand user not found", 404);
      var brand = fallback;
    } else {
      var brand = brandUser;
    }

    const brandTradeSafeUserId = brand.get("tradeSafeUserId");
    const brandTradeSafeStatus = brand.get("tradeSafeStatus");

    console.log("✅ Brand resolved:");
    console.log("   brandProfile.id:", brandProfile.id);
    console.log("   brand.email:", brand.get("email"));
    console.log("   brand.tradeSafeUserId:", brandTradeSafeUserId);
    console.log("   brand.tradeSafeStatus:", brandTradeSafeStatus);

    if (!brandTradeSafeUserId || brandTradeSafeStatus !== "VERIFIED") {
      throw new AppError(
        `Brand not verified. Status: ${brandTradeSafeStatus}`,
        400
      );
    }

    // ============================================================
    // 3. Creator resolve karo
    // ============================================================
    let creator = await User.findByPk(creatorId, {
      attributes: ["id", "firstName", "lastName", "email", "tradeSafeUserId", "tradeSafeStatus"],
      transaction,
    });

    // Agar User nahi mila, toh CreatorProfile se resolve karo
    if (!creator) {
      const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
      const profile = await CreatorProfile.findByPk(creatorId, { transaction });
      if (profile?.email) {
        creator = await User.findOne({
          where: sequelize.where(
            sequelize.fn("LOWER", sequelize.fn("TRIM", sequelize.col("email"))),
            profile.email.trim().toLowerCase()
          ),
          attributes: ["id", "firstName", "lastName", "email", "tradeSafeUserId", "tradeSafeStatus"],
          transaction,
        });
      }
    }

    if (!creator) throw new AppError("Creator not found", 404);

    const creatorTradeSafeUserId = creator.get("tradeSafeUserId");
    const creatorTradeSafeStatus = creator.get("tradeSafeStatus");
    const creatorUserId = creator.get("id");

    console.log("✅ Creator resolved:");
    console.log("   creator.id:", creatorUserId);
    console.log("   creator.email:", creator.get("email"));
    console.log("   creator.tradeSafeUserId:", creatorTradeSafeUserId);

    if (!creatorTradeSafeUserId || creatorTradeSafeStatus !== "VERIFIED") {
      throw new AppError(
        `Creator not verified. Status: ${creatorTradeSafeStatus}`,
        400
      );
    }

    // ✅ Brand aur Creator same nahi hone chahiye
    if (brand.get("id") === creatorUserId) {
      throw new AppError(
        "Brand and Creator cannot be the same user.",
        400
      );
    }

    // ============================================================
    // 4. Existing escrow check
    // ============================================================
    const existing = await Transaction.findOne({
      where: { campaignId, creatorUserId },
      transaction,
    });
    if (existing) throw new AppError("Creator already selected", 400);

    // ============================================================
    // 5. Amounts calculate karo
    // ============================================================
    const creatorAmountCents = Math.round(parseFloat(creatorAmount) * 100);
    const commissionCents = Math.round(creatorAmountCents * CREATOR_COMMISSION_RATE);
    const creatorNetCents = creatorAmountCents - commissionCents;

    await reserveBudgetForCreator(campaignId, creatorAmountCents, transaction);

    // ============================================================
    // 6. TradeSafe transaction create
    // ============================================================
    const AGENT_TOKEN_ID = process.env.TRADESAFE_AGENT_TOKEN_ID;
    if (!AGENT_TOKEN_ID) throw new AppError("TRADESAFE_AGENT_TOKEN_ID missing", 500);

    const parties = {
      create: [
        { token: brandTradeSafeUserId, role: 'BUYER' },
        { token: creatorTradeSafeUserId, role: 'SELLER' },
        {
          token: AGENT_TOKEN_ID,
          role: 'AGENT',
          fee: commissionCents / 100,
          feeType: 'FLAT',
          feeAllocation: 'BUYER',
        },
      ],
    };

    const allocations = {
      create: [{
        title: 'UGC Service',
        description: `Creator payment for campaign: ${campaign.campaignTitle}`,
        value: creatorAmountCents / 100,
        daysToDeliver: 7,
        daysToInspect: 7,
      }],
    };

    const childTx = await tradesafeService.transactionCreate({
      title: `Campaign ${campaign.publicId} - ${creator.get("firstName")} ${creator.get("lastName")}`,
      description: `Creator payment for campaign: ${campaign.campaignTitle}`,
      parties,
      allocations,
      feeAllocation: 'BUYER',
    });

    if (!childTx?.id) throw new AppError("TradeSafe transaction creation failed", 400);

    // ============================================================
    // 7. Transaction record
    // ============================================================
    const escrowRecord = await Transaction.create({
      campaignId: campaign.id,
      brandUserId: brand.get("id"),      // ✅ User ID
      creatorUserId,                      // ✅ User ID
      fundingBatchId: campaign.fundingBatchId,
      tradesafeTransactionId: childTx.id,
      tradesafeAllocationId: childTx.allocations?.[0]?.id || null,
      amountCents: creatorAmountCents,
      amount: creatorAmountCents / 100,
      commissionCents,
      commissionAmount: commissionCents / 100,
      brandFeeCents: 0,
      brandFeeAmount: 0,
      creatorNetCents,
      creatorNetAmount: creatorNetCents / 100,
      agentFeeCents: commissionCents,
      agentFeeAmount: commissionCents / 100,
      brandContributionCents: creatorAmountCents,
      brandContributionAmount: creatorAmountCents / 100,
      allocatedFromCampaignCents: creatorAmountCents,
      reservationStatus: 'RESERVED',
      status: 'CREATED',
      reference: `CAMPAIGN-${campaign.publicId}-CREATOR-${creatorUserId}`,
    }, { transaction });

    await transaction.commit();

    return {
      success: true,
      transactionId: escrowRecord.id,
      tradesafeTransactionId: childTx.id,
      tradesafeAllocationId: childTx.allocations?.[0]?.id || null,
      creatorAmount: creatorAmountCents / 100,
      creatorNet: creatorNetCents / 100,
      commission: commissionCents / 100,
      status: 'CREATED',
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

// ============================================================
// EVENT 3: FUND CREATOR ESCROW
// ============================================================
const fundCreatorEscrow = async (transactionId) => {
  const dbTx = await sequelize.transaction();

  try {
    const escrowTx = await Transaction.findByPk(transactionId, { transaction: dbTx });
    if (!escrowTx) throw new AppError("Transaction not found", 404);

    if (!['CREATED', 'FUNDING_FAILED'].includes(escrowTx.status)) {
      throw new AppError(`Cannot fund: status is ${escrowTx.status}`, 400);
    }

    const IS_SANDBOX = process.env.NODE_ENV !== 'production';

    if (!IS_SANDBOX) {
      await tradesafeService.transactionDepositWallet(escrowTx.tradesafeTransactionId);
    }

    await escrowTx.update({
      status: 'FUNDED',
      fundedAt: new Date(),
      tradesafeFundingStatus: IS_SANDBOX ? 'SANDBOX_FUNDED' : 'FUNDED',
      reservationStatus: 'COMMITTED',
    }, { transaction: dbTx });

    const campaign = await Campaign.findByPk(escrowTx.campaignId, { transaction: dbTx });
    await campaign.update({
      reservedBudgetCents: campaign.reservedBudgetCents - escrowTx.allocatedFromCampaignCents,
      committedBudgetCents: campaign.committedBudgetCents + escrowTx.allocatedFromCampaignCents,
    }, { transaction: dbTx });

    await dbTx.commit();

    return {
      success: true,
      transactionId: escrowTx.id,
      status: 'FUNDED',
      mode: IS_SANDBOX ? 'SANDBOX' : 'PRODUCTION',
    };
  } catch (err) {
    await dbTx.rollback();
    throw err;
  }
};

// ============================================================
// REFUND UNUSED
// ============================================================
const refundUnusedBudget = async (campaignId) => {
  const campaign = await Campaign.findByPk(campaignId);
  if (!campaign) throw new AppError("Campaign not found", 404);

  const unusedCents = campaign.availableBudgetCents;
  if (unusedCents <= 0) return { success: true, refunded: 0, message: 'No unused budget' };

  await campaign.update({
    availableBudgetCents: 0,
    fundingStatus: 'REFUNDED',
  });

  return {
    success: true,
    refunded: unusedCents / 100,
    message: 'Unused budget refunded',
  };
};

// ============================================================
// RELEASE FUNDS TO CREATOR (existing)
// ============================================================
const releaseFundsToCreator = async (campaignId, creatorId, brandUserId) => {
  const transaction = await sequelize.transaction();

  try {
    const creatorProfile = await CreatorProfile.findOne({ where: { id: creatorId }, transaction });
    if (!creatorProfile) throw new AppError(`Creator profile not found`, 404);

    const creatorUser = await User.findOne({
      where: where(fn("LOWER", fn("TRIM", col("email"))), creatorProfile.email.trim().toLowerCase()),
      transaction,
    });
    if (!creatorUser) throw new AppError(`User not found`, 404);

    const realCreatorId = creatorUser.id;

    const campaign = await Campaign.findOne({
      where: { id: campaignId, brandId: brandUserId },
      transaction,
    });
    if (!campaign) throw new AppError("Campaign not found", 404);

    const escrowTx = await Transaction.findOne({
      where: { campaignId, creatorUserId: realCreatorId },
      transaction,
    });
    if (!escrowTx) throw new AppError(`No escrow found`, 404);

    const alreadyReleasedStatuses = ['RELEASED', 'COMPLETED', 'PAYOUT_TRIGGERED'];
    if (alreadyReleasedStatuses.includes(escrowTx.status)) {
      await campaign.update({ releasedCount: (campaign.releasedCount || 0) + 1 }, { transaction });
      await transaction.commit();
      return { success: true, campaignId, creatorId: realCreatorId, status: escrowTx.status };
    }

    if (!["FUNDED", "RELEASE_FAILED"].includes(escrowTx.status)) {
      throw new AppError(`Transaction status ${escrowTx.status}, must be FUNDED`, 400);
    }

    if (!escrowTx.tradesafeAllocationId) throw new AppError("No allocation", 400);

    const allocationId = escrowTx.tradesafeAllocationId;
    const IS_SANDBOX = process.env.NODE_ENV !== 'production';

    if (IS_SANDBOX) {
      await escrowTx.update({
        status: "PAYOUT_TRIGGERED",
        releasedAt: new Date(),
        tradesafeReleaseStatus: "SANDBOX_RELEASED",
      }, { transaction });

      await campaign.update({ releasedCount: (campaign.releasedCount || 0) + 1 }, { transaction });
      await transaction.commit();

      return {
        success: true,
        campaignId,
        creatorId: realCreatorId,
        status: "PAYOUT_TRIGGERED",
        mode: "SANDBOX",
      };
    }

    let allocation = null;
    try { allocation = await tradesafeService.getAllocation(allocationId); } catch (e) { /* noop */ }
    const allocationState = allocation?.state;

    const finalStates = ['ACCEPTED', 'COMPLETED', 'PAID_OUT', 'FUNDS_RELEASED'];
    if (allocationState && finalStates.includes(allocationState)) {
      await escrowTx.update({
        status: "RELEASED", releasedAt: new Date(), tradesafeReleaseStatus: allocationState,
      }, { transaction });
      await campaign.update({ releasedCount: (campaign.releasedCount || 0) + 1 }, { transaction });
      await transaction.commit();
      return { success: true, status: "RELEASED" };
    }

    try {
      await tradesafeService.allocationStartDelivery(allocationId);
      const releaseResult = await tradesafeService.allocationAcceptDelivery(allocationId);

      await escrowTx.update({
        status: "PAYOUT_TRIGGERED",
        releasedAt: new Date(),
        tradesafeReleaseStatus: releaseResult?.state || "ACCEPTED",
      }, { transaction });

      await campaign.update({ releasedCount: (campaign.releasedCount || 0) + 1 }, { transaction });
      await transaction.commit();
      return { success: true, status: "PAYOUT_TRIGGERED" };
    } catch (error) {
      await escrowTx.update({
        status: "RELEASE_FAILED", releaseError: error.message,
      }, { transaction });
      await transaction.commit();
      throw new AppError(`Release failed: ${error.message}`, 502);
    }
  } catch (err) {
    if (!transaction.finished) await transaction.rollback();
    throw err;
  }
};

// ============================================================
// GET CAMPAIGN PAYMENT STATUS
// ============================================================
const getCampaignPaymentStatus = async (campaignId, brandId) => {
  const campaign = await Campaign.findOne({
    where: { id: campaignId, brandId, isDeleted: false },
    attributes: ['id', 'publicId', 'campaignTitle', 'status', 'fundingStatus', 'campaignBudgetCents', 'availableBudgetCents', 'reservedBudgetCents', 'committedBudgetCents'],
  });
  if (!campaign) throw new AppError("Campaign not found", 404);

  const fundingBatch = await FundingBatch.findOne({
    where: { campaignId, type: 'CAMPAIGN_FUNDING' },
    attributes: ['id', 'reference', 'status', 'totalValue', 'platformFee', 'creatorSubtotal', 'checkoutLink', 'createdAt', 'fundedAt', 'fundedCount', 'failedCount'],
  });

  const transactions = await Transaction.findAll({
    where: { campaignId },
    include: [{ model: User, as: 'creator', attributes: ['id', 'firstName', 'lastName', 'email'] }],
    order: [['createdAt', 'DESC']],
  });

  const acceptedCount = await CampaignApplication.count({
    where: { campaignId, applicationStatus: 'accepted' },
  });

  return {
    campaignId,
    campaignPublicId: campaign.publicId,
    campaignTitle: campaign.campaignTitle,
    campaignStatus: campaign.status,
    fundingStatus: campaign.fundingStatus,
    budget: {
      total: campaign.campaignBudgetCents / 100,
      available: campaign.availableBudgetCents / 100,
      reserved: campaign.reservedBudgetCents / 100,
      committed: campaign.committedBudgetCents / 100,
    },
    isPaymentCreated: Boolean(fundingBatch),
    isFullyFunded: campaign.fundingStatus === 'FUNDS_RECEIVED' || campaign.fundingStatus === 'FUNDED',
    acceptedCreators: acceptedCount,
    fundingBatch: fundingBatch ? {
      id: fundingBatch.id,
      reference: fundingBatch.reference,
      status: fundingBatch.status,
      totalValue: parseFloat(fundingBatch.totalValue),
      platformFee: parseFloat(fundingBatch.platformFee),
      creatorSubtotal: parseFloat(fundingBatch.creatorSubtotal),
      checkoutLink: fundingBatch.checkoutLink,
      walletDepositUrl: fundingBatch.checkoutLink,
      createdAt: fundingBatch.createdAt,
      fundedAt: fundingBatch.fundedAt,
    } : null,
    summary: {
      totalTransactions: transactions.length,
      funded: transactions.filter((t) => t.status === 'FUNDED').length,
      released: transactions.filter((t) => ['RELEASED', 'PAYOUT_TRIGGERED', 'COMPLETED'].includes(t.status)).length,
      failed: transactions.filter((t) => ['FUNDING_FAILED', 'RELEASE_FAILED'].includes(t.status)).length,
      pending: transactions.filter((t) => ['CREATED', 'PENDING_PAYMENT'].includes(t.status)).length,
    },
    transactions: transactions.map((t) => ({
      id: t.id,
      creatorId: t.creatorUserId,
      creatorName: t.creator ? `${t.creator.firstName} ${t.creator.lastName}` : 'Unknown',
      email: t.creator?.email,
      grossAmount: parseFloat(t.amount),
      creatorNet: parseFloat(t.creatorNetAmount || 0),
      commission: parseFloat(t.commissionAmount || 0),
      status: t.status,
      tradesafeTransactionId: t.tradesafeTransactionId,
      createdAt: t.createdAt,
      fundedAt: t.fundedAt,
      releasedAt: t.releasedAt,
    })),
  };
};

// ============================================================
// GET CREATOR PAYMENT SUMMARY
// ============================================================
const getCreatorPaymentSummary = async (creatorId) => {
  const creatorProfile = await CreatorProfile.findOne({ where: { id: creatorId } });
  if (!creatorProfile) throw new AppError(`Creator profile not found`, 404);

  const creatorUser = await User.findOne({
    where: where(fn("LOWER", fn("TRIM", col("email"))), (creatorProfile.email || '').trim().toLowerCase()),
  });
  if (!creatorUser) throw new AppError(`User not found`, 404);

  const transactions = await Transaction.findAll({
    where: { creatorUserId: creatorUser.id },
    order: [['createdAt', 'DESC']],
  });

  const campaignIds = [...new Set(transactions.map((t) => t.campaignId))];
  const campaigns = await Campaign.findAll({
    where: { id: campaignIds },
    attributes: ['id', 'publicId', 'campaignTitle'],
  });
  const campaignById = new Map(campaigns.map((c) => [c.id, c]));

  const paidStatuses = ['RELEASED', 'PAYOUT_TRIGGERED', 'COMPLETED'];

  return {
    creatorId: creatorUser.id,
    totalCampaigns: new Set(transactions.map((t) => t.campaignId)).size,
    totalEarned: transactions
      .filter((t) => paidStatuses.includes(t.status))
      .reduce((sum, t) => sum + parseFloat(t.creatorNetAmount || 0), 0),
    totalPending: transactions
      .filter((t) => ['CREATED', 'FUNDED'].includes(t.status))
      .reduce((sum, t) => sum + parseFloat(t.creatorNetAmount || 0), 0),
    payments: transactions.map((t) => ({
      transactionId: t.id,
      campaignId: t.campaignId,
      campaignTitle: campaignById.get(t.campaignId)?.campaignTitle || null,
      grossAmount: parseFloat(t.amount),
      creatorNet: parseFloat(t.creatorNetAmount || 0),
      status: t.status,
      createdAt: t.createdAt,
      fundedAt: t.fundedAt,
      releasedAt: t.releasedAt,
    })),
  };
};

// ============================================================
// ✅ CREATOR WALLET BALANCE (from TradeSafe)
// ============================================================
const getCreatorWalletBalance = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "tradeSafeUserId", "tradeSafeStatus"],
  });

  if (!user) throw new AppError("User not found", 404);

  const tradeSafeUserId = user.get("tradeSafeUserId");
  const tradeSafeStatus = user.get("tradeSafeStatus");

  if (!tradeSafeUserId) {
    return {
      balance: 0,
      currency: "ZAR",
      isRegistered: false,
      tradeSafeUserId: null,
      message: "Register with TradeSafe to receive payouts",
    };
  }

  try {
    const token = await tradesafeService.getTokenStatus(tradeSafeUserId);
    const balance = parseFloat(token?.balance || 0);

    return {
      balance,
      currency: "ZAR",
      isRegistered: true,
      tradeSafeUserId,
      tradeSafeStatus,
      tradeSafeReference: token?.reference || null,
    };
  } catch (err) {
    console.error("TradeSafe balance fetch error:", err.message);
    return {
      balance: 0,
      currency: "ZAR",
      isRegistered: true,
      tradeSafeUserId,
      tradeSafeStatus,
      error: "Could not fetch balance",
    };
  }
};

// ============================================================
// ✅ CREATOR WITHDRAWAL
// ============================================================
const withdrawCreatorFunds = async (userId, amount) => {
  const user = await User.findByPk(userId, {
    attributes: ["id", "email", "tradeSafeUserId", "tradeSafeStatus"],
  });

  if (!user) throw new AppError("User not found", 404);

  const tradeSafeUserId = user.get("tradeSafeUserId");
  if (!tradeSafeUserId) {
    throw new AppError("Register with TradeSafe first", 400);
  }

  const withdrawAmount = parseFloat(amount);
  if (!withdrawAmount || withdrawAmount <= 0) {
    throw new AppError("Invalid withdrawal amount", 400);
  }

  if (withdrawAmount < 10) {
    throw new AppError("Minimum withdrawal is R10.00", 400);
  }

  // Check current balance
  const token = await tradesafeService.getTokenStatus(tradeSafeUserId);
  const balance = parseFloat(token?.balance || 0);

  if (withdrawAmount > balance) {
    throw new AppError(
      `Insufficient balance. Available: R${balance.toFixed(2)}`,
      400
    );
  }

  // ✅ Call TradeSafe withdrawal — returns boolean
  const success = await tradesafeService.tokenAccountWithdraw({
    tokenId: tradeSafeUserId,
    value: withdrawAmount,
    rtc: false,
  });

  if (!success) {
    throw new AppError("Withdrawal request failed", 502);
  }

  // Generate reference for tracking
  const reference = `WITHDRAW-${user.id}-${Date.now()}`;

  return {
    success: true,
    withdrawalId: reference,
    amount: withdrawAmount,
    status: "PROCESSING",
    reference,
    message: "Withdrawal request submitted. Funds will be transferred to your bank account.",
  };
};

// ============================================================
// GET CREATOR TRANSACTION HISTORY
// ============================================================
const getCreatorTransactionHistory = async (userId, { page = 1, limit = 10, filter = 'all' } = {}) => {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'firstName', 'lastName', 'email'],
  });
  if (!user) throw new AppError('User not found', 404);

  const offset = (page - 1) * limit;

  const whereClause = {
    creatorUserId: userId,
  };

  // Optional filter by status
  if (filter === 'completed') {
    whereClause.status = 'COMPLETED';
  } else if (filter === 'pending') {
    whereClause.status = { [Op.in]: ['CREATED', 'FUNDED', 'PAYOUT_TRIGGERED'] };
  }

  const { count, rows } = await Transaction.findAndCountAll({
    where: whereClause,
    include: [
      {
        model: Campaign,
        as: 'campaign',
        attributes: ['id', 'publicId', 'campaignTitle'],
      },
      {
        model: User,
        as: 'brand',
        attributes: ['id', 'firstName', 'lastName', 'email'],
      },
    ],
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return {
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
    transactions: rows.map((tx) => {
      const campaign = tx.campaign || {};
      const brand = tx.brand || {};
      return {
        id: tx.id,
        reference: tx.reference,
        campaignPublicId: campaign.publicId,
        campaignTitle: campaign.campaignTitle,
        brandName: `${brand.firstName || ''} ${brand.lastName || ''}`.trim(),
        amount: parseFloat(tx.amount || 0),
        creatorNet: parseFloat(tx.creatorNetAmount || 0),
        commission: parseFloat(tx.commissionAmount || 0),
        status: tx.status,
        createdAt: tx.createdAt,
        fundedAt: tx.fundedAt,
        releasedAt: tx.releasedAt,
        completedAt: tx.completedAt,
      };
    }),
  };
};

const cancelCreatorEscrow = async (campaignId, creatorId, brandUserId, reason = '') => {
  const transaction = await sequelize.transaction();

  try {
    const campaign = await Campaign.findOne({
      where: { id: campaignId, brandId: brandUserId, isDeleted: false },
      transaction,
    });
    if (!campaign) throw new AppError("Campaign not found", 404);

    const escrowTx = await Transaction.findOne({
      where: { campaignId, creatorUserId: creatorId },
      transaction,
    });
    if (!escrowTx) throw new AppError("Creator escrow not found", 404);

    // ✅ Already released/completed — can't cancel
    const nonCancellableStates = ['RELEASED', 'COMPLETED', 'PAYOUT_TRIGGERED'];
    if (nonCancellableStates.includes(escrowTx.status)) {
      throw new AppError(`Cannot cancel: transaction is ${escrowTx.status}`, 400);
    }

    // ✅ Call TradeSafe to cancel
    if (escrowTx.tradesafeTransactionId) {
      try {
        await tradesafeService.transactionCancel(
          escrowTx.tradesafeTransactionId,
          { comment: reason || 'Creator cancelled' }
        );
      } catch (err) {
        console.error("TradeSafe cancel failed:", err.message);
        // Continue anyway — mark locally
      }
    }

    // ✅ Update local status
    await escrowTx.update({
      status: 'CANCELLED',
      reservationStatus: 'REFUNDED',
    }, { transaction });

    // ✅ Return reserved budget to available
    const reservedCents = escrowTx.allocatedFromCampaignCents || 0;
    await campaign.update({
      reservedBudgetCents: Math.max(0, campaign.reservedBudgetCents - reservedCents),
      availableBudgetCents: campaign.availableBudgetCents + reservedCents,
    }, { transaction });

    await transaction.commit();

    return {
      success: true,
      transactionId: escrowTx.id,
      status: 'CANCELLED',
      refundedToWallet: true,
      message: 'Creator escrow cancelled. Funds returned to campaign wallet.',
    };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};


module.exports = {
  getAcceptedCreatorsForPayment,
  syncAcceptedCreators,
  fundCampaign,
  confirmCampaignFunded,
  simulateCampaignFundedSandbox,
  createCreatorEscrow,
  fundCreatorEscrow,
  reserveBudgetForCreator,
  refundUnusedBudget,
  releaseFundsToCreator,
  getCampaignPaymentStatus,
  getCreatorPaymentSummary,
  getCreatorWalletBalance,
  withdrawCreatorFunds,
  getCreatorTransactionHistory,
  cancelCreatorEscrow
};