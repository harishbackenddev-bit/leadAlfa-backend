const {
  EDITABLE_CAMPAIGN_FIELDS,
  pickEditableFields,
  isPaidCampaign,
  findChangedPricingFields,
  describePricingFields,
} = require("../services/campaignEditPolicy");

describe("campaignEditPolicy", () => {
  describe("pickEditableFields", () => {
    it("keeps whitelisted fields and drops payment / status columns", () => {
      const result = pickEditableFields({
        campaignTitle: "New title",
        status: "active",
        fundingStatus: "FUNDED",
        campaignBudgetCents: 999999,
        availableBudgetCents: 999999,
        brandId: 77,
        isDeleted: true,
        publicId: "CMP-HACK",
      });
      expect(result).toEqual({ campaignTitle: "New title" });
    });

    it("never exposes a payment-related column as editable", () => {
      ["status", "fundingStatus", "campaignBudgetCents", "availableBudgetCents",
       "reservedBudgetCents", "committedBudgetCents", "brandId", "isDeleted", "fundedAt"]
        .forEach((f) => expect(EDITABLE_CAMPAIGN_FIELDS).not.toContain(f));
    });

    it("handles null / non-object input", () => {
      expect(pickEditableFields(null)).toEqual({});
      expect(pickEditableFields(undefined)).toEqual({});
    });
  });

  describe("isPaidCampaign", () => {
    it("is true for active campaigns", () => {
      expect(isPaidCampaign({ status: "active", fundingStatus: "UNFUNDED" })).toBe(true);
    });
    it("is true when funds were received", () => {
      expect(isPaidCampaign({ status: "inactive", fundingStatus: "FUNDS_RECEIVED" })).toBe(true);
      expect(isPaidCampaign({ status: "inactive", fundingStatus: "FUNDED" })).toBe(true);
    });
    it("is true when the invoice is paid", () => {
      expect(isPaidCampaign({ status: "inactive", fundingStatus: "UNFUNDED" }, { paymentStatus: "paid" })).toBe(true);
    });
    it("is false for an unpaid draft, even with an open payment link", () => {
      expect(isPaidCampaign({ status: "inactive", fundingStatus: "AWAITING_FUNDING" }, { paymentStatus: "unpaid" })).toBe(false);
    });
  });

  describe("findChangedPricingFields", () => {
    const campaign = {
      compensationType: "Cash",
      videoLength: "30sec",
      numberOfCreators: 3,
      addOns: ["raw_footage", "extra_hooks"],
    };

    it("reports nothing when the form re-sends identical values", () => {
      expect(
        findChangedPricingFields(campaign, {
          compensationType: "cash",
          videoLength: "30sec",
          numberOfCreators: "3",
          addOns: ["extra_hooks", "raw_footage"],
        }),
      ).toEqual([]);
    });

    it("detects real pricing changes", () => {
      expect(
        findChangedPricingFields(campaign, { numberOfCreators: "5", videoLength: "60sec" }),
      ).toEqual(["videoLength", "numberOfCreators"]);
      expect(findChangedPricingFields(campaign, { addOns: [] })).toEqual(["addOns"]);
    });

    it("ignores pricing fields that are not part of the update", () => {
      expect(findChangedPricingFields(campaign, { campaignTitle: "x" })).toEqual([]);
    });

    it("treats missing add-ons as an empty list", () => {
      expect(findChangedPricingFields({ ...campaign, addOns: null }, { addOns: [] })).toEqual([]);
    });
  });

  it("describePricingFields returns readable labels", () => {
    expect(describePricingFields(["videoLength", "numberOfCreators"])).toBe(
      "Video length, Number of creators",
    );
  });
});
