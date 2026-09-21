// controllers/webhookController.js
const FundingBatch = require("../models/transaction/fundingBatch.model");
const Transaction = require("../models/transaction/transaction.model");
const Campaign = require("../models/campaigns/campaign.model");
const { confirmCampaignFunded } = require("../services/tradesafePaymentService");

const handleTradeSafeWebhook = async (req, res) => {
  try {
    // ✅ TradeSafe format: { url, data: { id, reference, state, balance, allocations } }
    const { url, data } = req.body || {};

    if (!data) {
      console.warn("⚠️ Webhook: no data field");
      return res.status(200).json({ received: true });
    }

    const state = data.state;
    const transactionId = data.id;
    const balance = parseFloat(data.balance || 0);
    const reference = data.reference;
    const allocations = data.allocations || [];

    console.log("📩 TradeSafe webhook");
    console.log("   State:", state);
    console.log("   Transaction ID:", transactionId);
    console.log("   Reference:", reference);
    console.log("   Balance:", balance);
    console.log("   Allocations:", allocations.length);

    // ============================================================
    // FUNDS_RECEIVED
    // ============================================================
    if (state === "FUNDS_RECEIVED") {
      // 1. Try campaign funding (wallet deposit)
      const fundingBatch = await FundingBatch.findOne({
        where: {
          tradesafeWalletTokenId: transactionId,
          type: "CAMPAIGN_FUNDING",
          status: "PENDING_PAYMENT",
        },
      });

      if (fundingBatch) {
        const expectedAmount = parseFloat(fundingBatch.totalValue);
        if (balance >= expectedAmount) {
          await confirmCampaignFunded(fundingBatch.id, balance);
          console.log(`✅ Campaign funded: ${fundingBatch.campaignId}`);
        } else {
          console.warn(`⚠️ Insufficient balance: expected ${expectedAmount}, got ${balance}`);
        }
        return res.status(200).json({ received: true });
      }

      // 2. Try creator escrow funding (transaction ID)
      const creatorTx = await Transaction.findOne({
        where: { tradesafeTransactionId: transactionId },
      });

      if (creatorTx) {
        if (["CREATED", "FUNDING_FAILED"].includes(creatorTx.status)) {
          await creatorTx.update({
            status: "FUNDED",
            fundedAt: new Date(),
            tradesafeFundingStatus: "FUNDS_RECEIVED",
            reservationStatus: "COMMITTED",
          });

          // Update campaign budget
          const campaign = await Campaign.findByPk(creatorTx.campaignId);
          if (campaign) {
            const allocated = creatorTx.allocatedFromCampaignCents || 0;
            await campaign.update({
              reservedBudgetCents: Math.max(0, (campaign.reservedBudgetCents || 0) - allocated),
              committedBudgetCents: (campaign.committedBudgetCents || 0) + allocated,
            });
          }

          console.log(`✅ Creator escrow funded: ${creatorTx.id}`);
        }
        return res.status(200).json({ received: true });
      }

      console.log(`ℹ️ No matching record for FUNDS_RECEIVED: ${transactionId}`);
      return res.status(200).json({ received: true });
    }

    // ============================================================
    // PAYOUT_COMPLETED / FUNDS_RELEASED / COMPLETED
    // ============================================================
    if (["PAYOUT_COMPLETED", "FUNDS_RELEASED", "COMPLETED"].includes(state)) {
      const tx = await Transaction.findOne({
        where: { tradesafeTransactionId: transactionId },
      });

      if (tx && tx.status !== "COMPLETED") {
        await tx.update({
          status: "COMPLETED",
          completedAt: new Date(),
          tradesafeReleaseStatus: state,
        });
        console.log(`✅ Payout completed: ${tx.id}`);
      }

      // Update allocations
      for (const alloc of allocations) {
        const allocTx = await Transaction.findOne({
          where: { tradesafeAllocationId: alloc.id },
        });
        if (allocTx) {
          await allocTx.update({ tradesafeReleaseStatus: alloc.state });
        }
      }

      return res.status(200).json({ received: true });
    }

    // ============================================================
    // REFUNDED / CANCELLED
    // ============================================================
    if (["REFUNDED", "CANCELLED"].includes(state)) {
      const tx = await Transaction.findOne({
        where: { tradesafeTransactionId: transactionId },
      });

      if (tx) {
        await tx.update({
          status: state,
          refundedAt: new Date(),
          reservationStatus: "REFUNDED",
        });

        // Return budget to campaign
        const campaign = await Campaign.findByPk(tx.campaignId);
        if (campaign) {
          const allocated = tx.allocatedFromCampaignCents || 0;
          await campaign.update({
            reservedBudgetCents: Math.max(0, (campaign.reservedBudgetCents || 0) - allocated),
            committedBudgetCents: Math.max(0, (campaign.committedBudgetCents || 0) - allocated),
            availableBudgetCents: (campaign.availableBudgetCents || 0) + allocated,
          });
        }

        console.log(`✅ Transaction ${state}: ${tx.id}`);
      }

      return res.status(200).json({ received: true });
    }

    // ============================================================
    // ALLOCATION STATE CHANGES
    // ============================================================
    if (["ALLOCATION_ACCEPTED", "ALLOCATION_DELIVERED", "ALLOCATION_IN_TRANSIT"].includes(state)) {
      for (const alloc of allocations) {
        const tx = await Transaction.findOne({
          where: { tradesafeAllocationId: alloc.id },
        });
        if (tx) {
          await tx.update({ tradesafeReleaseStatus: alloc.state });
          console.log(`✅ Allocation ${alloc.id} → ${alloc.state}`);
        }
      }
      return res.status(200).json({ received: true });
    }

    console.log(`ℹ️ Unhandled state: ${state}`);
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    console.error("   Stack:", err.stack);
    // Always return 200 (prevent retries)
    return res.status(200).json({ received: true, error: err.message });
  }
};

module.exports = { handleTradeSafeWebhook };