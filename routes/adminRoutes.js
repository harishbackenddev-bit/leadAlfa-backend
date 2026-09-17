const express = require("express");
const { body, param } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");
const {
  getCreatorProfileRequests,
  approveProfile,
  rejectProfile,
  askClarification,
  deleteProfileRequest,
  getCreatorProfileById,
  getBrandProfileRequests,
  getBrandProfileById,
  approveBrandProfile,
  rejectBrandProfile,
  askBrandClarification,
  deleteBrandProfileRequest,
} = require("../controllers/adminController");
const {
  getContactRequests,
  getContactRequestByPublicId,
  updateContactRequest,
} = require("../controllers/contactController");
const {
  getBookCallRequests,
  getBookCallRequestByPublicId,
  updateBookCallRequest,
} = require("../controllers/bookCallRequestController");
const {
  getUserFeedbacks,
  getUserFeedbackByPublicId,
  updateUserFeedback,
} = require("../controllers/userFeedbackController");
const { CONTACT_STATUSES } = require("../config/contactConstants");
const { BOOK_CALL_STATUSES } = require("../config/bookCallConstants");
const { USER_FEEDBACK_STATUSES } = require("../config/userFeedbackConstants");

const router = express.Router();

router.use(authenticateJWT, allowRoles("admin"));

// Creator Profile Admin Routes
router.get("/creator-profiles", getCreatorProfileRequests);
router.get("/creator-profiles/:id", getCreatorProfileById);
router.put("/creator-profiles/:id/approve", approveProfile);
router.put("/creator-profiles/:id/reject", rejectProfile);
router.put("/creator-profiles/:id/clarify", askClarification);
router.delete("/creator-profiles/:id", deleteProfileRequest);

// Brand Profile Admin Routes
router.get("/brand-profiles", getBrandProfileRequests);
router.get("/brand-profiles/:id", getBrandProfileById);
router.put("/brand-profiles/:id/approve", approveBrandProfile);
router.put("/brand-profiles/:id/reject", rejectBrandProfile);
router.put("/brand-profiles/:id/clarify", askBrandClarification);
router.delete("/brand-profiles/:id", deleteBrandProfileRequest);

// Contact Request Admin Routes
const adminContactUpdateValidation = [
  param("publicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Public ID parameter is required."),
  body("status")
    .optional()
    .isIn(CONTACT_STATUSES)
    .withMessage(
      `Status must be one of: ${CONTACT_STATUSES.join(", ")}.`
    ),
  body("adminNotes")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Admin notes must not exceed 1000 characters."),
  body().custom((value, { req }) => {
    if (req.body.status === undefined && req.body.adminNotes === undefined) {
      throw new Error(
        "At least one field (status or adminNotes) must be provided for update."
      );
    }
    return true;
  }),
];

router.get("/contact-requests", getContactRequests);
router.get(
  "/contact-requests/:publicId",
  param("publicId").isString().trim().notEmpty(),
  getContactRequestByPublicId
);
router.patch(
  "/contact-requests/:publicId",
  ...adminContactUpdateValidation,
  updateContactRequest
);

// Book a Call Admin Routes
const adminBookCallUpdateValidation = [
  param("publicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Public ID parameter is required."),
  body("status")
    .optional()
    .isIn(BOOK_CALL_STATUSES)
    .withMessage(
      `Status must be one of: ${BOOK_CALL_STATUSES.join(", ")}.`
    ),
  body("adminNotes")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Admin notes must not exceed 1000 characters."),
  body().custom((value, { req }) => {
    if (req.body.status === undefined && req.body.adminNotes === undefined) {
      throw new Error(
        "At least one field (status or adminNotes) must be provided for update."
      );
    }
    return true;
  }),
];

router.get("/book-call-requests", getBookCallRequests);
router.get(
  "/book-call-requests/:publicId",
  param("publicId").isString().trim().notEmpty(),
  getBookCallRequestByPublicId
);
router.patch(
  "/book-call-requests/:publicId",
  ...adminBookCallUpdateValidation,
  updateBookCallRequest
);

// User Feedback & Bug Report Admin Routes
const adminUserFeedbackUpdateValidation = [
  param("publicId")
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Public ID parameter is required."),
  body("status")
    .optional()
    .isIn(USER_FEEDBACK_STATUSES)
    .withMessage(
      `Status must be one of: ${USER_FEEDBACK_STATUSES.join(", ")}.`
    ),
  body("adminNotes")
    .optional()
    .isString()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Admin notes must not exceed 1000 characters."),
  body().custom((value, { req }) => {
    if (req.body.status === undefined && req.body.adminNotes === undefined) {
      throw new Error(
        "At least one field (status or adminNotes) must be provided for update."
      );
    }
    return true;
  }),
];

router.get("/user-feedback", getUserFeedbacks);
router.get(
  "/user-feedback/:publicId",
  param("publicId").isString().trim().notEmpty(),
  getUserFeedbackByPublicId
);
router.patch(
  "/user-feedback/:publicId",
  ...adminUserFeedbackUpdateValidation,
  updateUserFeedback
);

module.exports = router;
