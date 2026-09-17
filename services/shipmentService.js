const AppError = require("../utils/appError");
const crypto = require("crypto");
const { sequelize } = require("../config/database");
const payfast = require("./payfastService");
const notifier = require("./shipmentNotifier");
const bobgo = require("./bobGoService");
const {
  Shipment,
  ShippingAddress,
  Campaign,
  BrandProfile,
  CreatorProfile,
  CampaignApplication,
} = require("../models");

const RATE_CARD = [
  { courierName: "Bob Go", serviceLevel: "Economy", eta: "2-3 business days", base: 65, perKg: 12 },
  { courierName: "Bob Go", serviceLevel: "Standard", eta: "1-2 business days", base: 78, perKg: 14 },
  { courierName: "Bob Go", serviceLevel: "Overnight", eta: "Next business day", base: 120, perKg: 18 },
  { courierName: "Bob Go", serviceLevel: "Express", eta: "Next business day", base: 145, perKg: 22 },
];

const WAYBILL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const waybillBlock = () =>
  Array.from({ length: 4 }, () => WAYBILL_ALPHABET[Math.floor(Math.random() * WAYBILL_ALPHABET.length)]).join("");

const generateWaybill = () => `TRK-${waybillBlock()}-${waybillBlock()}-${waybillBlock()}`;

const round2 = (value) => Math.round(value * 100) / 100;

const isProduction = () => process.env.APP_ENV === "production";

function chargeableWeight({ weightKg, lengthCm, widthCm, heightCm }) {
  const volumetric = (Number(lengthCm || 0) * Number(widthCm || 0) * Number(heightCm || 0)) / 4000;
  return Math.max(Number(weightKg) || 0, volumetric || 0);
}

function quoteRates(parcel) {
  const kg = chargeableWeight(parcel);
  if (!(kg > 0)) return [];
  return RATE_CARD.map((entry, index) => ({
    id: `rate-${index}`,
    courierName: entry.courierName,
    serviceLevel: entry.serviceLevel,
    eta: entry.eta,
    chargeableKg: round2(kg),
    amount: round2(entry.base + entry.perKg * kg),
  })).sort((a, b) => a.amount - b.amount);
}

const addEvent = (shipment, type, label, source) => [
  ...(shipment.events || []),
  { type, label, source, occurredAt: new Date().toISOString() },
];


const ADDRESS_FIELDS = [
  "streetAddress", "localArea", "city", "zone", "country", "postalCode",
  "company", "contactName", "contactEmail", "contactMobile",
];

const getAddress = (ownerType, ownerId) =>
  ShippingAddress.findOne({ where: { ownerType, ownerId } });

async function saveAddress(ownerType, ownerId, input) {
  const values = ADDRESS_FIELDS.reduce((acc, field) => {
    if (input[field] !== undefined) acc[field] = input[field];
    return acc;
  }, {});

  const existing = await getAddress(ownerType, ownerId);
  if (existing) return existing.update(values);
  return ShippingAddress.create({ ...values, ownerType, ownerId });
}

const mergeDeliveryOverride = (saved, patch) => {
  if (!patch) return saved;
  const clean = ADDRESS_FIELDS.reduce((acc, field) => {
    const value = patch[field];
    if (value !== undefined && String(value).trim() !== "") acc[field] = String(value).trim();
    return acc;
  }, {});
  return Object.keys(clean).length ? { ...(saved || {}), ...clean } : saved;
};

const asParcelAddress = (address) => {
  if (!address) return null;
  const plain = address.get({ plain: true });
  return ADDRESS_FIELDS.reduce((acc, field) => ({ ...acc, [field]: plain[field] }), {});
};

async function assertCreatorAcceptedOnCampaign(campaignId, creatorId, brandId) {
  const campaign = await Campaign.findOne({ where: { id: campaignId, brandId, isDeleted: false } });
  if (!campaign) throw new AppError("Campaign not found", 404);

  const application = await CampaignApplication.findOne({
    where: { campaignId, creatorId, applicationStatus: "accepted" },
  });
  if (!application) throw new AppError("That creator is not accepted on this campaign", 403);

  return campaign;
}

async function getCreatorAddressForBrand(brandId, campaignId, creatorId) {
  await assertCreatorAcceptedOnCampaign(campaignId, creatorId, brandId);
  return asParcelAddress(await getAddress("creator", creatorId));
}

