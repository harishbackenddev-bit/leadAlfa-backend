const jwt = require("jsonwebtoken");
const User = require("../models/user.model");

// Middleware to authenticate and extract user from jwt token
const authenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check if header exists and is in correct format
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ error: "Authorization token missing or malformed" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if the password was changed after this token was issued.
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "passwordChangedAt"],
    });

    if (!user) {
      return res.status(401).json({ error: "User not found" });
    }

    if (user.passwordChangedAt) {
      const changedAtSeconds = Math.floor(
        user.passwordChangedAt.getTime() / 1000
      );
      if (decoded.iat < changedAtSeconds) {
        return res.status(401).json({
          error: "Password was recently changed. Please log in again.",
        });
      }
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Middleware to optionally extract user from JWT if token is provided, without blocking unauthenticated requests
const optionalAuthenticateJWT = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "passwordChangedAt"],
    });

    if (user) {
      if (user.passwordChangedAt) {
        const changedAtSeconds = Math.floor(
          user.passwordChangedAt.getTime() / 1000
        );
        if (decoded.iat >= changedAtSeconds) {
          req.user = decoded;
        }
      } else {
        req.user = decoded;
      }
    }
  } catch (err) {
    // Ignore invalid/expired token for public optional auth
  }

  next();
};

module.exports = { authenticateJWT, optionalAuthenticateJWT };
