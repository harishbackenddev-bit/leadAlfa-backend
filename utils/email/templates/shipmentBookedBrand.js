const shipmentBookedBrand = ({ creatorName, courierName, trackingNumber, waybillUrl }) => {
  const subject = `Waybill ready for ${creatorName}`;
  const text = `Your shipment to ${creatorName} is booked with ${courierName}.

Tracking: ${trackingNumber}

Print the waybill and tape it to the parcel, barcode flat and visible, then have it ready for collection.
${waybillUrl}`;

  const html = `<p>Your shipment to <strong>${creatorName}</strong> is booked with ${courierName}.</p>
<p>Tracking: <strong>${trackingNumber}</strong></p>
<p>Print the waybill and tape it to the parcel, barcode flat and visible, then have it ready for collection.</p>
<p><a href="${waybillUrl}">Open the waybill</a></p>`;

  return { subject, text, html };
};

module.exports = shipmentBookedBrand;
