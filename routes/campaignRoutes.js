const express = require("express");
const { body, check } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const {
  attachBrandContext,
} = require("../middlewares/attachBrandContextMiddleware");
const { uploadLimiter } = require("../middlewares/rateLimiter");
const upload = require("../middlewares/upload");
const { validateMediaFields, generateMulterFields } = require("../utils/mediaValidation");
const { VALID_VIDEO_LENGTHS, VALID_ADD_ON_KEYS } = require("../config/pricingConstants");
const {
  createCampaignController,
  updateCampaignController,
  submitForPaymentController,
  getCampaignByIdController,
  getBrandDraftsController,
  getCampaignsByBrandController,
  getPublicActiveCampaignsController,
  deleteDraftCampaignController,
  getInvoiceController,
} = require("../controllers/campaignController");

const router = express.Router();

const campaignMediaConfig = {
  coverImage: {
    maxCount: 1,
    allowedTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: 8 * 1024 * 1024
  },
  moodboards: {
    maxCount: 3,
    allowedTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxSize: 8 * 1024 * 1024 
  }
};

const campaignUpload = upload.fields(generateMulterFields(campaignMediaConfig));
const campaignMediaValidation = validateMediaFields(campaignMediaConfig);

const isJsonArray = (value) => {
  try {
    const arr = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(arr)) throw new Error();
    return true;
  } catch (e) {
    throw new Error("Must be a valid JSON array.");
  }
};

const isJsonObject = (value) => {
  try {
    const obj = typeof value === "string" ? JSON.parse(value) : value;
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) throw new Error();
    return true;
  } catch (e) {
    throw new Error("Must be a valid JSON object.");
  }
};

const validateAddOns = body("addOns")
  .optional({ checkFalsy: true })
  .custom((value) => {
    const arr = typeof value === "string" ? JSON.parse(value) : value;
    if (!Array.isArray(arr)) throw new Error("addOns must be a JSON array.");
    const invalid = arr.filter((k) => !VALID_ADD_ON_KEYS.includes(k));
    if (invalid.length > 0) {
      throw new Error(
        `Invalid add-on key(s): ${invalid.join(", ")}. Valid keys: ${VALID_ADD_ON_KEYS.join(", ")}.`
      );
    }
    return true;
  });


const campaignValidation = [
  body("campaignTitle").trim().notEmpty().withMessage("Campaign title is required."),
  body("deliverables").trim().notEmpty().withMessage("Deliverables configuration is required."),
  body("platform")
    .notEmpty()
    .custom(isJsonArray)
    .withMessage("Platform is required and must be a valid JSON array."),
  body("productStatus").trim().notEmpty().withMessage("Product status is required."),
  body("campaignGoal").optional().isString(),
  body("numberOfCreators")
    .isInt({ min: 1 })
    .withMessage("Number of creators must be a positive integer."),

  body("compensationType")
    .isIn(["Cash", "Gift"])
    .withMessage("Compensation type must be 'Cash' or 'Gift'."),

  body("videoLength")
    .if(body("compensationType").equals("Cash"))
    .notEmpty()
    .isIn(VALID_VIDEO_LENGTHS)
    .withMessage(`Video length must be one of: ${VALID_VIDEO_LENGTHS.join(", ")}.`),

  body("giftNameDescription")
    .if(body("compensationType").equals("Gift"))
    .trim()
    .notEmpty()
    .withMessage("Gift description is required for Gift compensation."),

  body("campaignBrief").trim().notEmpty().withMessage("Campaign brief is required."),
  body("ageRange").optional({ checkFalsy: true }).custom(isJsonArray).withMessage("ageRange must be a valid JSON array."),
  body("gender").optional({ checkFalsy: true }).custom(isJsonArray).withMessage("gender must be a valid JSON array."),
  body("followerCount").optional().isString(),
  body("engagementRate").optional().isString(),

  body("creativeDirection")
    .optional({ checkFalsy: true })
    .custom(isJsonObject)
    .withMessage("creativeDirection must be a valid JSON object."),
  body("keyMessage").optional().isString(),

  validateAddOns,

  body("productServiceUrl")
    .optional({ checkFalsy: true })
    .isURL()
    .withMessage("Must be a valid product/service URL."),
  body("location").optional({ checkFalsy: true }).custom(isJsonArray).withMessage("location must be a valid JSON array."),

  body("petsRequired").optional().isBoolean().withMessage("petsRequired must be a boolean."),
  body("typeOfPet")
    .if((value, { req }) => req.body.petsRequired === "true" || req.body.petsRequired === true)
    .trim()
    .notEmpty()
    .withMessage("Type of pet is required if pets are needed."),

  body("applicationDeadline").optional({ checkFalsy: true }).isISO8601().withMessage("Must be a valid ISO 8601 date."),
  body("campaignStarts").optional({ checkFalsy: true }).isISO8601().withMessage("Must be a valid ISO 8601 date."),

  body("moodboardsInspiration").optional().isString(),
  body("moodboardInspirationUrl")
    .if((value, { req }) => req.body.moodboardsInspiration === "URL")
    .isURL()
    .withMessage("Must provide a valid URL for moodboard inspiration."),

  check("coverImage").custom((value, { req }) => {
    if (req.method === "PATCH") return true; 
    if (!req.files?.coverImage?.length) {
      throw new Error("A cover image is required to create a campaign.");
    }
    if (req.files.coverImage.length > 1) {
      throw new Error("You can upload a maximum of 1 cover image.");
    }
    return true;
  }),

  check("moodboards").custom((value, { req }) => {
    if (!req.files?.moodboards) return true;
    if (req.files.moodboards.length > 3) {
      throw new Error("You can upload a maximum of 3 moodboard images.");
    }
    return true;
  }),
];

router.get("/active", authenticateJWT, getPublicActiveCampaignsController);

router.get(
  "/drafts",
  authenticateJWT,
  attachBrandContext,
  getBrandDraftsController
);

router.get(
  "/",
  authenticateJWT,
  attachBrandContext,
  getCampaignsByBrandController
);

router.post(
  "/",
  authenticateJWT,
  attachBrandContext,
  uploadLimiter,
  campaignUpload,
  campaignMediaValidation,
  campaignValidation,
  createCampaignController
);

router.patch(
  "/:publicId",
  authenticateJWT,
  attachBrandContext,
  uploadLimiter,
  campaignUpload,
  campaignMediaValidation,
  campaignValidation.filter((v) => v !== validateAddOns).map((v) => v.optional()),
  validateAddOns, 
  updateCampaignController
);


router.get(
  "/:publicId/invoice",
  authenticateJWT,
  attachBrandContext,
  getInvoiceController
);

router.post(
  "/:publicId/publish",
  authenticateJWT,
  attachBrandContext,
  submitForPaymentController
);

router.get("/details/:publicId", authenticateJWT, getCampaignByIdController);

router.get(
  "/:publicId",
  authenticateJWT,
  attachBrandContext,
  getCampaignByIdController
);

router.delete(
  "/:publicId",
  authenticateJWT,
  attachBrandContext,
  deleteDraftCampaignController
);

module.exports = router;
