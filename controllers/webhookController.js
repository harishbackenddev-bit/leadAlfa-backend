const FundingBatch = require("../models/transaction/fundingBatch.model");
const Transaction = require("../models/transaction/transaction.model");
const { confirmCampaignFunded } = require("../services/tradesafePaymentService");

const handleTradeSafeWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;


    switch (event) {
      case 'FUNDS_RECEIVED': {
        const walletTokenId = data?.tokenId;

        if (!walletTokenId) {
          console.warn('No tokenId provided');
          return res.status(200).json({ received: true });
        }


        const allBatches = await FundingBatch.findAll({
          where: {
            tradesafeWalletTokenId: walletTokenId,
          },
          attributes: ['id', 'campaignId', 'type', 'status', 'totalValue', 'createdAt'],
          order: [['createdAt', 'DESC']],
        });


        const pendingBatches = allBatches.filter((b) => b.status === 'PENDING_PAYMENT');


        if (pendingBatches.length === 0) {
          console.warn(`No PENDING batch — available statuses:`, allBatches.map(b => b.status));
          return res.status(200).json({ received: true });
        }

        const batch = pendingBatches[0];


        await confirmCampaignFunded(batch.id);

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
        console.log(`Unhandled event: ${event}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(200).json({ received: true, error: err.message });
  }
};

module.exports = { handleTradeSafeWebhook };