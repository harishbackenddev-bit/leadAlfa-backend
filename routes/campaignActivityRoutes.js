"use strict";

const express = require("express");
const { param, query } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { attachBrandContext } = require("../middlewares/attachBrandContextMiddleware");
const { getCampaignActivityController } = require("../controllers/campaignActivityController");
const { ACTIVITY_EVENT_TYPES } = require("../config/submissionConstants");

const router = express.Router();

const brandGuard = [authenticateJWT, attachBrandContext];

const VALID_EVENT_TYPES = Object.values(ACTIVITY_EVENT_TYPES);


router.get(
  "/campaigns/:campaignPublicId/activity",
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
  query("eventType")
    .optional()
    .isIn(VALID_EVENT_TYPES)
    .withMessage(`eventType must be one of: ${VALID_EVENT_TYPES.join(", ")}.`),
  getCampaignActivityController
);

module.exports = router;
