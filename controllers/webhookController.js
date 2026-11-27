const FundingBatch = require("../models/transaction/fundingBatch.model");
const Transaction = require("../models/transaction/transaction.model");
const { confirmCampaignFunded } = require("../services/tradesafePaymentService");
const tradesafeService = require("../services/tradesafe.service");
const crypto = require("crypto");

let warnedNoSecret = false;

/**
 * Optional shared-secret check. Set TRADESAFE_WEBHOOK_SECRET and register the
 * callback in TradeSafe as  https://<api>/api/webhook/tradesafe?secret=<value>
 * (or send the same value in the x-webhook-secret header).
 */
const isWebhookAuthorised = (req) => {
  const expected = process.env.TRADESAFE_WEBHOOK_SECRET;
  if (!expected) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn(
        "[webhook] TRADESAFE_WEBHOOK_SECRET is not set - webhook is relying on live balance verification only."
      );
    }
    return true;
  }
  const provided = String(req.get("x-webhook-secret") || req.query?.secret || "");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Never trust the webhook body alone: anyone can POST to this URL.
 * Confirm against TradeSafe that the brand wallet really holds at least the
 * campaign budget before the campaign is activated.
 */
const walletCoversBatch = async (walletTokenId, batch) => {
  const token = await tradesafeService.getTokenStatus(walletTokenId);
  const balance = parseFloat(token?.balance || 0);
  const required = parseFloat(batch.creatorSubtotal || 0);
  return { ok: balance >= required && required > 0, balance, required };
};

const handleTradeSafeWebhook = async (req, res) => {
  try {
    if (!isWebhookAuthorised(req)) {
      return res.status(401).json({ received: false, error: "Unauthorized" });
    }

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
          attributes: ['id', 'campaignId', 'type', 'status', 'totalValue', 'creatorSubtotal', 'createdAt'],
          order: [['createdAt', 'DESC']],
        });


        const pendingBatches = allBatches.filter((b) => b.status === 'PENDING_PAYMENT');


        if (pendingBatches.length === 0) {
          console.warn(`No PENDING batch — available statuses:`, allBatches.map(b => b.status));
          return res.status(200).json({ received: true });
        }

        const batch = pendingBatches[0];

        let check;
        try {
          check = await walletCoversBatch(walletTokenId, batch);
        } catch (verifyErr) {
          // Could not verify -> do NOT activate; ask TradeSafe to retry.
          console.error('Webhook balance verification failed:', verifyErr.message);
          return res.status(503).json({ received: false, error: "Verification unavailable" });
        }

        if (!check.ok) {
          console.warn(
            `Webhook FUNDS_RECEIVED ignored: wallet balance R${check.balance} < required R${check.required} (batch ${batch.id})`
          );
          return res.status(200).json({ received: true, verified: false });
        }

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