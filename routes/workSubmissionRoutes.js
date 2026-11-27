const express = require("express");
const { body, param } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const {
  attachCreatorContext,
} = require("../middlewares/attachCreatorContextMiddleware");
const {
  requireApprovedCreator,
} = require("../middlewares/requireApprovedCreator");
const {
  submissionLimiter,
  reminderLimiter,
} = require("../middlewares/rateLimiter");
const {
  getJobSubmissionController,
  createSubmissionController,
  resubmitAfterRevisionController,
  sendReminderController,
} = require("../controllers/workSubmissionController");
const {
  ASSET_USAGE_TYPE_VALUES,
} = require("../config/submissionConstants");

const router = express.Router();

const creatorGuard = [
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
];

const jobPublicIdParam = param("jobPublicId")
  .isString()
  .trim()
  .notEmpty()
  .withMessage("Job ID is required.");

const assetsValidation = [
  body("assets")
    .optional()
    .isArray()
    .withMessage("assets must be an array."),
  body("assets.*.mediaId")
    .isInt({ min: 1 })
    .withMessage("Each asset must have a valid numeric mediaId."),
  body("assets.*.usageType")
    .isIn(ASSET_USAGE_TYPE_VALUES)
    .withMessage(
      `Each asset usageType must be one of: ${ASSET_USAGE_TYPE_VALUES.join(", ")}.`
    ),
];

const textFieldsValidation = [
  body("notes")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Notes must not exceed 500 characters."),
  body("captionOrHook")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Caption / hook must not exceed 200 characters."),
];


router.get(
  "/jobs/:jobPublicId/submission",
  ...creatorGuard,
  jobPublicIdParam,
  getJobSubmissionController
);


router.post(
  "/jobs/:jobPublicId/submission",
  ...creatorGuard,
  submissionLimiter,
  jobPublicIdParam,
  ...assetsValidation,
  ...textFieldsValidation,
  createSubmissionController
);


router.post(
  "/jobs/:jobPublicId/submission/resubmit",
  ...creatorGuard,
  submissionLimiter,
  jobPublicIdParam,
  ...assetsValidation,
  ...textFieldsValidation,
  resubmitAfterRevisionController
);


router.post(
  "/jobs/:jobPublicId/submission/remind",
  ...creatorGuard,
  reminderLimiter,
  jobPublicIdParam,
  body("message")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 200 })
    .withMessage("Reminder message must not exceed 200 characters."),
  sendReminderController
);

module.exports = router;
