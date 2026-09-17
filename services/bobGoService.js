const axios = require("axios");
const AppError = require("../utils/appError");

const client = axios.create({
  baseURL: process.env.BOBGO_API_URL,
  headers: { Authorization: `Bearer ${process.env.BOBGO_API_TOKEN}` },
  timeout: 40000,
});

const isConfigured = () => Boolean(process.env.BOBGO_API_URL && process.env.BOBGO_API_TOKEN);

const trackingUrlFor = (reference) => {
  const host = String(process.env.BOBGO_API_URL || "").includes("sandbox")
    ? "track.sandbox.bobgo.co.za"
    : "track.bobgo.co.za";
  return `https://${host}/${encodeURIComponent(reference)}`;
};

const fail = (err, fallback) => {
  const detail = err.response?.data?.message || err.response?.data?.error;
  throw new AppError(detail || fallback, err.response?.status === 400 ? 400 : 502);
};

const toBobGoAddress = (address) => ({
  company: address.company || "",
  street_address: address.streetAddress,
  local_area: address.localArea,
  city: address.city,
  zone: address.zone,
  country: "ZA",
  code: address.postalCode,
});

const toParcels = (parcel) => [
  {
    description: parcel.description || "Parcel",
    submitted_length_cm: Number(parcel.lengthCm),
    submitted_width_cm: Number(parcel.widthCm),
    submitted_height_cm: Number(parcel.heightCm),
    submitted_weight_kg: Number(parcel.weightKg),
  },
];

const contactFields = (collection, delivery, forShipment) => {
  const nameKey = forShipment ? "name" : "full_name";
  return {
    [`collection_contact_${nameKey}`]: collection.contactName,
    collection_contact_mobile_number: collection.contactMobile,
    collection_contact_email: collection.contactEmail || undefined,
    [`delivery_contact_${nameKey}`]: delivery.contactName,
    delivery_contact_mobile_number: delivery.contactMobile,
    delivery_contact_email: delivery.contactEmail || undefined,
  };
};

async function getRates({ collection, delivery, parcel, declaredValue = 0 }) {
  let data;
  try {
    ({ data } = await client.post("/rates", {
      collection_address: toBobGoAddress(collection),
      delivery_address: toBobGoAddress(delivery),
      parcels: toParcels(parcel),
      ...contactFields(collection, delivery, false),
      declared_value: declaredValue,
      timeout: 30000,
    }));
  } catch (err) {
    return fail(err, "Could not get courier prices");
  }

  const rates = [];
  for (const provider of data.provider_rate_requests || []) {
    if (provider.status !== "success") continue;
    for (const response of provider.responses || []) {
      if (response.status !== "success") continue;
      rates.push({
        id: `${provider.provider_slug}:${response.service_level_code}`,
        providerSlug: provider.provider_slug,
        serviceLevelCode: response.service_level_code,
        courierName: provider.provider_name,
        serviceLevel: response.service_level?.name || response.service_level_code,
        eta: response.service_level?.description || "",
        chargeableKg: response.charged_weight_kg,
        amount: response.rate_amount,
        amountExclVat: response.rate_amount_excl_vat,
      });
    }
  }

  return { rateRequestId: data.id, rates: rates.sort((a, b) => a.amount - b.amount) };
}

async function createShipment({ collection, delivery, parcel, rate, declaredValue = 0, reference }) {
  try {
    const { data } = await client.post("/shipments", {
      collection_address: toBobGoAddress(collection),
      delivery_address: toBobGoAddress(delivery),
      parcels: toParcels(parcel),
      ...contactFields(collection, delivery, true),
      declared_value: declaredValue,
      custom_order_number: reference,
      provider_slug: rate.providerSlug,
      service_level_code: rate.serviceLevelCode,
      timeout: 30000,
    });

    return {
      bobgoShipmentId: String(data.id),
      trackingReference: data.tracking_reference,
      submissionStatus: data.submission_status,
      status: data.status,
      failedReason: data.failed_reason || null,
      chargedAmount: data.charged_amount,
      chargedWeightKg: data.charged_weight_kg,
      estimatedCollectionAt: data.meta?.estimated_collection_date || null,
      estimatedDeliveryAt: data.meta?.estimated_delivery_date || null,
    };
  } catch (err) {
    return fail(err, "Could not book the courier");
  }
}

async function getWaybill(trackingReference) {
  let downloadUrl;
  try {
    const { data } = await client.get("/shipments/waybill", {
      params: { tracking_references: JSON.stringify([trackingReference]) },
    });
    downloadUrl = data.download_url;
  } catch (err) {
    return fail(err, "Could not download the waybill");
  }

  if (!downloadUrl) throw new AppError("The waybill is not ready yet", 409);

  const { data } = await axios.get(downloadUrl, { responseType: "arraybuffer", timeout: 40000 });
  return Buffer.from(data);
}

async function getTracking(trackingReference) {
  try {
    const { data } = await client.get("/tracking", { params: { tracking_reference: trackingReference } });
    const tracking = Array.isArray(data) ? data[0] : data;
    if (!tracking) return null;

    return {
      status: tracking.status,
      statusFriendly: tracking.status_friendly,
      courierName: tracking.courier_name,
      events: (tracking.tracking_events || []).map((event) => ({
        status: event.status,
        message: event.message || event.status_friendly || "",
        location: event.location || "",
        timestamp: event.time,
      })),
    };
  } catch (err) {
    return fail(err, "Could not load tracking");
  }
}

async function subscribeWebhooks(deliveryUrl) {
  const topics = [
    "tracking/updated",
    "shipment_submission_status/updated",
    "shipment_health_status/updated",
    "shipment_charged_amount/updated",
    "shipment_charged_weight/updated",
  ];

  try {
    const { data } = await client.post("/webhooks", {
      webhook_subscriptions: topics.map((topic) => ({ delivery_url: deliveryUrl, topic, status: "active" })),
    });
    return data;
  } catch (err) {
    return fail(err, "Could not subscribe to Bob Go webhooks");
  }
}

module.exports = {
  isConfigured,
  trackingUrlFor,
  getRates,
  createShipment,
  getWaybill,
  getTracking,
  subscribeWebhooks,
};
