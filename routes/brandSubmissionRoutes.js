const express = require("express");
const { body, param, query } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const {
  attachBrandContext,
} = require("../middlewares/attachBrandContextMiddleware");
const { reviewLimiter } = require("../middlewares/rateLimiter");
const {
  getCampaignSubmissionsController,
  getSubmissionDetailController,
  approveSubmissionController,
  requestRevisionController,
  rejectSubmissionController,
  getSubmissionStatsController,
  getApprovedAssetsController,
} = require("../controllers/brandSubmissionController");
const { REVISION_STATUS_VALUES, ASSET_REVIEW_STATUS_VALUES, ASSET_USAGE_TYPE_VALUES } = require("../config/submissionConstants");

const router = express.Router();

const brandGuard = [authenticateJWT, attachBrandContext];

const submissionPublicIdParam = param("submissionPublicId")
  .isString()
  .trim()
  .notEmpty()
  .withMessage("Submission ID is required.");

const feedbackBody = body("feedback")
  .isString()
  .trim()
  .notEmpty()
  .withMessage("Feedback is required.")
  .isLength({ max: 1000 })
  .withMessage("Feedback must not exceed 1000 characters.");

router.get(
  "/campaigns/:campaignPublicId/submissions/stats",
  ...brandGuard,
  param("campaignPublicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Campaign ID is required."),
  getSubmissionStatsController
);

router.get(
  "/campaigns/:campaignPublicId/submissions/assets",
  ...brandGuard,
  param("campaignPublicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Campaign ID is required."),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100."),
  query("usageType")
    .optional()
    .isIn(ASSET_USAGE_TYPE_VALUES)
    .withMessage(`usageType must be one of: ${ASSET_USAGE_TYPE_VALUES.join(", ")}.`),
  query("sort")
    .optional()
    .isIn(["uploadedAt", "approvedAt"])
    .withMessage("sort must be one of: uploadedAt, approvedAt."),
  query("search")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 100 })
    .withMessage("search must not exceed 100 characters."),
  getApprovedAssetsController
);

router.get(
  "/campaigns/:campaignPublicId/submissions",
  ...brandGuard,
  param("campaignPublicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Campaign ID is required."),
  query("status")
    .optional()
    .isIn(REVISION_STATUS_VALUES)
    .withMessage(
      `Status must be one of: ${REVISION_STATUS_VALUES.join(", ")}.`
    ),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100."),
  getCampaignSubmissionsController
);


router.get(
  "/submissions/:submissionPublicId",
  ...brandGuard,
  submissionPublicIdParam,
  getSubmissionDetailController
);

router.patch(
  "/submissions/:submissionPublicId/approve",
  ...brandGuard,
  reviewLimiter,
  submissionPublicIdParam,
  approveSubmissionController
);

router.patch(
  "/submissions/:submissionPublicId/request-revision",
  ...brandGuard,
  reviewLimiter,
  submissionPublicIdParam,
  feedbackBody,
  body("assetFeedback")
    .optional()
    .isArray()
    .withMessage("assetFeedback must be an array."),
  body("assetFeedback.*.assetPublicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Each assetFeedback entry must include a non-empty assetPublicId."),
  body("assetFeedback.*.reviewStatus")
    .isIn(ASSET_REVIEW_STATUS_VALUES)
    .withMessage(
      `Each assetFeedback reviewStatus must be one of: ${ASSET_REVIEW_STATUS_VALUES.join(", ")}.`
    ),
  body("assetFeedback.*.feedback")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Asset feedback must not exceed 500 characters."),
  requestRevisionController
);

router.patch(
  "/submissions/:submissionPublicId/reject",
  ...brandGuard,
  reviewLimiter,
  submissionPublicIdParam,
  feedbackBody,
  body("assetFeedback")
    .optional()
    .isArray()
    .withMessage("assetFeedback must be an array."),
  body("assetFeedback.*.assetPublicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Each assetFeedback entry must include a non-empty assetPublicId."),
  body("assetFeedback.*.reviewStatus")
    .isIn(ASSET_REVIEW_STATUS_VALUES)
    .withMessage(
      `Each assetFeedback reviewStatus must be one of: ${ASSET_REVIEW_STATUS_VALUES.join(", ")}.`
    ),
  body("assetFeedback.*.feedback")
    .optional()
    .isString()
    .isLength({ max: 500 })
    .withMessage("Asset feedback must not exceed 500 characters."),
  rejectSubmissionController
);

module.exports = router;