async function createShipments(brandId, payload) {
  const { campaignId, creatorIds, productName, productImage, weightKg, lengthCm, widthCm, heightCm, rateId } = payload;

  for (const creatorId of creatorIds) {
    await assertCreatorAcceptedOnCampaign(campaignId, creatorId, brandId);
  }

  const collection = asParcelAddress(await getAddress("brand", brandId));
  if (!collection) throw new AppError("Add your collection address before shipping", 400);

  const overrides = payload.deliveryAddresses || {};
  const deliveries = new Map();
  for (const creatorId of creatorIds) {
    const saved = asParcelAddress(await getAddress("creator", creatorId));
    const address = mergeDeliveryOverride(saved, overrides[creatorId] ?? overrides[String(creatorId)]);
    if (!address) {
      const creator = await CreatorProfile.findByPk(creatorId, { attributes: ["firstName", "lastName"] });
      const name = [creator?.firstName, creator?.lastName].filter(Boolean).join(" ") || "That creator";
      throw new AppError(`${name} has not added a delivery address yet`, 409);
    }
    deliveries.set(creatorId, address);
  }

  const parcel = { weightKg, lengthCm, widthCm, heightCm, description: productName };
  const chosen = new Map();
  for (const creatorId of creatorIds) {
    const rates = await quoteForParcel(brandId, creatorId, parcel, deliveries.get(creatorId));
    const rate = rates.find((item) => item.id === rateId);
    if (!rate) throw new AppError("That courier option is not available for one of these creators", 400);
    chosen.set(creatorId, rate);
  }

  const paymentReference = `CT-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;

  const rows = creatorIds.map((creatorId) => ({
    campaignId,
    brandId,
    creatorId,
    productName,
    productImage: productImage || null,
    weightKg,
    lengthCm,
    widthCm,
    heightCm,
    status: "awaiting_payment",
    courierName: chosen.get(creatorId).courierName,
    serviceLevel: chosen.get(creatorId).serviceLevel,
    providerSlug: chosen.get(creatorId).providerSlug || null,
    serviceLevelCode: chosen.get(creatorId).serviceLevelCode || null,
    quotedAmount: chosen.get(creatorId).amount,
    chargeableKg: chosen.get(creatorId).chargeableKg,
    paymentReference,
    deliveryAddress: deliveries.get(creatorId),
    collectionAddress: collection,
    events: [{ type: "created", label: "Shipment created, awaiting payment", source: "brand", occurredAt: new Date().toISOString() }],
  }));

  const shipments = await Shipment.bulkCreate(rows, { returning: true });
  const amount = round2(rows.reduce((total, row) => total + Number(row.quotedAmount), 0));
  return { shipments, paymentReference, amount };
}

async function quoteForParcel(brandId, creatorId, parcel, deliveryOverride) {
  const collection = asParcelAddress(await getAddress("brand", brandId));
  if (!collection) throw new AppError("Add your collection address before shipping", 400);

  const delivery =
    mergeDeliveryOverride(asParcelAddress(await getAddress("creator", creatorId)), deliveryOverride);
  if (!delivery) throw new AppError("That creator has not added a delivery address yet", 409);

  if (!bobgo.isConfigured()) {
    if (isProduction()) throw new AppError("Courier pricing is unavailable right now", 503);
    return quoteRates(parcel);
  }

  const { rates } = await bobgo.getRates({ collection, delivery, parcel, declaredValue: parcel.declaredValue || 0 });
  return rates;
}

const STATUS_MAP = {
  "pending-collection": "awaiting_shipment",
  "collection-assigned": "awaiting_shipment",
  submitted: "awaiting_shipment",
  collected: "in_transit",
  "at-hub": "in_transit",
  "in-transit": "in_transit",
  "at-destination-hub": "in_transit",
  "out-for-delivery": "out_for_delivery",
  "ready-for-pickup": "out_for_delivery",
  delivered: "delivered",
  finalised: "delivered",
  cancelled: "cancelled",
  "failed-collection": "exception",
  "collection-exception": "exception",
  "failed-delivery": "exception",
  "delivery-exception": "exception",
};

const mapStatus = (raw) => {
  const mapped = STATUS_MAP[raw];
  if (!mapped) console.warn("unmapped bobgo status", { raw });
  return mapped || null;
};

const EMAIL_ON = { in_transit: "collected", out_for_delivery: "out_for_delivery", delivered: "delivered", exception: "exception" };

async function applyWebhook(payload) {
  const reference = payload.tracking_reference || payload.shipment_tracking_reference || payload.id;
  if (!reference || !/^[A-Za-z0-9/-]{1,40}$/.test(String(reference))) return;

  const shipment = await Shipment.findOne({ where: { trackingNumber: String(reference) }, ...withRelations });
  if (!shipment) return;

  const updates = {};

  if (payload.submission_status) updates.submissionStatus = payload.submission_status;
  if (payload.failed_reason) updates.failedReason = payload.failed_reason;
  if (payload.health_status) updates.healthStatus = payload.health_status;
  if (payload.charged_amount !== undefined) updates.chargedAmount = payload.charged_amount;
  if (payload.charged_weight_kg !== undefined) updates.chargedWeightKg = payload.charged_weight_kg;

  if (updates.chargedAmount !== undefined && shipment.quotedAmount) {
    updates.chargeDelta = round2(Number(updates.chargedAmount) - Number(shipment.quotedAmount));
  }

  const events = payload.tracking_events || [];
  if (events.length) {
    const known = new Set((shipment.events || []).map((e) => `${e.type}|${e.occurredAt}`));
    const merged = [...(shipment.events || [])];
    events.forEach((event) => {
      const key = `${event.status}|${event.time}`;
      if (known.has(key)) return;
      known.add(key);
      merged.push({
        type: event.status,
        label: event.status_friendly || event.message || event.status,
        source: "courier",
        occurredAt: event.time,
        location: event.location || "",
      });
    });
    updates.events = merged.sort((a, b) => new Date(a.occurredAt) - new Date(b.occurredAt));
  }

  const internal = payload.status ? mapStatus(payload.status) : null;
  if (internal && internal !== shipment.status) {
    if (internal === "delivered" && bobgo.isConfigured()) {
      const live = await bobgo.getTracking(shipment.trackingNumber);
      if (mapStatus(live?.status) !== "delivered") {
        console.warn("bobgo webhook claimed delivered, Bob Go disagrees", {
          shipmentId: shipment.id,
          claimed: payload.status,
          actual: live?.status,
        });
        return;
      }
      updates.deliveredAt = shipment.deliveredAt || new Date();
    }
    updates.status = internal;
  }

  if (!Object.keys(updates).length) return;
  await shipment.update(updates);

  const emailEvent = updates.status ? EMAIL_ON[updates.status] : null;
  if (emailEvent) {
    const full = await Shipment.findByPk(shipment.id, withRelations);
    if (full) await notifier.notifyStatus(full, emailEvent);
  }
}

async function getWaybillPdf(shipmentId, brandId) {
  const shipment = await Shipment.findOne({ where: { id: shipmentId, brandId } });
  if (!shipment) throw new AppError("Shipment not found", 404);
  if (!shipment.trackingNumber) throw new AppError("This shipment has no waybill yet", 409);
  if (!bobgo.isConfigured()) throw new AppError("Waybills are not available yet", 503);

  return bobgo.getWaybill(shipment.trackingNumber);
}

const bookRow = async (shipment, transaction) => {
  if (!bobgo.isConfigured() || !shipment.providerSlug) {
    if (isProduction()) {
      await shipment.update(
        {
          status: "awaiting_shipment",
          paid: true,
          events: addEvent(
            shipment,
            "booking_failed",
            "Payment received, but the courier could not be booked. Needs manual booking.",
            "system"
          ),
        },
        { transaction }
      );
      console.error("shipment paid but not booked", { shipmentId: shipment.id });
      return shipment;
    }

    const trackingNumber = generateWaybill();
    await shipment.update(
      {
        status: "awaiting_shipment",
        paid: true,
        trackingNumber,
        trackingUrl: `https://tracking.example.com/${trackingNumber}`,
        events: addEvent(shipment, "booked", "Payment received, courier booked", "brand"),
      },
      { transaction }
    );
    return shipment;
  }

  const booked = await bobgo.createShipment({
    collection: shipment.collectionAddress,
    delivery: shipment.deliveryAddress,
    parcel: {
      weightKg: shipment.weightKg,
      lengthCm: shipment.lengthCm,
      widthCm: shipment.widthCm,
      heightCm: shipment.heightCm,
      description: shipment.productName,
    },
    rate: { providerSlug: shipment.providerSlug, serviceLevelCode: shipment.serviceLevelCode },
    reference: `CT-${shipment.id}`,
  });

  const failed = ["no-rates", "failed-indefinitely"].includes(booked.submissionStatus);

  await shipment.update(
    {
      status: failed ? "booking_failed" : "awaiting_shipment",
      paid: true,
      bobgoShipmentId: booked.bobgoShipmentId,
      trackingNumber: booked.trackingReference,
      trackingUrl: booked.trackingReference ? bobgo.trackingUrlFor(booked.trackingReference) : null,
      submissionStatus: booked.submissionStatus,
      failedReason: booked.failedReason,
      chargedAmount: booked.chargedAmount,
      chargedWeightKg: booked.chargedWeightKg,
      estimatedCollectionAt: booked.estimatedCollectionAt,
      estimatedDeliveryAt: booked.estimatedDeliveryAt,
      events: addEvent(
        shipment,
        failed ? "booking_failed" : "booked",
        failed ? `Booking failed: ${booked.failedReason || booked.submissionStatus}` : "Payment received, courier booked",
        "brand"
      ),
    },
    { transaction }
  );

  return shipment;
};

