const express = require("express");
const { body } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { userFeedbackLimiter } = require("../middlewares/rateLimiter");
const {
  submitUserFeedback,
} = require("../controllers/userFeedbackController");
const { USER_FEEDBACK_TYPES } = require("../config/userFeedbackConstants");

const router = express.Router();

const validTypes = Object.values(USER_FEEDBACK_TYPES);

const submissionValidation = [
  body("type")
    .isIn(validTypes)
    .withMessage(`Type must be one of: ${validTypes.join(", ")}.`),
  body("description")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Description is required.")
    .isLength({ min: 5, max: 3000 })
    .withMessage("Description must be between 5 and 3000 characters."),
  body("pageUrl")
    .optional({ nullable: true })
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Page URL must not exceed 500 characters."),
];

router.post(
  "/",
  authenticateJWT,
  userFeedbackLimiter,
  ...submissionValidation,
  submitUserFeedback
);

module.exports = router;
