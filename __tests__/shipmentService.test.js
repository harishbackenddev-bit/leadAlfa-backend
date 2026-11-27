jest.mock("../models", () => ({
  Shipment: {},
  ShippingAddress: { findOne: jest.fn() },
  Campaign: { findOne: jest.fn() },
  BrandProfile: {},
  CreatorProfile: {},
  CampaignApplication: { findOne: jest.fn() },
}));

const { Campaign, CampaignApplication, ShippingAddress } = require("../models");
const {
  quoteRates,
  chargeableWeight,
  getCreatorAddressForBrand,
  mergeDeliveryOverride,
  toBrandView,
  toCreatorView,
} = require("../services/shipmentService");

describe("chargeableWeight", () => {
  it("uses the actual weight when the parcel is dense", () => {
    expect(chargeableWeight({ weightKg: 5, lengthCm: 20, widthCm: 20, heightCm: 20 })).toBe(5);
  });

  it("uses volumetric weight when the parcel is large but light", () => {
    // Bob Go bills on / 4000: 60 * 50 * 40 / 4000 = 30
    expect(chargeableWeight({ weightKg: 1, lengthCm: 60, widthCm: 50, heightCm: 40 })).toBe(30);
  });

  it("matches Bob Go on a 50cm cube", () => {
    // 50 * 50 * 50 / 4000 = 31.25, which Bob Go charges as 32
    expect(chargeableWeight({ weightKg: 5, lengthCm: 50, widthCm: 50, heightCm: 50 })).toBe(31.25);
  });

  it("falls back to weight when dimensions are missing", () => {
    expect(chargeableWeight({ weightKg: 3 })).toBe(3);
  });

  it("returns zero when nothing usable is given", () => {
    expect(chargeableWeight({})).toBe(0);
  });
});

describe("quoteRates", () => {
  const parcel = { weightKg: 2, lengthCm: 40, widthCm: 32, heightCm: 6 };

  it("returns nothing without a usable weight", () => {
    expect(quoteRates({ weightKg: 0 })).toEqual([]);
  });

  it("returns every service level, cheapest first", () => {
    const rates = quoteRates(parcel);
    const amounts = rates.map((rate) => rate.amount);

    expect(rates).toHaveLength(4);
    expect([...amounts].sort((a, b) => a - b)).toEqual(amounts);
  });

  it("only offers Bob Go", () => {
    expect(quoteRates(parcel).every((rate) => rate.courierName === "Bob Go")).toBe(true);
  });

  it("prices on chargeable weight, not declared weight", () => {
    const light = quoteRates({ weightKg: 1, lengthCm: 60, widthCm: 50, heightCm: 40 })[0];

    expect(light.chargeableKg).toBe(30);
    expect(light.amount).toBeGreaterThan(quoteRates(parcel)[0].amount);
  });

  it("rounds amounts to two decimals", () => {
    quoteRates({ weightKg: 1.337, lengthCm: 10, widthCm: 10, heightCm: 10 }).forEach((rate) => {
      expect(rate.amount).toBe(Math.round(rate.amount * 100) / 100);
    });
  });
});