async function bookPaidShipments(paymentReference, pfPaymentId) {
  if (!validReference(paymentReference)) throw new AppError("Invalid payment reference", 400);

  return sequelize.transaction(async (transaction) => {
    const shipments = await Shipment.findAll({
      where: { paymentReference },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });
    if (!shipments.length) throw new AppError("Unknown payment reference", 404);

    const alreadyDone = shipments.every((shipment) => shipment.status !== "awaiting_payment");
    if (alreadyDone) return shipments;

    for (const shipment of shipments) {
      if (shipment.status !== "awaiting_payment") continue;
      await shipment.update({ pfPaymentId }, { transaction });
      await bookRow(shipment, transaction);
    }

    return shipments;
  }).then(async (shipments) => {
    for (const shipment of shipments) {
      const full = await Shipment.findByPk(shipment.id, withRelations);
      if (full) await notifier.notifyBooked(full);
    }
    return shipments;
  });
}

const validReference = (reference) => typeof reference === "string" && /^CT-\d+-[a-f0-9]{8}$/.test(reference);

async function expectedPaymentFor(paymentReference) {
  if (!validReference(paymentReference)) return null;

  const shipments = await Shipment.findAll({ where: { paymentReference } });
  if (!shipments.length) return null;
  return {
    shipments,
    amount: round2(shipments.reduce((total, item) => total + Number(item.quotedAmount || 0), 0)),
  };
}

