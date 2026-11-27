const jwt = require("jsonwebtoken");

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" } // Token expires in 1 day by default
  );
};

const generateRefreshToken = (user, rememberMe) => {
  return jwt.sign(
    { id: user.id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: rememberMe ? "30d" : "7d" } // Token expires in 30 days if rememberMe is true, otherwise 7 days
  );
};

const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (err) {
    return null;
  }
};

module.exports = { generateAccessToken, generateRefreshToken, verifyToken };
