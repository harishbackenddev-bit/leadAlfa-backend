const express = require("express");
const { body } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { uploadLimiter } = require("../middlewares/rateLimiter");
const upload = require("../middlewares/upload");
const { validateMediaFields, generateMulterFields } = require("../utils/mediaValidation");
const { validateSAIdNumber } = require("../utils/saIdValidator");
const { validateSouthAfricanPhone } = require("../utils/phoneValidator");
const { allowRoles } = require("../middlewares/roleMiddleware");
const {
  createOrUpdateProfile,
  getProfile,
  getApprovedCreatorsList,
  checkPublicNameAvailabilityController,
  reuploadDocumentsController,
  updateIntroVideoController,
} = require("../controllers/creatorProfileController");
const {
  getPortfolioVideosController,
  addPortfolioVideoController,
  removePortfolioVideoController,
} = require("../controllers/portfolioController");
const { attachCreatorContext } = require("../middlewares/attachCreatorContextMiddleware");

const router = express.Router();

const creatorMediaConfig = {
  profilePhoto: {
    maxCount: 1,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: 5 * 1024 * 1024
  },
  residencePermit: {
    maxCount: 1,
    allowedTypes: ["application/pdf"],
    maxSize: 10 * 1024 * 1024 // 10MB
  },
  portfolio: {
    maxCount: 15,
    allowedTypes: ["video/mp4", "video/quicktime", "application/octet-stream"], // .mp4 and .mov
    maxSize: 100 * 1024 * 1024 // 100MB per file
  }
};

const reuploadMediaConfig = {
  residencePermit: creatorMediaConfig.residencePermit,
};

const creatorProfileUpload = upload.fields(generateMulterFields(creatorMediaConfig));
const creatorMediaValidation = validateMediaFields(creatorMediaConfig);

const reuploadDocumentsUpload = upload.fields(generateMulterFields(reuploadMediaConfig));
const reuploadDocumentsMediaValidation = validateMediaFields(reuploadMediaConfig);

