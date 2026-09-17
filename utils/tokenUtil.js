const crypto = require("crypto");

const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const generateResetToken = () => {
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashedToken = hashToken(resetToken);
  return { resetToken, hashedToken };
};

module.exports = { generateResetToken, hashToken };
