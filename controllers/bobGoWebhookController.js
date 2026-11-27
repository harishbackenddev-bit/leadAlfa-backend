const crypto = require("crypto");
const shipmentService = require("../services/shipmentService");

const secretMatches = (given) => {
  const expected = process.env.BOBGO_WEBHOOK_SECRET_PATH || "";
  if (!expected || !given || given.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected));
};

const bobGoWebhookController = async (req, res) => {
  if (!secretMatches(req.params.secret)) {
    return res.status(404).json({ error: "Not found" });
  }

  res.status(200).json({ received: true });

  try {
    await shipmentService.applyWebhook(req.body || {});
  } catch (err) {
    console.error("bobgo webhook failed", { message: err.message });
  }
};

module.exports = { bobGoWebhookController };
