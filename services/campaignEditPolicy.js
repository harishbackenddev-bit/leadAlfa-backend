/**
 * Campaign edit policy (pure functions, no DB access).
 *
 * Business rule:
 *  - Payment happens ONCE, while the campaign is created/published.
 *  - After the campaign is published (paid), the brand can keep editing it
 *    normally. No second payment is ever requested.
 *  - Fields that decide the price (creator count, video length, add-ons,
 *    compensation type) are frozen after payment, because the paid invoice
 *    and the escrowed budget were computed from them.
 */

/** Only these keys can be written from a request body. Everything else
 *  (status, fundingStatus, budget cents, brandId, isDeleted, ...) is ignored. */
const EDITABLE_CAMPAIGN_FIELDS = [
  "campaignTitle",
  "deliverables",
  "platform",
  "location",
  "numberOfCreators",
  "productServiceUrl",
  "addOns",
  "videoLength",
  "ageRange",
  "gender",
  "productStatus",
  "compensationType",
  "giftNameDescription",
  "campaignGoal",
  "followerCount",
  "engagementRate",
  "keyMessage",
  "campaignBrief",
  "creativeDirection",
  "applicationDeadline",
  "campaignStarts",
  "petsRequired",
  "typeOfPet",
  "moodboardsInspiration",
  "moodboardInspirationUrl",
];

/** Fields that feed calculateInvoice() / the escrow budget. */
const PRICING_FIELDS = [
  "compensationType",
  "videoLength",
  "numberOfCreators",
  "addOns",
];

const PRICING_FIELD_LABELS = {
  compensationType: "Compensation type",
  videoLength: "Video length",
  numberOfCreators: "Number of creators",
  addOns: "Add-ons",
};

const FUNDED_STATUSES = ["FUNDS_RECEIVED", "FUNDED"];

const pickEditableFields = (data) => {
  const out = {};
  if (!data || typeof data !== "object") return out;
  for (const key of EDITABLE_CAMPAIGN_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(data, key) && data[key] !== undefined) {
      out[key] = data[key];
    }
  }
  return out;
};

/** True once the brand has paid (campaign live, funded, or invoice paid). */
const isPaidCampaign = (campaign, invoice) => {
  if (!campaign) return false;
  if (campaign.status === "active") return true;
  if (FUNDED_STATUSES.includes(campaign.fundingStatus)) return true;
  const inv = invoice || campaign.invoice;
  return inv?.paymentStatus === "paid";
};

const normaliseAddOns = (value) => {
  let arr = value;
  if (typeof arr === "string") {
    try {
      arr = JSON.parse(arr);
    } catch (_) {
      arr = [];
    }
  }
  if (!Array.isArray(arr)) return "[]";
  return JSON.stringify([...arr].map(String).sort());
};

const normaliseScalar = (value) =>
  value === null || value === undefined ? "" : String(value).trim().toLowerCase();

const pricingValueChanged = (field, current, next) => {
  switch (field) {
    case "addOns":
      return normaliseAddOns(current) !== normaliseAddOns(next);
    case "numberOfCreators":
      return Number(current) !== Number(next);
    default:
      return normaliseScalar(current) !== normaliseScalar(next);
  }
};

/** Pricing fields present in `updates` whose value differs from `campaign`. */
const findChangedPricingFields = (campaign, updates) => {
  if (!campaign || !updates) return [];
  return PRICING_FIELDS.filter(
    (field) =>
      Object.prototype.hasOwnProperty.call(updates, field) &&
      pricingValueChanged(field, campaign[field], updates[field]),
  );
};

const describePricingFields = (fields) =>
  fields.map((f) => PRICING_FIELD_LABELS[f] || f).join(", ");

module.exports = {
  EDITABLE_CAMPAIGN_FIELDS,
  PRICING_FIELDS,
  PRICING_FIELD_LABELS,
  FUNDED_STATUSES,
  pickEditableFields,
  isPaidCampaign,
  findChangedPricingFields,
  describePricingFields,
};
