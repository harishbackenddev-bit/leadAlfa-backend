const express = require("express");
const { body, param } = require("express-validator");
const { authenticateJWT } = require("../middlewares/authMiddleware");
const { allowRoles } = require("../middlewares/roleMiddleware");
const { attachBrandContext } = require("../middlewares/attachBrandContextMiddleware");
const { attachCreatorContext } = require("../middlewares/attachCreatorContextMiddleware");
const { payfastItnController } = require("../controllers/payfastWebhookController");
const { bobGoWebhookController } = require("../controllers/bobGoWebhookController");

const {
  quoteRatesController,
  getWaybillController,
  getAddressController,
  getCreatorAddressController,
  saveAddressController,
  createShipmentsController,
  markDeliveredController,
  listBrandShipmentsController,
  getBrandShipmentController,
  listCreatorShipmentsController,
  getCreatorShipmentController,
  confirmReceivedController,
} = require("../controllers/shipmentController");

const router = express.Router();

const positive = (field, max) =>
  body(field).isFloat({ gt: 0, max }).withMessage(`${field} must be between 0 and ${max}`);

const deliveryOverride = (base) => [
  body(`${base}.streetAddress`).optional({ values: "falsy" }).trim().isLength({ max: 255 }),
  body(`${base}.localArea`).optional({ values: "falsy" }).trim().isLength({ max: 120 }),
  body(`${base}.city`).optional({ values: "falsy" }).trim().isLength({ max: 120 }),
  body(`${base}.zone`).optional({ values: "falsy" }).trim().isLength({ max: 120 }),
  body(`${base}.postalCode`).optional({ values: "falsy" }).trim().isLength({ max: 20 }),
  body(`${base}.country`).optional({ values: "falsy" }).trim().isLength({ max: 60 }),
  body(`${base}.contactName`).optional({ values: "falsy" }).trim().isLength({ max: 120 }),
  body(`${base}.contactMobile`).optional({ values: "falsy" }).trim().isLength({ max: 30 }),
];

const createValidation = [
  body("campaignId").isInt({ gt: 0 }).withMessage("campaignId is required"),
  body("creatorIds").isArray({ min: 1, max: 20 }).withMessage("Select at least one creator"),
  body("creatorIds.*").isInt({ gt: 0 }).withMessage("creatorIds must be positive integers"),
  body("productName").trim().notEmpty().isLength({ max: 255 }).withMessage("Product name is required"),
  positive("weightKg", 1000),
  positive("lengthCm", 500),
  positive("widthCm", 500),
  positive("heightCm", 500),
  body("rateId").trim().notEmpty().withMessage("Choose a courier option"),
  body("productImage")
    .optional({ values: "falsy" })
    .isString()
    .isLength({ max: 100000 })
    .withMessage("Product image is too large"),
  body("deliveryAddresses").optional().isObject().withMessage("deliveryAddresses must be an object"),
  ...deliveryOverride("deliveryAddresses.*"),
];

const idParam = [param("id").isInt({ gt: 0 }).withMessage("Invalid shipment id")];


const addressValidation = [
  body("streetAddress").trim().notEmpty().isLength({ max: 255 }).withMessage("Street address is required"),
  body("localArea").trim().notEmpty().isLength({ max: 120 }).withMessage("Suburb is required"),
  body("city").trim().notEmpty().isLength({ max: 120 }).withMessage("City is required"),
  body("zone").trim().notEmpty().isLength({ max: 120 }).withMessage("Province is required"),
  body("postalCode").trim().matches(/^\d{4}$/).withMessage("Postal code must be 4 digits"),
  body("contactName").trim().notEmpty().isLength({ max: 120 }).withMessage("Contact name is required"),
  body("contactMobile").trim().notEmpty().isLength({ max: 30 }).withMessage("Contact number is required"),
  body("contactEmail").optional({ values: "falsy" }).isEmail().withMessage("Contact email is not valid"),
  body("company").optional({ values: "falsy" }).trim().isLength({ max: 120 }),
  body("country").optional({ values: "falsy" }).trim().isLength({ max: 60 }),
];

const brandOnly = [authenticateJWT, allowRoles("brand"), attachBrandContext];
const creatorOnly = [authenticateJWT, allowRoles("creator"), attachCreatorContext];

router.get("/brand/shipping-address", brandOnly, getAddressController);
router.get(
  "/brand/campaigns/:campaignId/creators/:creatorId/shipping-address",
  brandOnly,
  [param("campaignId").isInt({ gt: 0 }), param("creatorId").isInt({ gt: 0 })],
  getCreatorAddressController
);
router.put("/brand/shipping-address", brandOnly, addressValidation, saveAddressController);

router.post(
  "/brand/shipment-rates",
  brandOnly,
  [
    body("creatorId").isInt({ gt: 0 }).withMessage("creatorId is required"),
    positive("weightKg", 1000),
    positive("lengthCm", 500),
    positive("widthCm", 500),
    positive("heightCm", 500),
    ...deliveryOverride("deliveryAddress"),
  ],
  quoteRatesController
);

router.post("/brand/shipments", brandOnly, createValidation, createShipmentsController);
router.get("/brand/shipments", brandOnly, listBrandShipmentsController);
router.get("/brand/shipments/:id", brandOnly, idParam, getBrandShipmentController);
router.get("/brand/shipments/:id/waybill", brandOnly, idParam, getWaybillController);
router.post("/brand/shipments/:id/mark-delivered", brandOnly, idParam, markDeliveredController);

router.get("/creator/shipping-address", creatorOnly, getAddressController);
router.put("/creator/shipping-address", creatorOnly, addressValidation, saveAddressController);

router.get("/creator/shipments", creatorOnly, listCreatorShipmentsController);
router.get("/creator/shipments/:id", creatorOnly, idParam, getCreatorShipmentController);
router.post("/creator/shipments/:id/confirm-receipt", creatorOnly, idParam, confirmReceivedController);

router.post(
  "/webhooks/payfast/:secret",
  express.urlencoded({ extended: false }),
  payfastItnController
);

router.post("/webhooks/bobgo/:secret", bobGoWebhookController);

module.exports = router;
