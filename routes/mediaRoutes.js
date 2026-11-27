const express = require("express");
const { body, param } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const {
  registerMediaController,
  getSecureMediaUrl,
  downloadMediaController,
} = require("../controllers/mediaController");

const router = express.Router();

const registerMediaValidation = [
  body("s3Key")
    .optional()
    .isString()
    .withMessage("s3Key must be a string."),

  body("public_id")
    .optional()
    .isString()
    .withMessage("public_id must be a string."),

  body(["original_name", "originalName"])
    .optional()
    .isString()
    .withMessage("Original file name must be a string."),

  body().custom((body) => {
    if (!body.s3Key && !body.public_id) {
      throw new Error("Either s3Key (S3 upload) or public_id (Cloudinary upload) is required.");
    }
    return true;
  }),
];

router.post(
  "/register",
  authenticateJWT,
  registerMediaValidation,
  registerMediaController
);

router.get(
  "/:mediaId/secure-url",
  authenticateJWT,
  [param("mediaId").isInt().withMessage("mediaId must be an integer")],
  getSecureMediaUrl
);

router.get(
  "/:mediaId/download",
  authenticateJWT,
  [param("mediaId").isInt().withMessage("mediaId must be an integer")],
  downloadMediaController
);

module.exports = router;
