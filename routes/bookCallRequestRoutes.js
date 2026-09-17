const express = require("express");
const { body } = require("express-validator");
const { optionalAuthenticateJWT } = require("../middlewares/authMiddleware");
const { bookCallLimiter } = require("../middlewares/rateLimiter");
const { verifyTurnstileToken } = require("../middlewares/turnstileMiddleware");
const {
  submitBookCallRequest,
} = require("../controllers/bookCallRequestController");

const router = express.Router();

const submissionValidation = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters."),
  body("businessEmail")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .isLength({ max: 255 })
    .withMessage("Business email address must not exceed 255 characters.")
    .customSanitizer((email) => email.trim().toLowerCase()),
  body("companyName")
    .isString()
    .trim()
    .isLength({ min: 2, max: 150 })
    .withMessage("Company name must be between 2 and 150 characters."),
  body("companyWebsite")
    .isString()
    .trim()
    .isURL({ require_protocol: true, require_valid_protocol: true })
    .withMessage("Please provide a valid website URL starting with http:// or https://."),
];

router.post(
  "/",
  bookCallLimiter,
  optionalAuthenticateJWT,
  verifyTurnstileToken,
  ...submissionValidation,
  submitBookCallRequest
);

module.exports = router;
