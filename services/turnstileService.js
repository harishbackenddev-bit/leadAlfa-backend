const axios = require("axios");
const turnstileConfig = require("../config/turnstile.config");

async function verifyToken(token, clientIp) {
  if (!token) {
    return {
      success: false,
      reason: "MISSING_TOKEN",
      errorCodes: ["missing-input-response"],
    };
  }

  const formData = new URLSearchParams();
  formData.append("secret", turnstileConfig.secretKey);
  formData.append("response", token);
  if (clientIp) {
    formData.append("remoteip", clientIp);
  }

  try {
    const response = await axios.post(
      turnstileConfig.verifyUrl,
      formData.toString(),
      {
        timeout: turnstileConfig.timeoutMs,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data = response.data;

    if (data && data.success) {
      return {
        success: true,
        challenge_ts: data.challenge_ts,
        hostname: data.hostname,
        action: data.action,
        cdata: data.cdata,
      };
    } else {
      return {
        success: false,
        reason: "INVALID_TOKEN",
        errorCodes: (data && data["error-codes"]) || ["invalid-input-response"],
      };
    }
  } catch (error) {
    console.error(`[Turnstile] Error communicating with Turnstile API: ${error.message}`);

    if (turnstileConfig.failOpen) {
      console.warn(
        "[Turnstile] Service unreachable or timed out. Proceeding under FAIL-OPEN policy."
      );
      return {
        success: true,
        bypassed: true,
        reason: "SERVICE_UNREACHABLE",
        error: error.message,
      };
    } else {
      return {
        success: false,
        reason: "SERVICE_UNREACHABLE",
        error: error.message,
      };
    }
  }
}

module.exports = {
  verifyToken,
};
