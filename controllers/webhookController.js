// controllers/webhookController.js
const FundingBatch = require("../models/transaction/fundingBatch.model");
const Transaction = require("../models/transaction/transaction.model");
const { confirmCampaignFunded } = require("../services/tradesafePaymentService");

const handleTradeSafeWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    console.log(`📩 TradeSafe webhook:`, event);

    switch (event) {
case 'FUNDS_RECEIVED': {
  const walletTokenId = data?.tokenId;

  console.log('FUNDS_RECEIVED webhook:', { walletTokenId, data });

  if (!walletTokenId) {
    console.warn('⚠️ No tokenId provided');
    return res.status(200).json({ received: true });
  }

  // ✅ DEBUG: Find ALL batches for this token (no filter)
  const allBatches = await FundingBatch.findAll({
    where: {
      tradesafeWalletTokenId: walletTokenId,
    },
    attributes: ['id', 'campaignId', 'type', 'status', 'totalValue', 'createdAt'],
    order: [['createdAt', 'DESC']],
  });

  console.log(`📊 Found ${allBatches.length} batches for token ${walletTokenId}:`);
  allBatches.forEach((b) => {
    console.log(`   - id: ${b.id}`);
    console.log(`     campaignId: ${b.campaignId}`);
    console.log(`     type: ${b.type} (type of: ${typeof b.type})`);
    console.log(`     status: ${b.status} (type of: ${typeof b.status})`);
    console.log(`     totalValue: ${b.totalValue}`);
    console.log(`     createdAt: ${b.createdAt}`);
  });

  // ✅ Now try PENDING only
  const pendingBatches = allBatches.filter((b) => b.status === 'PENDING_PAYMENT');
  console.log(`📊 PENDING batches: ${pendingBatches.length}`);

  if (pendingBatches.length === 0) {
    console.warn(`⚠️ No PENDING batch — available statuses:`, allBatches.map(b => b.status));
    return res.status(200).json({ received: true });
  }

  const batch = pendingBatches[0]; // Latest one
  console.log(`✅ Using batch: ${batch.id}`);

  await confirmCampaignFunded(batch.id);
  console.log(`✅ Campaign funded: ${batch.campaignId}`);

  break;
}

      case 'PAYOUT_COMPLETED': {
        const tsTxId = data?.transactionId;
        if (tsTxId) {
          const tx = await Transaction.findOne({
            where: { tradesafeTransactionId: tsTxId },
          });
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
          const tx = await Transaction.findOne({
            where: { tradesafeAllocationId: allocId },
          });
          if (tx) await tx.update({ tradesafeReleaseStatus: 'ACCEPTED' });
        }
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event: ${event}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Webhook error:', err.message);
    return res.status(200).json({ received: true, error: err.message });
  }
};

module.exports = { handleTradeSafeWebhook };