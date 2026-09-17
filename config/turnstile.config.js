require("dotenv").config();

module.exports = {
  secretKey: process.env.TURNSTILE_SECRET_KEY || "1x0000000000000000000000000000000AA",
  siteKey: process.env.TURNSTILE_SITE_KEY || "1x0000000000000000000000000000000AA",
  enabled: process.env.TURNSTILE_ENABLED !== undefined ? process.env.TURNSTILE_ENABLED === "true" : false,
  failOpen: process.env.TURNSTILE_FAIL_OPEN !== undefined ? process.env.TURNSTILE_FAIL_OPEN === "true" : true,
  timeoutMs: parseInt(process.env.TURNSTILE_TIMEOUT_MS, 10) || 5000,
  verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
};
