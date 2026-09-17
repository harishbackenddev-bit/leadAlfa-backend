const express = require("express");
const { uploadLimiter } = require("../middlewares/rateLimiter");
const upload = require("../middlewares/upload");
const { validateMediaSingle } = require("../utils/mediaValidation");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");
const { uploadFile, getAssets, getCloudinaryAssets } = require("../controllers/assetController");

const router = express.Router();

const assetMediaConfig = {
  allowedTypes: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
  maxSize: 10 * 1024 * 1024,
};

router.use(authenticateJWT, allowRoles("admin"));

router.post(
  "/upload/:country/:category",
  uploadLimiter,
  upload.single("file"),
  validateMediaSingle(assetMediaConfig),
  uploadFile
);
router.get("/:country/:category", getAssets);
router.get("/live", getCloudinaryAssets);

module.exports = router;