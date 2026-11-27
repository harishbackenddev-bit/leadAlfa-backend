const turnstileConfig = require("../config/turnstile.config");
const turnstileService = require("../services/turnstileService");

async function verifyTurnstileToken(req, res, next) {

  if (!turnstileConfig.enabled) {
    return next();
  }

  const token =
    (req.body && req.body["cf-turnstile-response"]) ||
    (req.body && req.body.captchaToken) ||
    req.headers["x-turnstile-response"];

  const clientIp =
    req.headers["cf-connecting-ip"] ||
    req.headers["x-forwarded-for"] ||
    req.socket?.remoteAddress;

  const verification = await turnstileService.verifyToken(token, clientIp);

  if (!verification.success) {
    if (verification.reason === "MISSING_TOKEN") {
      return res.status(400).json({
        error: "Security verification failed",
        message: "CAPTCHA verification response token is required.",
        reason: verification.reason,
      });
    }

    if (verification.reason === "SERVICE_UNREACHABLE") {
      return res.status(503).json({
        error: "Security verification service unavailable",
        message: "Security verification service is temporarily unreachable. Please try again later.",
        reason: verification.reason,
      });
    }

    return res.status(400).json({
      error: "Security verification failed",
      message: "CAPTCHA verification failed. Please try again.",
      reason: verification.reason,
      errorCodes: verification.errorCodes,
    });
  }

  req.turnstile = verification;
  return next();
}

module.exports = {
  verifyTurnstileToken,
};
