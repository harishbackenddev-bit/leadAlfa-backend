const express = require("express");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { uploadLimiter } = require("../middlewares/rateLimiter");
const { initiateSignatureController } = require("../controllers/uploadController");

const router = express.Router();

router.post(
  "/initiate-signature",
  authenticateJWT,
  uploadLimiter,
  initiateSignatureController
);

module.exports = router;