async function startCheckout(paymentReference, brandId, contactEmail) {
  if (!validReference(paymentReference)) throw new AppError("Invalid payment reference", 400);

  const shipments = await Shipment.findAll({ where: { paymentReference, brandId } });
  if (!shipments.length) throw new AppError("Shipment not found", 404);
  if (shipments.some((shipment) => shipment.status !== "awaiting_payment")) {
    throw new AppError("This shipment has already been paid for", 409);
  }

  const amount = round2(shipments.reduce((total, item) => total + Number(item.quotedAmount || 0), 0));

  let base = String(process.env.FRONTEND_URL || "").replace(/\/$/, "");
  try {
    base = new URL(base).origin;
  } catch {
  }

  return payfast.buildCheckout({
    reference: paymentReference,
    amount,
    itemName: `Shipping for ${shipments.length} parcel${shipments.length > 1 ? "s" : ""}`,
    returnUrl: `${base}/brand/shipments?payment=done`,
    cancelUrl: `${base}/brand/shipments?payment=cancelled`,
    notifyUrl: `${process.env.API_PUBLIC_URL || ""}/api/webhooks/payfast/${process.env.PAYFAST_WEBHOOK_SECRET_PATH}`,
    email: contactEmail,
  });
}

async function markDelivered(shipmentId, brandId) {
  const shipment = await Shipment.findOne({ where: { id: shipmentId, brandId } });
  if (!shipment) throw new AppError("Shipment not found", 404);
  if (!["awaiting_shipment", "in_transit"].includes(shipment.status)) {
    throw new AppError("Shipment is not in transit", 409);
  }

  await shipment.update({
    status: "delivered",
    deliveredAt: new Date(),
    events: addEvent(shipment, "delivered", "Shipment delivered", "courier"),
  });

  const full = await Shipment.findByPk(shipment.id, withRelations);
  if (full) await notifier.notifyStatus(full, "delivered");

  return full || shipment;
}

