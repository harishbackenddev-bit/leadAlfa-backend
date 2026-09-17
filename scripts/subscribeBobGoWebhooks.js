// Run once per environment: node scripts/subscribeBobGoWebhooks.js
require("dotenv").config();
const bobgo = require("../services/bobGoService");

const base = String(process.env.API_PUBLIC_URL || "").replace(/\/$/, "");
const secret = process.env.BOBGO_WEBHOOK_SECRET_PATH;

(async () => {
  if (!bobgo.isConfigured()) throw new Error("BOBGO_API_URL and BOBGO_API_TOKEN must be set");
  if (!base) throw new Error("API_PUBLIC_URL must be set");
  if (!secret) throw new Error("BOBGO_WEBHOOK_SECRET_PATH must be set");

  const url = `${base}/api/webhooks/bobgo/${secret}`;
  const result = await bobgo.subscribeWebhooks(url);

  console.log("subscribed to:", url.replace(secret, "<secret>"));
  console.log(JSON.stringify(result, null, 2).slice(0, 800));
})().catch((err) => {
  console.error("failed:", err.message);
  process.exit(1);
});
