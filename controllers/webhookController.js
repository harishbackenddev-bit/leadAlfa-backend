// controllers/webhookController.js
const FundingBatch = require("../models/transaction/fundingBatch.model");
const Transaction = require("../models/transaction/transaction.model");
const { confirmCampaignFunded } = require("../services/tradesafePaymentService");

const handleTradeSafeWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log(`📩 TradeSafe webhook: ${event}`);

    switch (event) {
      case 'FUNDS_RECEIVED': {
        const walletTokenId = data?.tokenId;
        const amount = data?.amount;

        // Campaign wallet funding
        if (walletTokenId) {
          const batch = await FundingBatch.findOne({
            where: {
              tradesafeWalletTokenId: walletTokenId,
              type: 'CAMPAIGN_FUNDING',
              status: 'PENDING_PAYMENT',
            },
          });

          if (batch && amount >= parseFloat(batch.totalValue)) {
            await confirmCampaignFunded(batch.id, amount);
            console.log(`✅ Campaign funded: ${batch.campaignId}`);
          }
        }

        // Creator escrow funding
        const tsTxId = data?.transactionId;
        if (tsTxId) {
          const tx = await Transaction.findOne({
            where: { tradesafeTransactionId: tsTxId, status: 'CREATED' },
          });
          if (tx) {
            await tx.update({ status: 'FUNDED', fundedAt: new Date() });
            console.log(`✅ Creator escrow funded: ${tx.id}`);
          }
        }
        break;
      }

      case 'PAYOUT_COMPLETED': {
        const tsTxId = data?.transactionId;
        if (tsTxId) {
          const tx = await Transaction.findOne({ where: { tradesafeTransactionId: tsTxId } });
          if (tx && tx.status !== 'COMPLETED') {
            await tx.update({ status: 'COMPLETED', completedAt: new Date() });
            console.log(`✅ Payout complete: ${tx.id}`);
          }
        }
        break;
      }

      case 'ALLOCATION_ACCEPTED': {
        const allocId = data?.allocationId;
        if (allocId) {
          const tx = await Transaction.findOne({ where: { tradesafeAllocationId: allocId } });
          if (tx) await tx.update({ tradesafeReleaseStatus: 'ACCEPTED' });
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event: ${event}`);
    }

    // Always 200 (idempotent)
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    return res.status(200).json({ received: true, error: err.message });
  }
};

module.exports = { handleTradeSafeWebhook };