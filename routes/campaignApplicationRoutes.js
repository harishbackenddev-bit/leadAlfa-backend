const express = require("express");
const { body } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const {
  attachBrandContext,
} = require("../middlewares/attachBrandContextMiddleware");
const {
  attachCreatorContext,
} = require("../middlewares/attachCreatorContextMiddleware");
const {
  requireApprovedCreator,
} = require("../middlewares/requireApprovedCreator");
const { applicationLimiter } = require("../middlewares/rateLimiter");

const {
  applyToCampaignController,
  withdrawApplicationController,
  getCreatorApplicationsController,
  viewApplicantsController,
  updateApplicationStatusController,
} = require("../controllers/campaignApplicationController");

const router = express.Router();



const applicationValidation = [
  body("pitch").notEmpty().withMessage("A brief pitch is required."),
  body("mediaId")
    .notEmpty()
    .withMessage("mediaId is required.")
    .isInt({ gt: 0 })
    .withMessage("mediaId must be a positive integer."),
];

const updateStatusValidation = [
  body("newStatus")
    .isIn(["accepted", "rejected"])
    .withMessage("Status must be 'accepted' or 'rejected'."),
];

router.post(
  "/apply/:campaignId",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  applicationLimiter,
  applicationValidation,
  applyToCampaignController,
);

router.get(
  "/my-applications",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  getCreatorApplicationsController,
);

router.put(
  "/withdraw/:applicationId",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  withdrawApplicationController,
);

router.get(
  "/:campaignId/applicants",
  authenticateJWT,
  attachBrandContext,
  viewApplicantsController,
);

router.put(
  "/update-status/:applicationId",
  authenticateJWT,
  attachBrandContext,
  updateStatusValidation,
  updateApplicationStatusController,
);

module.exports = router;
