const {
  sendShipmentBookedCreatorEmail,
  sendShipmentBookedBrandEmail,
  sendShipmentStatusCreatorEmail,
} = require("../utils/email/emailProvider");

const emailsOn = () => process.env.TOGGLE_EMAIL !== "false";

const alreadySent = (shipment, key) => (shipment.notificationsSent || []).includes(key);

async function markSent(shipment, key) {
  const sent = [...(shipment.notificationsSent || []), key];
  await shipment.update({ notificationsSent: sent });
}

const attempt = async (shipment, key, send) => {
  if (!emailsOn() || alreadySent(shipment, key)) return false;

  try {
    await send();
    await markSent(shipment, key);
    return true;
  } catch (err) {
    console.error("shipment email failed", { shipmentId: shipment.id, key, message: err.message });
    return false;
  }
};

const namesFrom = (shipment) => ({
  creatorName: [shipment.creator?.firstName, shipment.creator?.lastName].filter(Boolean).join(" ") || "there",
  creatorEmail: shipment.creator?.email,
  brandName: shipment.brand?.companyName || "A brand",
  brandEmail: shipment.brand?.companyEmail,
  campaignTitle: shipment.campaign?.campaignTitle || "a campaign",
});

async function notifyBooked(shipment) {
  const { creatorName, creatorEmail, brandName, brandEmail, campaignTitle } = namesFrom(shipment);

  if (creatorEmail) {
    await attempt(shipment, "booked:creator", () =>
      sendShipmentBookedCreatorEmail(creatorEmail, {
        creatorName,
        brandName,
        campaignTitle,
        courierName: shipment.courierName,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
      })
    );
  }

  if (brandEmail) {
    await attempt(shipment, "booked:brand", () =>
      sendShipmentBookedBrandEmail(brandEmail, {
        creatorName,
        courierName: shipment.courierName,
        trackingNumber: shipment.trackingNumber,
        waybillUrl: `${String(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/brand/shipments/${shipment.id}/view`,
      })
    );
  }
}

async function notifyStatus(shipment, event) {
  const { creatorName, creatorEmail, brandName } = namesFrom(shipment);
  if (!creatorEmail) return;

  await attempt(shipment, `status:${event}`, () =>
    sendShipmentStatusCreatorEmail(creatorEmail, {
      event,
      creatorName,
      brandName,
      courierName: shipment.courierName,
      trackingNumber: shipment.trackingNumber,
    })
  );
}

module.exports = { notifyBooked, notifyStatus };
