const express = require("express");
const { query } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const {
  attachCreatorContext,
} = require("../middlewares/attachCreatorContextMiddleware");
const {
  requireApprovedCreator,
} = require("../middlewares/requireApprovedCreator");
const {
  getCreatorJobsController,
} = require("../controllers/creatorJobController");
const { JOB_STATUSES } = require("../config/jobConstants");

const router = express.Router();

const listJobsValidation = [
  query("status")
    .optional()
    .isIn(JOB_STATUSES)
    .withMessage(`Status must be one of: ${JOB_STATUSES.join(", ")}.`),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer."),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be an integer between 1 and 100."),
];

router.get(
  "/jobs",
  authenticateJWT,
  attachCreatorContext,
  requireApprovedCreator,
  listJobsValidation,
  getCreatorJobsController
);

module.exports = router;
