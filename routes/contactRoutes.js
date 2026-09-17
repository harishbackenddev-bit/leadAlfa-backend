const express = require("express");
const { body } = require("express-validator");
const { optionalAuthenticateJWT } = require("../middlewares/authMiddleware");
const { contactLimiter } = require("../middlewares/rateLimiter");
const { verifyTurnstileToken } = require("../middlewares/turnstileMiddleware");
const { submitContactRequest } = require("../controllers/contactController");
const { INQUIRY_CONFIG } = require("../config/contactConstants");

const router = express.Router();

const validInquiryKeys = Object.keys(INQUIRY_CONFIG);

// Public Contact Us Submission Validation
const submissionValidation = [
  body("name")
    .isString()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be between 2 and 100 characters."),
  body("email")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .isLength({ max: 255 })
    .withMessage("Email address must not exceed 255 characters.")
    .customSanitizer((email) => email.trim().toLowerCase()),
  body("inquiryType")
    .isIn(validInquiryKeys)
    .withMessage(
      `Inquiry type must be one of: ${validInquiryKeys.join(", ")}.`
    ),
  body("message")
    .isString()
    .trim()
    .isLength({ min: 10, max: 2000 })
    .withMessage("Message must be between 10 and 2000 characters."),
];

// Public Route
router.post(
  "/",
  contactLimiter,
  optionalAuthenticateJWT,
  verifyTurnstileToken,
  ...submissionValidation,
  submitContactRequest
);

module.exports = router;
