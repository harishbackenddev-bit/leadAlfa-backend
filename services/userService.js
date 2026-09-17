const { Op } = require("sequelize");
const User = require("../models/user.model");
const AppError = require("../utils/appError");
const { hashPassword, comparePasswords } = require("../utils/hashUtil");
const { generateResetToken, hashToken } = require("../utils/tokenUtil");
const { verifyToken } = require("../utils/jwtUtil");
const {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendReVerificationEmail,
} = require("../utils/email/emailProvider");

const registerUser = async ({
  firstName,
  lastName,
  phone,
  email,
  password,
}) => {
  try {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser)
      throw new AppError("User already exists with this email", 400);

    const password_hash = await hashPassword(password);

    // Generate OTP
    const verificationCode = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    const user = await User.create({
      firstName,
      lastName,
      phone,
      email,
      password: password_hash,
      emailVerified: false,
      verificationCode,
      verificationCodeExpires: new Date(Date.now() + 2 * 60 * 1000), 
    });

    if (process.env.TOGGLE_EMAIL === "true") {
      // Send OTP to user's email
      await sendVerificationEmail(email, verificationCode);
    }
    return user;
  } catch (error) {
    console.error("User Service] Error in registerUser:", error.message);
    throw error;
  }
};

const setUserRole = async (userId, role) => {
  const validRoles = ["creator", "brand"];
  if (!validRoles.includes(role)) throw new AppError("Invalid role", 400);

  const user = await User.findByPk(userId);
  if (!user) throw new AppError("User not found", 404);

  // If role is already set, prevent changes
  if (user.role !== null) throw new AppError("Role already set", 400);
  user.role = role;
  await user.save();
  return user;
};

const loginUser = async (email, password) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new AppError("User not found", 404);

  if (!user.emailVerified) {
    throw new AppError("Email not verified", 401);
  }

  const isValidPassword = await comparePasswords(password, user.password);
  if (!isValidPassword) throw new AppError("Invalid password", 401);
  return user;
};

// Verify email code
const verifyEmailCode = async (email, code) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new AppError("User not found", 404);

  if (
    user.verificationCode !== code ||
    user.verificationCodeExpires < new Date()
  )
    throw new AppError("Invalid or expired verification code", 400);

  user.emailVerified = true;
  user.verificationCode = null;
  user.verificationCodeExpires = null;
  await user.save();

  return user;
};

// Resend verification code
const resendVerificationCode = async (email) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new AppError("User not found", 404);

  if (user.emailVerified) throw new AppError("Email already verified", 401);

  if (user.verificationCodeExpires > new Date()) {
    throw new AppError("Verification code is still valid", 400);
  }

  // Generate new OTP
  const newCode = Math.floor(100000 + Math.random() * 900000).toString();

  // Update user with new code and reset expiry
  user.verificationCode = newCode;
  user.verificationCodeExpires = new Date(Date.now() + 2 * 60 * 1000);
  await user.save();

  if (process.env.TOGGLE_EMAIL === "true") {
    await sendReVerificationEmail(email, newCode);
    return { message: "Verification code resent" };
  } else {
    return {
      message: "If you didn't receive the email, use this new code to verify your email for testing purposes.",
      verificationCode: newCode,
    };
  }
};

// Refresh access token
const refreshAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    throw new AppError("Refresh token missing", 401);
  }

  const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
  if (!decoded) throw new AppError("Invalid or expired refresh token", 403);

  const user = await User.findByPk(decoded.id);
  if (!user) {
    throw new AppError("User not found", 404);
  }
  return user;
};

// Request password reset
const requestPasswordReset = async (email) => {
  const genericMessage = "If an account with that email exists, a reset link has been sent.";

  const user = await User.findOne({ where: { email } });

  if (!user) return { message: genericMessage };

  const { resetToken, hashedToken } = generateResetToken();
  const ttlMs = (Number(process.env.PASSWORD_RESET_TTL_MINUTES) || 15) * 60 * 1000;
  user.resetPasswordToken = hashedToken;
  user.resetPasswordExpires = new Date(Date.now() + ttlMs);
  await user.save();

  if (process.env.TOGGLE_EMAIL === "true") {
    await sendPasswordResetEmail(email, resetToken);
    return { message: genericMessage };
  } else {
    return {
      message: genericMessage,
      resetToken, // Exposed only when email is disabled (development/testing)
    };
  }
};

// Reset password
const resetPassword = async (token, newPassword) => {
  const hashedToken = hashToken(token);

  const user = await User.findOne({
    where: {
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { [Op.gt]: Date.now() },
    },
  });

  if (!user) throw new AppError("Invalid or expired reset token", 400);

  user.password = await hashPassword(newPassword);
  user.resetPasswordToken = null;
  user.resetPasswordExpires = null;
  user.passwordChangedAt = new Date();
  await user.save();

  return user;
};

const getUser = async (userId) =>{
  const user = await User.findByPk(userId);
  if(!user)
    throw new AppError("User not found", 404);  
  return user;
}

const getUserRole = async (userId) => {
  const user = await getUser(userId);
  return user.role;
};

module.exports = {
  registerUser,
  setUserRole,
  loginUser,
  verifyEmailCode,
  resendVerificationCode,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
  getUserRole,
  getUser,
};
