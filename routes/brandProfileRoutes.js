const express = require("express");
const { body } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { uploadLimiter } = require("../middlewares/rateLimiter");
const upload = require("../middlewares/upload");
const { validateMediaFields, generateMulterFields } = require("../utils/mediaValidation");
const router = express.Router();

const BrandProfile = require("../models/brandProfile/brandProfile.model");
const { Op } = require("sequelize");

const {
  createOrUpdateProfile,
  getProfile,
} = require("../controllers/brandProfileController");

const brandProfileValidation = [
  body("companyName").notEmpty().withMessage("Company name required"),
  body("companyEmail")
    .isEmail()
    .withMessage("Valid company email required")
    .normalizeEmail()
    .custom(async (value, { req }) => {
      const existingProfile = await BrandProfile.findOne({
        where: {
          companyEmail: value,
          userId: { [Op.ne]: req.user.id },
        },
        attributes: ['id'], 
      });
      if (existingProfile) {
        throw new Error("Email already in use by another brand");
      }
      return true;
    }),
  body("country").notEmpty().withMessage("Country is required"),
  body("website").optional().isURL().withMessage("Website must be a valid URL"),
  body("businessType").optional().isString().withMessage("Business type must be a string"),
  body("jobRole").optional().isString().withMessage("Job role must be a string"),
  body("bio").optional().isString().withMessage("Bio must be a string"),
  body("phoneNumber")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (typeof value === "string" && value.includes("*")) {
        delete req.body.phoneNumber;
      }
      return true;
    }),
  body("companyRegistrationNumber")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (typeof value === "string" && value.includes("*")) {
        delete req.body.companyRegistrationNumber;
      }
      return true;
    })
    .isString()
    .withMessage("Company registration number must be a string"),
];

const brandMediaConfig = {
  logo: { 
    maxCount: 1,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"], 
    maxSize: 8 * 1024 * 1024 
  },
  operatingAttachment: { 
    maxCount: 1,
    allowedTypes: ["application/pdf", "image/jpeg", "image/png", "image/webp"], 
    maxSize: 10 * 1024 * 1024
  }
};

const brandProfileUpload = upload.fields(generateMulterFields(brandMediaConfig));
const brandMediaValidation = validateMediaFields(brandMediaConfig);

router.post(
  "/profile",
  authenticateJWT,
  uploadLimiter,
  brandProfileUpload,
  brandMediaValidation,
  brandProfileValidation,
  createOrUpdateProfile
);

router.get("/profile", authenticateJWT, getProfile);

module.exports = router;
