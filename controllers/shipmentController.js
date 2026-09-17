const { validationResult } = require("express-validator");
const AppError = require("../utils/appError");
const shipmentService = require("../services/shipmentService");
const payfast = require("../services/payfastService");

const fail = (res, err, fallback) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  console.error(err);
  return res.status(500).json({ error: fallback });
};

const rejectInvalid = (req, res) => {
  const errors = validationResult(req).formatWith(({ msg, path }) => ({ field: path, message: msg }));
  if (errors.isEmpty()) return false;
  res.status(400).json({ errors: errors.array() });
  return true;
};

const ownerOf = (req) => (req.brandId ? ["brand", req.brandId] : ["creator", req.creatorId]);

const getCreatorAddressController = async (req, res) => {
  if (rejectInvalid(req, res)) return;

  try {
    const address = await shipmentService.getCreatorAddressForBrand(
      req.brandId,
      Number(req.params.campaignId),
      Number(req.params.creatorId)
    );
    return res.json({ address });
  } catch (err) {
    return fail(res, err, "Could not load that creator's address");
  }
};

const getAddressController = async (req, res) => {
  try {
    const [ownerType, ownerId] = ownerOf(req);
    const address = await shipmentService.getAddress(ownerType, ownerId);
    return res.json({ address: shipmentService.asParcelAddress(address) });
  } catch (err) {
    return fail(res, err, "Could not load your address");
  }
};

const saveAddressController = async (req, res) => {
  if (rejectInvalid(req, res)) return;

  try {
    const [ownerType, ownerId] = ownerOf(req);
    const address = await shipmentService.saveAddress(ownerType, ownerId, req.body);
    return res.json({ address: shipmentService.asParcelAddress(address) });
  } catch (err) {
    return fail(res, err, "Could not save your address");
  }
};

const createShipmentsController = async (req, res) => {
  if (rejectInvalid(req, res)) return;

  try {
    const { shipments, paymentReference } = await shipmentService.createShipments(req.brandId, {
      campaignId: req.body.campaignId,
      creatorIds: req.body.creatorIds,
      productName: req.body.productName,
      productImage: req.body.productImage,
      deliveryAddresses: req.body.deliveryAddresses,
      weightKg: req.body.weightKg,
      lengthCm: req.body.lengthCm,
      widthCm: req.body.widthCm,
      heightCm: req.body.heightCm,
      rateId: req.body.rateId,
    });

    if (!payfast.isConfigured() && shipmentService.isProduction()) {
      throw new AppError("Payment is unavailable right now", 503);
    }

    if (!payfast.isConfigured()) {
      console.warn("shipment booked without payment - PayFast is not configured", {
        paymentReference,
        brandId: req.brandId,
      });
      const booked = await shipmentService.bookPaidShipments(paymentReference, null);
      return res.status(201).json({
        shipments: booked.map(shipmentService.toBrandView),
        paymentReference,
        checkout: null,
      });
    }

    const checkout = await shipmentService.startCheckout(paymentReference, req.brandId, req.user?.email);

    return res.status(201).json({
      shipments: shipments.map(shipmentService.toBrandView),
      paymentReference,
      checkout,
    });
  } catch (err) {
    return fail(res, err, "Could not create shipments");
  }
};

const quoteRatesController = async (req, res) => {
  if (rejectInvalid(req, res)) return;

  try {
    const rates = await shipmentService.quoteForParcel(req.brandId, req.body.creatorId, {
      weightKg: req.body.weightKg,
      lengthCm: req.body.lengthCm,
      widthCm: req.body.widthCm,
      heightCm: req.body.heightCm,
      description: req.body.productName,
    }, req.body.deliveryAddress);

    if (!rates.length) {
      return res.status(400).json({
        error:
          "No courier will take this parcel. Check the weight and dimensions, then both addresses.",
      });
    }

    return res.json({ rates });
  } catch (err) {
    return fail(res, err, "Could not load courier prices");
  }
};

const getWaybillController = async (req, res) => {
  try {
    const pdf = await shipmentService.getWaybillPdf(req.params.id, req.brandId);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="waybill-${req.params.id}.pdf"`);
    return res.send(pdf);
  } catch (err) {
    return fail(res, err, "Could not load the waybill");
  }
};

const markDeliveredController = async (req, res) => {
  try {
    const shipment = await shipmentService.markDelivered(req.params.id, req.brandId);
    return res.json({ shipment: shipmentService.toBrandView(shipment) });
  } catch (err) {
    return fail(res, err, "Could not update this shipment");
  }
};

const listBrandShipmentsController = async (req, res) => {
  try {
    const shipments = await shipmentService.listForBrand(req.brandId);
    return res.json({ shipments: shipments.map(shipmentService.toBrandView) });
  } catch (err) {
    return fail(res, err, "Could not load shipments");
  }
};

const getBrandShipmentController = async (req, res) => {
  try {
    const shipment = await shipmentService.getForBrand(req.params.id, req.brandId);
    return res.json({ shipment: shipmentService.toBrandView(shipment) });
  } catch (err) {
    return fail(res, err, "Could not load this shipment");
  }
};

const listCreatorShipmentsController = async (req, res) => {
  try {
    const shipments = await shipmentService.listForCreator(req.creatorId);
    return res.json({ shipments: shipments.map(shipmentService.toCreatorView) });
  } catch (err) {
    return fail(res, err, "Could not load your shipments");
  }
};

const getCreatorShipmentController = async (req, res) => {
  try {
    const shipment = await shipmentService.getForCreator(req.params.id, req.creatorId);
    return res.json({ shipment: shipmentService.toCreatorView(shipment) });
  } catch (err) {
    return fail(res, err, "Could not load this shipment");
  }
};

const confirmReceivedController = async (req, res) => {
  try {
    const shipment = await shipmentService.confirmReceived(req.params.id, req.creatorId);
    return res.json({ shipment: shipmentService.toCreatorView(shipment) });
  } catch (err) {
    return fail(res, err, "Could not confirm receipt");
  }
};

module.exports = {
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
};
