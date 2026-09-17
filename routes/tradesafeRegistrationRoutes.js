// routes/tradesafeRegistrationRoutes.js
const express = require("express");
const router = express.Router();
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");
const {
  registerCreator,
  registerBrand,
  getTradeSafeStatus,
} = require("../controllers/tradesafeRegistrationController");

// Creator registration
router.post(
  "/register/creator",
  authenticateJWT,
  allowRoles("creator"),
  registerCreator
);

// Brand registration
router.post(
  "/register/brand",
  authenticateJWT,
  allowRoles("brand"),
  registerBrand
);

// Get TradeSafe status
router.get(
  "/status",
  authenticateJWT,
  getTradeSafeStatus
);

module.exports = router;