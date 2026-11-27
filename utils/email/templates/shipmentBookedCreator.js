const shipmentBookedCreator = ({ creatorName, brandName, campaignTitle, courierName, trackingNumber, trackingUrl }) => {
  const subject = `${brandName} sent you a parcel`;
  const text = `Hi ${creatorName},

${brandName} has selected you for ${campaignTitle} and sent you a parcel.

Courier: ${courierName}
Tracking: ${trackingNumber}
Track it: ${trackingUrl}

You don't need to do anything yet. We'll let you know when it's out for delivery.`;

  const html = `<p>Hi ${creatorName},</p>
<p><strong>${brandName}</strong> has selected you for <strong>${campaignTitle}</strong> and sent you a parcel.</p>
<p>Courier: ${courierName}<br/>Tracking: <strong>${trackingNumber}</strong></p>
<p><a href="${trackingUrl}">Track it here</a></p>
<p>You don't need to do anything yet. We'll let you know when it's out for delivery.</p>`;

  return { subject, text, html };
};

module.exports = shipmentBookedCreator;
