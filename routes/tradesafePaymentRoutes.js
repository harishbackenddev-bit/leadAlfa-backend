// routes/tradesafePaymentRoutes.js
const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { attachBrandContext } = require("../middlewares/attachBrandContextMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");
const {
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
  cancelCreatorEscrowController,
  getPaymentMethodsController,
  generateFundingQuoteController
} = require("../controllers/tradesafePaymentController");

// ========== BRAND ROUTES ==========

// Get accepted creators
router.get(
  "/campaign/:campaignId/creators",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  getAcceptedCreatorsController
);

// Sync accepted creators
router.post(
  "/campaign/:campaignId/sync-creators",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  syncAcceptedCreatorsController
);

// ✅ Fund campaign (wallet deposit link)
router.post(
  "/campaign/:campaignId/fund",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  fundCampaignController
);

// ✅ Sandbox simulate funded
router.post(
  "/campaign/:campaignId/simulate-funded",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  simulateFundedController
);

// ✅ Select creator → create escrow
router.post(
  "/campaign/:campaignId/select-creator",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  selectCreatorController
);

// ✅ Fund creator escrow from wallet
router.post(
  "/transaction/:id/fund-creator",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  fundCreatorController
);

// ✅ Refund unused budget
router.post(
  "/campaign/:campaignId/refund-unused",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  refundUnusedController
);

// Release funds to creator
router.post(
  "/campaign/:campaignId/release",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  releaseFundsToCreatorController
);

// Campaign payment status
router.get(
  "/campaign/:campaignId/status",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  getCampaignPaymentStatusController
);

// ========== CREATOR ROUTES ==========
router.get(
  "/creator/:creatorId/summary",
  authenticateJWT,
  allowRoles("creator"),
  getCreatorPaymentSummaryController
);

// Get creator payment summary
router.get(
  "/creator/:creatorId/summary",
  authenticateJWT,
  allowRoles("creator"),
  getCreatorPaymentSummaryController
);

// ✅ Get creator wallet balance from TradeSafe
router.get(
  "/creator/balance",
  authenticateJWT,
  allowRoles("creator"),
  getCreatorBalanceController
);

// ✅ Withdraw funds
router.post(
  "/creator/withdraw",
  authenticateJWT,
  allowRoles("creator"),
  withdrawCreatorFundsController
);

router.get(
  "/creator/transactions",
  authenticateJWT,
  allowRoles("creator"),
  getCreatorTransactionHistoryController
);

// ========== FUNDING QUOTE ROUTES ==========





router.post(
  "/campaign/:campaignId/cancel-creator",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  cancelCreatorEscrowController
);

// ✅ Temporary: Credit wallet (sandbox only)
router.post(
  "/credit-wallet",
  async (req, res) => {
    try {
      if (process.env.NODE_ENV === "production") {
        return res.status(403).json({ error: "Disabled in production" });
      }

      const { tokenId, amount } = req.body;

      if (!tokenId || !amount) {
        return res.status(400).json({ error: "tokenId and amount required" });
      }

      const tradesafeService = require("../services/tradesafe.service");

      const result = await tradesafeService.tokenUpdateBalance({
        id: tokenId,
        value: parseFloat(amount),
        type: "CREDIT",
      });

      return res.status(200).json({
        success: true,
        balance: result?.balance,
        tokenId,
        amount,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

router.get(
  "/campaign/:campaignId/payment-methods",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  getPaymentMethodsController
);

router.post(
  "/campaign/:campaignId/funding-quote",
  authenticateJWT,
  attachBrandContext,
  allowRoles("brand"),
  generateFundingQuoteController
);

module.exports = router;