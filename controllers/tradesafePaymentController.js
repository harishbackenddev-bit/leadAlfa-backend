// controllers/tradesafePaymentController.js
const {
  getAcceptedCreatorsForPayment,
  syncAcceptedCreators,
  fundCampaign,
  simulateCampaignFundedSandbox,
  createCreatorEscrow,
  fundCreatorEscrow,
  refundUnusedBudget,
  releaseFundsToCreator,
  getCampaignPaymentStatus,
  getCreatorPaymentSummary,
  getCreatorWalletBalance,
  withdrawCreatorFunds,
  getCreatorTransactionHistory,
  cancelCreatorEscrow
} = require("../services/tradesafePaymentService");

const {
  generateEstimatedFundingQuote,
} = require("../services/fundingQuoteService");

const FundingBatch = require("../models/transaction/fundingBatch.model");
const Campaign = require("../models/campaigns/campaign.model");
const AppError = require("../utils/appError");
const CampaignInvoice = require("../models/campaigns/campaignInvoice.model");
const Invoice = require("../models/campaigns/campaignInvoice.model");

const errResp = (res, err) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, error: err.message });
  }
  console.error("Controller error:", err.message);
  return res.status(500).json({ success: false, error: "Something went wrong. Please try again later." });
};

// ============================================================
// ✅ HELPER: Resolve campaign identifier (publicId OR numeric id)
// ============================================================
const resolveCampaignId = async (identifier) => {
  if (!identifier) throw new AppError("Campaign identifier missing", 400);

  // If numeric → return as integer
  if (/^\d+$/.test(String(identifier))) {
    return parseInt(identifier, 10);
  }

  // If publicId (CMP-XXXX) → lookup
  const campaign = await Campaign.findOne({
    where: { publicId: identifier },
    attributes: ["id"],
  });
  if (!campaign) throw new AppError(`Campaign not found: ${identifier}`, 404);

  return campaign.id;
};

