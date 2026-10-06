// routes/tradesafeRegistrationRoutes.js
const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");
const bankChangeController = require("../controllers/bankChangeController");
const {
  registerCreator,
  registerBrand,
  getTradeSafeStatus,
} = require("../controllers/tradesafeRegistrationController");

// ============================================================
// CREATOR REGISTRATION
// ============================================================
router.post(
  "/register/creator",
  authenticateJWT,
  allowRoles("creator"),
  registerCreator
);

// ============================================================
// BRAND REGISTRATION
// ============================================================
router.post(
  "/register/brand",
  authenticateJWT,
  allowRoles("brand"),
  registerBrand
);

// ============================================================
// TRADESAFE STATUS
// ============================================================
router.get(
  "/status",
  authenticateJWT,
  getTradeSafeStatus
);

// ============================================================
// BANK CHANGE REQUEST — Creator only
// ============================================================


router.post(
  "/bank-change-request",
  authenticateJWT,
  allowRoles("creator"),
  bankChangeController.createBankChangeRequest
);


router.get(
  "/bank-change-request",
  authenticateJWT,
  allowRoles("creator"),
  bankChangeController.getMyBankChangeRequests
);

module.exports = router;