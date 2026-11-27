const express = require("express");
const { body, query } = require("express-validator");
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
const { INVITATION_STATUSES } = require("../services/campaignInvitationService");
const controllers = require("../controllers/campaignInvitationController");

const router = express.Router();

const sendInvitationsValidation = [
  body("creatorIds")
    .isArray({ min: 1 })
    .withMessage("creatorIds must be a non-empty array of integers."),
  body("creatorIds.*")
    .isInt()
    .withMessage("Each creatorId must be an integer."),
  body("customMessage")
    .optional()
    .isString()
    .withMessage("customMessage must be a string."),
];

const listBrandInvitationsValidation = [
  query("campaignId")
    .optional()
    .isInt()
    .withMessage("campaignId must be an integer."),
  query("status")
    .optional()
    .isIn(INVITATION_STATUSES)
    .withMessage(`status must be one of: ${INVITATION_STATUSES.join(", ")}`),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100."),
];

const listCreatorInvitationsValidation = [
  query("status")
    .optional()
    .isIn(INVITATION_STATUSES)
    .withMessage(`status must be one of: ${INVITATION_STATUSES.join(", ")}`),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100."),
];

// --- Brand Dashboard Routes ---
router.post(
  "/api/campaigns/:campaignId/invitations",
  authenticateJWT,
  attachBrandContext,
  sendInvitationsValidation,
  controllers.sendInvitationsController
);

router.get(
  "/api/brand/invitations",
  authenticateJWT,
  attachBrandContext,
  listBrandInvitationsValidation,
  controllers.getBrandInvitationsController
);

router.delete(
  "/api/brand/invitations/:publicId",
  authenticateJWT,
  attachBrandContext,
  controllers.withdrawInvitationController
);

// --- Creator Dashboard Routes ---
router.get(
  "/api/creator/invitations",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  listCreatorInvitationsValidation,
  controllers.getCreatorInvitationsController
);

router.get(
  "/api/creator/invitations/:publicId",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  controllers.getInvitationDetailsController
);

router.put(
  "/api/creator/invitations/:publicId/accept",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  controllers.acceptInvitationController
);

router.put(
  "/api/creator/invitations/:publicId/decline",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  controllers.declineInvitationController
);

module.exports = router;