// ============================================================
// 1. GET ACCEPTED CREATORS
// ============================================================
const getAcceptedCreatorsController = async (req, res) => {
  try {
    const campaignId = await resolveCampaignId(req.params.campaignId);
    const result = await getAcceptedCreatorsForPayment(campaignId, req.brandId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 2. SYNC ACCEPTED CREATORS
// ============================================================
const syncAcceptedCreatorsController = async (req, res) => {
  try {
    const campaignId = await resolveCampaignId(req.params.campaignId);
    const result = await syncAcceptedCreators(campaignId, req.brandId);
    return res.status(200).json({ success: true, message: "Synced", data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 3. FUND CAMPAIGN (wallet deposit link)
// ============================================================
const fundCampaignController = async (req, res) => {
  try {
    const campaignId = await resolveCampaignId(req.params.campaignId);

    console.log("📩 fundCampaign called:", {
      campaignId,
      brandId: req.brandId,
    });

    // ✅ No payment method payload
    const result = await fundCampaign(campaignId, req.brandId);

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    return errResp(res, err);
  }
};

// ============================================================
// 4. SIMULATE CAMPAIGN FUNDED (sandbox)
// ============================================================
const simulateFundedController = async (req, res) => {
  try {
    const campaignId = await resolveCampaignId(req.params.campaignId);

    const fundingBatch = await FundingBatch.findOne({
      where: { campaignId, type: 'CAMPAIGN_FUNDING' },
    });
    if (!fundingBatch) {
      return res.status(404).json({ success: false, error: 'Funding batch not found' });
    }

    const result = await simulateCampaignFundedSandbox(fundingBatch.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 5. SELECT CREATOR (create escrow)
// ============================================================


const selectCreatorController = async (req, res) => {
  try {
    const { creatorId } = req.body;

    if (!creatorId) {
      return res.status(400).json({ success: false, error: 'creatorId required' });
    }

    const campaignId = await resolveCampaignId(req.params.campaignId);

    // ✅ Campaign ka data lo
    const campaign = await Campaign.findOne({
      where: { id: campaignId },
      attributes: ['id', 'publicId', 'numberOfCreators', 'campaignBudgetCents', 'availableBudgetCents'],
    });

    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }

    // ✅ Per creator amount calculate karo
    // Option A: numberOfCreators se divide karo
    let perCreatorAmount;

    const totalBudgetCents = campaign.campaignBudgetCents;
    const creatorCount = campaign.numberOfCreators || 1;

    if (totalBudgetCents > 0) {
      // Campaign budget / numberOfCreators
      perCreatorAmount = (totalBudgetCents / creatorCount) / 100;
    } else {
      // Fallback: Invoice se lo
      const invoice = await CampaignInvoice.findOne({
        where: { campaignId: campaign.id },
        attributes: ['cartSubtotal', 'numberOfCreators'],
      });

      if (!invoice) {
        return res.status(400).json({
          success: false,
          error: 'No campaign budget or invoice found',
        });
      }

      const invoiceCreators = invoice.numberOfCreators || 1;
      perCreatorAmount = parseFloat(invoice.cartSubtotal) / invoiceCreators;
    }

    if (!perCreatorAmount || perCreatorAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Could not calculate creator amount',
      });
    }

    console.log(`✅ Creator ${creatorId} amount: R${perCreatorAmount.toFixed(2)} (budget R${totalBudgetCents / 100} / ${creatorCount} creators)`);

    const result = await createCreatorEscrow(
      campaignId,
      creatorId,
      perCreatorAmount,
      req.brandId
    );

    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error("selectCreator error:", err.message);
    return res.status(500).json({ success: false, error: "Something went wrong." });
  }
};

// ============================================================
// 6. FUND CREATOR ESCROW
// ============================================================
const fundCreatorController = async (req, res) => {
  try {
    const result = await fundCreatorEscrow(req.params.id);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 7. REFUND UNUSED
// ============================================================
const refundUnusedController = async (req, res) => {
  try {
    const campaignId = await resolveCampaignId(req.params.campaignId);
    const result = await refundUnusedBudget(campaignId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 8. GET CAMPAIGN PAYMENT STATUS
// ============================================================
const getCampaignPaymentStatusController = async (req, res) => {
  try {
    const campaignId = await resolveCampaignId(req.params.campaignId);
    const result = await getCampaignPaymentStatus(campaignId, req.brandId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 9. GET CREATOR PAYMENT SUMMARY
// ============================================================
const getCreatorPaymentSummaryController = async (req, res) => {
  try {
    const result = await getCreatorPaymentSummary(req.params.creatorId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 10. RELEASE FUNDS
// ============================================================
const releaseFundsToCreatorController = async (req, res) => {
  try {
    const { creatorId } = req.body;
    if (!creatorId) {
      return res.status(400).json({ success: false, error: "Creator ID is required" });
    }

    const campaignId = await resolveCampaignId(req.params.campaignId);
    const brandUserId = req.brandId || req.user.id;

    const result = await releaseFundsToCreator(campaignId, creatorId, brandUserId);

    const message =
      result.status === "PAYOUT_TRIGGERED"
        ? "Payout triggered. Awaiting TradeSafe confirmation."
        : result.status === "PENDING_ACCEPTANCE"
          ? "Waiting on TradeSafe acceptance callback."
          : "Funds released successfully";

    return res.status(200).json({ success: true, message, data: result });
  } catch (err) { return errResp(res, err); }
};


// ============================================================
// 11. GET CREATOR WALLET BALANCE
// ============================================================
const getCreatorBalanceController = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getCreatorWalletBalance(userId);
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

// ============================================================
// 12. WITHDRAW CREATOR FUNDS
// ============================================================
const withdrawCreatorFundsController = async (req, res) => {
  try {
    const userId = req.user.id;
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({ success: false, error: "Amount required" });
    }

    const result = await withdrawCreatorFunds(userId, amount);
    return res.status(201).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};

const getCreatorTransactionHistoryController = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const filter = req.query.filter || 'all';

    const result = await getCreatorTransactionHistory(userId, { page, limit, filter });
    return res.status(200).json({ success: true, data: result });
  } catch (err) { return errResp(res, err); }
};



// ✅ NEW: Get estimated funding fee (no payment method)
const getEstimatedFeeController = async (req, res) => {
  try {
    const campaignId = await resolveCampaignId(req.params.campaignId);

    const campaign = await Campaign.findOne({
      where: { id: campaignId, brandId: req.brandId, isDeleted: false },
      attributes: ["id", "campaignBudgetCents"],
    });
    if (!campaign) {
      return res.status(404).json({ success: false, error: "Campaign not found" });
    }

    const quote = await generateEstimatedFundingQuote(campaign);
    return res.status(200).json({ success: true, data: quote });
  } catch (err) { return errResp(res, err); }
};

const cancelCreatorEscrowController = async (req, res) => {
  try {
    const { creatorId, reason } = req.body;
    if (!creatorId) {
      return res.status(400).json({ success: false, error: "creatorId required" });
    }

    const campaignId = await resolveCampaignId(req.params.campaignId);
    const result = await cancelCreatorEscrow(
      campaignId,
      creatorId,
      req.brandId,
      reason
    );

    return res.status(200).json({ success: true, data: result });
  } catch (err) {
    return errResp(res, err);
  }
};



module.exports = {
  getAcceptedCreatorsController,
  syncAcceptedCreatorsController,
  fundCampaignController,
  simulateFundedController,
  selectCreatorController,
  fundCreatorController,
  refundUnusedController,
  getCampaignPaymentStatusController,
  getCreatorPaymentSummaryController,
  releaseFundsToCreatorController,
  getCreatorBalanceController,
  withdrawCreatorFundsController,
  getCreatorTransactionHistoryController,
  getEstimatedFeeController,
  cancelCreatorEscrowController
};