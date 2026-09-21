// controllers/webhookController.js
// ⚠️ DEBUG MODE — sirf data print karega, DB update nahi karega

const handleTradeSafeWebhook = async (req, res) => {
  try {
    console.log("");
    console.log("════════════════════════════════════════════════════════");
    console.log("📩 TRADESAFE WEBHOOK RECEIVED");
    console.log("════════════════════════════════════════════════════════");
    console.log("⏰ Timestamp:", new Date().toISOString());
    console.log("🌐 URL:", req.originalUrl);
    console.log("📋 Method:", req.method);
    console.log("📦 Headers:", JSON.stringify(req.headers, null, 2));
    console.log("");
    console.log("🔍 RAW BODY:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("");
    console.log("🔍 PARSED FIELDS:");

    const { url, data } = req.body || {};

    console.log("   url:", url);
    console.log("   data:", data);
    console.log("   data?.state:", data?.state);
    console.log("   data?.id:", data?.id);
    console.log("   data?.reference:", data?.reference);
    console.log("   data?.balance:", data?.balance);
    console.log("   data?.allocations:", data?.allocations);
    console.log("════════════════════════════════════════════════════════");
    console.log("");

    // ✅ Always respond 200 (no processing yet)
    return res.status(200).json({
      received: true,
      debug: {
        state: data?.state,
        id: data?.id,
        reference: data?.reference,
        balance: data?.balance,
        allocations: data?.allocations,
      },
    });
  } catch (err) {
    console.error("❌ Webhook error:", err.message);
    console.error("   Stack:", err.stack);
    return res.status(200).json({ received: true, error: err.message });
  }
};

module.exports = { handleTradeSafeWebhook };