describe("getCreatorAddressForBrand", () => {
  const saved = {
    streetAddress: "78 Florida Road",
    localArea: "Morningside",
    city: "Durban",
    zone: "KwaZulu-Natal",
    postalCode: "4001",
    country: "South Africa",
    company: null,
    contactName: "Priya Naidoo",
    contactEmail: null,
    contactMobile: "0821234567",
  };

  beforeEach(() => {
    Campaign.findOne.mockReset();
    CampaignApplication.findOne.mockReset();
    ShippingAddress.findOne.mockReset();
  });

  it("returns the address the creator saved themselves", async () => {
    Campaign.findOne.mockResolvedValue({ id: 1 });
    CampaignApplication.findOne.mockResolvedValue({ id: 9 });
    ShippingAddress.findOne.mockResolvedValue({ get: () => saved });

    await expect(getCreatorAddressForBrand(5, 1, 7)).resolves.toEqual(saved);
    expect(ShippingAddress.findOne).toHaveBeenCalledWith({
      where: { ownerType: "creator", ownerId: 7 },
    });
  });

  it("returns null when the creator has not saved one yet", async () => {
    Campaign.findOne.mockResolvedValue({ id: 1 });
    CampaignApplication.findOne.mockResolvedValue({ id: 9 });
    ShippingAddress.findOne.mockResolvedValue(null);

    await expect(getCreatorAddressForBrand(5, 1, 7)).resolves.toBeNull();
  });

  it("refuses a creator who is not accepted on the campaign", async () => {
    Campaign.findOne.mockResolvedValue({ id: 1 });
    CampaignApplication.findOne.mockResolvedValue(null);

    await expect(getCreatorAddressForBrand(5, 1, 7)).rejects.toThrow(
      "That creator is not accepted on this campaign"
    );
    expect(ShippingAddress.findOne).not.toHaveBeenCalled();
  });

  it("refuses a campaign that belongs to another brand", async () => {
    Campaign.findOne.mockResolvedValue(null);

    await expect(getCreatorAddressForBrand(5, 1, 7)).rejects.toThrow("Campaign not found");
    expect(ShippingAddress.findOne).not.toHaveBeenCalled();
  });
});

describe("mergeDeliveryOverride", () => {
  const saved = {
    streetAddress: "22 Ealing Cres",
    localArea: "Bryanston",
    city: "Johannesburg",
    zone: "Gauteng",
    postalCode: "2191",
    country: "South Africa",
    contactName: "Demo Creator",
    contactMobile: "0821234567",
  };

  it("keeps the saved address when there is no override", () => {
    expect(mergeDeliveryOverride(saved, undefined)).toEqual(saved);
    expect(mergeDeliveryOverride(saved, null)).toEqual(saved);
  });

  it("ships to the brand's chosen location instead", () => {
    const merged = mergeDeliveryOverride(saved, {
      streetAddress: "78 Florida Road",
      localArea: "Morningside",
      city: "Durban",
      zone: "KwaZulu-Natal",
      postalCode: "4001",
    });

    expect(merged.streetAddress).toBe("78 Florida Road");
    expect(merged.city).toBe("Durban");
    expect(merged.postalCode).toBe("4001");
  });

  it("keeps contact details the brand did not touch", () => {
    const merged = mergeDeliveryOverride(saved, { city: "Cape Town" });

    expect(merged.city).toBe("Cape Town");
    expect(merged.contactName).toBe("Demo Creator");
    expect(merged.contactMobile).toBe("0821234567");
  });

  it("ignores blank fields instead of wiping the saved value", () => {
    expect(mergeDeliveryOverride(saved, { city: "   ", postalCode: "" })).toEqual(saved);
  });

  it("drops unknown fields the client sends", () => {
    const merged = mergeDeliveryOverride(saved, { city: "Durban", isAdmin: true });

    expect(merged.isAdmin).toBeUndefined();
  });

  it("works when the creator has saved nothing at all", () => {
    expect(mergeDeliveryOverride(null, { city: "Durban" })).toEqual({ city: "Durban" });
    expect(mergeDeliveryOverride(null, null)).toBeNull();
  });
});

describe("shipment views always carry brand and creator", () => {
  // the UI reads shipment.creator.initials, so a view missing them crashes the page
  const rowWithoutRelations = {
    get: () => ({ id: 1, productName: "test", status: "delivered", events: [] }),
  };

  it("brand view still has brand and creator objects", () => {
    const view = toBrandView(rowWithoutRelations);

    expect(view.brand).toBeDefined();
    expect(view.brand.initials).toBe("");
    expect(view.creator).toBeDefined();
    expect(view.creator.initials).toBe("");
  });

  it("creator view still has a brand object", () => {
    const view = toCreatorView(rowWithoutRelations);

    expect(view.brand).toBeDefined();
    expect(view.brand.initials).toBe("");
  });

  it("brand view builds initials from the company name", () => {
    const row = { get: () => ({ id: 1, brand: { companyName: "New Brand Company" }, events: [] }) };

    expect(toBrandView(row).brand.initials).toBe("NB");
  });
});
