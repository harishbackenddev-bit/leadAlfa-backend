// backend/scripts/testAutoApprove.js
require("dotenv").config();
require("../models");

const { runAutoApproval } = require("../cron/autoApproveSubmissions");

async function test() {
  console.log("🚀 Manually running auto-approve sweep...\n");
  await runAutoApproval(null);
  console.log("\n✅ Test complete");
  process.exit(0);
}

test().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});