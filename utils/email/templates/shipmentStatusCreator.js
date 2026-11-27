const COPY = {
  collected: {
    subject: "Your parcel is on its way",
    line: "The courier has collected your parcel and it's now in transit.",
  },
  out_for_delivery: {
    subject: "Your parcel arrives today",
    line: "Your parcel is out for delivery and should reach you today.",
  },
  delivered: {
    subject: "Your parcel has been delivered",
    line: "Your parcel has been delivered. Please confirm you received it so the campaign can continue.",
  },
  exception: {
    subject: "There's a problem with your parcel",
    line: "The courier couldn't complete delivery. The brand has been notified and will follow up.",
  },
};

const shipmentStatusCreator = ({ event, creatorName, brandName, courierName, trackingNumber }) => {
  const copy = COPY[event];
  if (!copy) return null;

  const text = `Hi ${creatorName},

${copy.line}

From: ${brandName}
Courier: ${courierName}
Tracking: ${trackingNumber}`;

  const html = `<p>Hi ${creatorName},</p>
<p>${copy.line}</p>
<p>From: ${brandName}<br/>Courier: ${courierName}<br/>Tracking: <strong>${trackingNumber}</strong></p>`;

  return { subject: copy.subject, text, html };
};

module.exports = shipmentStatusCreator;
