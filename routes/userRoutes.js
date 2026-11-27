const express = require("express");
const { check } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { passwordResetLimiter, authLimiter, resendCodeLimiter } = require("../middlewares/rateLimiter");
const { verifyTurnstileToken } = require("../middlewares/turnstileMiddleware");
const { validateGenericPhone } = require("../utils/phoneValidator");
const router = express.Router();

const {
  register,
  setRole,
  login,
  verifyEmail,
  resendCode,
  refreshToken,
  forgotPassword,
  resetPasswordController,
  getUserController,
  getUserRoleController,
  logout
} = require("../controllers/userController");

router.post(
  "/register",
  authLimiter,        
  verifyTurnstileToken,
  [
    check("firstName", "First name is required").notEmpty(),
    check("email", "Valid email is required").trim().isEmail().customSanitizer(email => email.toLowerCase()),
    check("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({
        min: 6,
      })
      .withMessage("Password must be at least 6 characters"),
    check("phone")
      .optional({ checkFalsy: true })
      .custom((value, { req }) => {
        const result = validateGenericPhone(value);
        if (!result.isValid) {
          throw new Error(result.message || "Phone number must be a valid international phone number");
        }
        req.body.phone = result.e164;
        return true;
      }),
  ],
  register
);

router.post(
  "/set-role",
  authenticateJWT,
  [
    check("role", "Role is required").notEmpty(),
    check("role", "Role must be either creator or brand").isIn([
      "creator",
      "brand",
    ]),
  ],
  setRole
);

router.post(
  "/login",
  authLimiter,       
  verifyTurnstileToken,
  [
    check("email", "Valid email is required").trim().isEmail().customSanitizer(email => email.toLowerCase()),
    check("password")
      .notEmpty()
      .withMessage("Password is required")
      .isLength({
        min: 6,
      })
      .withMessage("Password must be at least 6 characters"),
  ],
  login
);

router.post(
  "/verify-email",
  authLimiter,       
  [
    check("email", "Valid email is required").trim().isEmail().customSanitizer(email => email.toLowerCase()),
    check("code")
      .notEmpty()
      .withMessage("Verification code is required")
      .isLength({
        min: 6,
        max: 6,
      })
      .withMessage("Verification code must be exactly 6 characters"),
  ],
  verifyEmail
);

router.post("/resend-code",
  resendCodeLimiter, 
  verifyTurnstileToken,
  [
    check("email", "Valid email is required").trim().isEmail().customSanitizer(email => email.toLowerCase()),
  ],
  resendCode
)

router.post("/refresh-token", refreshToken);

router.post(
  "/forgot-password",
  passwordResetLimiter,
  verifyTurnstileToken,
  [
    check("email", "Valid email is required").trim().isEmail().customSanitizer(email => email.toLowerCase()),
  ],
  forgotPassword
);

router.post(
  "/reset-password",
  passwordResetLimiter,
  [
    check("token", "Reset token is required")
      .notEmpty()
      .isHexadecimal()
      .withMessage("Invalid token format")
      .isLength({ min: 64, max: 64 })
      .withMessage("Invalid token length"),
    check("newPassword", "Password must be at least 8 characters")
      .isLength({ min: 8 }),
  ],
  resetPasswordController
);

router.get("/", authenticateJWT, getUserController);
router.post("/logout", logout);
router.get("/role", authenticateJWT, getUserRoleController);

module.exports = router;