const withRelations = {
  include: [
    { model: Campaign, as: "campaign", attributes: ["id", "campaignTitle"] },
    { model: BrandProfile, as: "brand", attributes: ["id", "companyName", "companyEmail"] },
    { model: CreatorProfile, as: "creator", attributes: ["id", "firstName", "lastName", "publicName", "email"] },
  ],
};

const listForBrand = (brandId) =>
  Shipment.findAll({ where: { brandId }, ...withRelations, order: [["createdAt", "DESC"]] });

const { Op } = require("sequelize");

const listForCreator = (creatorId) =>
  Shipment.findAll({
    where: { creatorId, status: { [Op.ne]: "awaiting_payment" } },
    ...withRelations,
    order: [["createdAt", "DESC"]],
  });

async function getForBrand(shipmentId, brandId) {
  const shipment = await Shipment.findOne({ where: { id: shipmentId, brandId }, ...withRelations });
  if (!shipment) throw new AppError("Shipment not found", 404);
  return shipment;
}

async function getForCreator(shipmentId, creatorId) {
  const shipment = await Shipment.findOne({
    where: { id: shipmentId, creatorId, status: { [Op.ne]: "awaiting_payment" } },
    ...withRelations,
  });
  if (!shipment) throw new AppError("Shipment not found", 404);
  return shipment;
}

async function confirmReceived(shipmentId, creatorId) {
  const shipment = await getForCreator(shipmentId, creatorId);
  if (shipment.status !== "delivered") throw new AppError("Shipment has not been delivered yet", 409);

  await shipment.update({
    status: "content_creation",
    confirmedReceivedAt: new Date(),
    events: addEvent(shipment, "product_received", "Product received", "creator"),
  });

  return shipment;
}

const initialsOf = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");

const shape = (plain) => ({
  ...plain,
  campaignTitle: plain.campaign?.campaignTitle || "",
  brand: {
    name: plain.brand?.companyName || "",
    initials: initialsOf(plain.brand?.companyName),
  },
  creator: {
    name: [plain.creator?.firstName, plain.creator?.lastName].filter(Boolean).join(" "),
    handle: plain.creator?.publicName ? `@${plain.creator.publicName}` : "",
    initials: initialsOf([plain.creator?.firstName, plain.creator?.lastName].filter(Boolean).join(" ")),
  },
  dimensions: {
    length: plain.lengthCm,
    width: plain.widthCm,
    height: plain.heightCm,
  },
  deliveryAddress: plain.deliveryAddress || {},
  collectionAddress: plain.collectionAddress || {},
  events: plain.events || [],
});

const toBrandView = (shipment) => shape(shipment.get({ plain: true }));

const CREATOR_FIELDS = [
  "id", "campaignId", "campaignTitle", "productName", "productImage", "status", "courierName",
  "serviceLevel", "trackingNumber", "trackingUrl", "events", "estimatedDeliveryAt", "deliveredAt",
  "confirmedReceivedAt", "createdAt", "brand", "dimensions", "deliveryAddress",
];

const toCreatorView = (shipment) => {
  const full = shape(shipment.get({ plain: true }));
  return CREATOR_FIELDS.reduce((view, field) => ({ ...view, [field]: full[field] }), {});
};

module.exports = {
  quoteRates,
  quoteForParcel,
  isProduction,
  getWaybillPdf,
  applyWebhook,
  chargeableWeight,
  createShipments,
  getAddress,
  getCreatorAddressForBrand,
  mergeDeliveryOverride,
  saveAddress,
  asParcelAddress,
  bookPaidShipments,
  startCheckout,
  expectedPaymentFor,
  markDelivered,
  listForBrand,
  listForCreator,
  getForBrand,
  getForCreator,
  confirmReceived,
  toBrandView,
  toCreatorView,
};