const creatorProfileValidation = [
  body("firstName").trim().notEmpty().withMessage("First name required"),
  body("lastName").optional().isString().withMessage("Last name must be a string"),
  body("publicName")
    .optional({ checkFalsy: true })
    .isString()
    .withMessage("Public name must be a string")
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("Public name must be between 2 and 50 characters"),
  body("email").optional().isEmail().withMessage("Must be a valid email"),
  body("phoneNumber")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (typeof value === "string" && value.includes("*")) {
        delete req.body.phoneNumber;
        return true;
      }
      const result = validateSouthAfricanPhone(value);
      if (!result.isValid) {
        throw new Error(result.message || "Phone number must be a valid South African phone number");
      }
      req.body.phoneNumber = result.e164;
      return true;
    }),
  body("province").optional().isString().withMessage("Province must be a string"),
  body("city").optional().isString().withMessage("City must be a string"),
  body("streetNumber").optional().isString().withMessage("Street number must be a string"),
  body("addressLine1").optional().isString().withMessage("Address line 1 must be a string"),
  body("addressLine2").optional().isString().withMessage("Address line 2 must be a string"),
  body("suburb").optional().isString().withMessage("Suburb must be a string"),
  body("postalCode")
    .optional({ checkFalsy: true })
    .custom((value) => {
      if (!/^\d{4}$/.test(String(value).trim())) {
        throw new Error("Postal code must be a 4-digit South African postal code (e.g. 8001)");
      }
      return true;
    }),
  body("deliveryInstructions").optional().isString().withMessage("Delivery instructions must be a string"),
  body("ethnicity").optional().isString().withMessage("Ethnicity must be a string"),
  body("gender").optional().isString().withMessage("Gender must be a string"),
  body("bio").optional().isString().withMessage("Bio must be a string"),
  body("categories")
    .optional()
    .isString()
    .withMessage("Categories must be JSON string of ids"),
  body("skills")
    .optional()
    .isString()
    .withMessage("Skills must be JSON string of ids"),
  body("languages")
    .optional()
    .isString()
    .withMessage("Languages must be a JSON string array"),
  body("primaryNiches")
    .optional()
    .isString()
    .withMessage("Primary Niches must be a JSON string array"),
  body("secondaryNiches")
    .optional()
    .isString()
    .withMessage("Secondary Niches must be a JSON string array"),
  body("appearance")
    .optional()
    .isString()
    .withMessage("Appearance must be a JSON string array"),
  body("dateOfBirth")
    .optional({ checkFalsy: true })
    .isDate()
    .withMessage("Date of birth must be a valid date")
    .custom((value) => {
      const birthDate = new Date(value);
      if (isNaN(birthDate.getTime())) {
        throw new Error("Date of birth must be a valid date");
      }
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      if (age < 18) {
        throw new Error("Creator must be at least 18 years old");
      }
      return true;
    }),
  body("isSouthAfricanCitizen")
    .optional()
    .isBoolean()
    .withMessage("isSouthAfricanCitizen must be a boolean"),
  body("saIdNumber")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (typeof value === "string" && value.includes("*")) {
        delete req.body.saIdNumber;
        return true;
      }
      const result = validateSAIdNumber(value);

      if (!result.valid) {
        throw new Error(result.message);
      }

      return true;
    }),
  body("passportNumber")
    .optional({ checkFalsy: true })
    .custom((value, { req }) => {
      if (typeof value === "string" && value.includes("*")) {
        delete req.body.passportNumber;
      }
      return true;
    })
    .isString()
    .withMessage("Passport Number must be a string"),
  body("hasPets")
    .optional()
    .isBoolean(),
  body("hasChildren")
    .optional()
    .isBoolean(),
  body("introVideoMediaId")
    .optional({ checkFalsy: true })
    .isInt({ min: 1 })
    .withMessage("introVideoMediaId must be a positive integer"),
  body("instagramUrl")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Instagram URL must be a valid URL"),
  body("tiktokUrl")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("TikTok URL must be a valid URL"),
  body("youtubeChannelUrl")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("YouTube Channel URL must be a valid URL"),
  body("skillsUrl")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Skills URL must be a valid URL"),
];

router.post(
  "/profile",
  authenticateJWT,
  uploadLimiter,
  creatorProfileUpload,
  creatorMediaValidation,
  creatorProfileValidation,
  createOrUpdateProfile
);

router.post(
  "/profile/reupload-documents",
  authenticateJWT,
  allowRoles("creator"),
  uploadLimiter,
  reuploadDocumentsUpload,
  reuploadDocumentsMediaValidation,
  [
    body("introVideoMediaId")
      .optional({ checkFalsy: true })
      .isInt({ min: 1 })
      .withMessage("introVideoMediaId must be a positive integer"),
  ],
  reuploadDocumentsController
);

router.post(
  "/profile/intro-video",
  authenticateJWT,
  allowRoles("creator"),
  [
    body("mediaId")
      .notEmpty().withMessage("mediaId is required")
      .isInt({ min: 1 }).withMessage("mediaId must be a positive integer"),
  ],
  updateIntroVideoController
);

router.get("/profile", authenticateJWT, allowRoles("creator"), getProfile);

router.get(
  "/profile/public-name/availability",
  authenticateJWT,
  checkPublicNameAvailabilityController
);

router.get(
  "/list",
  authenticateJWT,
  allowRoles("brand"),
  getApprovedCreatorsList
);

// Portfolio video management
router.get(
  "/profile/portfolio-videos",
  authenticateJWT,
  allowRoles("creator"),
  attachCreatorContext,
  getPortfolioVideosController
);

router.post(
  "/profile/portfolio-videos",
  authenticateJWT,
  allowRoles("creator"),
  attachCreatorContext,
  addPortfolioVideoController
);

router.delete(
  "/profile/portfolio-videos/:mediaId",
  authenticateJWT,
  allowRoles("creator"),
  attachCreatorContext,
  removePortfolioVideoController
);

module.exports = router;
