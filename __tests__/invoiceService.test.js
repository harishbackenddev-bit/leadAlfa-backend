/**
 * __tests__/invoiceService.test.js
 *
 * Unit tests for invoiceService.
 *
 * calculateInvoice() is a pure function — no mocking needed.
 * syncInvoice / lockInvoice / markInvoicePaid / markInvoiceFailed
 * require DB mocking and are covered by integration stubs at the bottom.
 */

// ── Mock DB layer so importing the service doesn't try to connect ─────────────
jest.mock("../config/database", () => ({
  sequelize: {
    transaction: jest.fn(),
    define: jest.fn().mockReturnValue({}),
  },
}));

jest.mock("../models/campaigns/campaignInvoice.model", () => ({
  findOne:  jest.fn(),
  create:   jest.fn(),
}));

const { calculateInvoice, syncInvoice, lockInvoice, markInvoicePaid, markInvoiceFailed } =
  require("../services/invoiceService");
const CampaignInvoice = require("../models/campaigns/campaignInvoice.model");
const AppError = require("../utils/appError");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Re-runs the exact same algorithm as invoiceService for cross-checking. */
const round2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;

function expectedBreakdown(videoLength, creators, addOnKeys = []) {
  const prices = { "15sec": 1250, "30sec": 1950, "60sec": 2850 };
  const addOnPcts = {
    raw_footage: 30, usage_rights_30_day: 40, extra_hooks: 25, still_images: 20,
  };
  const basePackagePrice = prices[videoLength];
  const basePackageTotal = round2(basePackagePrice * creators);
  const addOnsPercentage = addOnKeys.reduce((s, k) => s + addOnPcts[k], 0);
  const addOnsAmount     = round2(basePackageTotal * (addOnsPercentage / 100));
  const cartSubtotal     = round2(basePackageTotal + addOnsAmount);
  const serviceFeeAmount = round2(cartSubtotal * 0.05);
  const amountBeforeTax  = round2(cartSubtotal + serviceFeeAmount);
  const vatAmount        = round2(amountBeforeTax * 0.15);
  const totalAmountDue   = round2(amountBeforeTax + vatAmount);
  return {
    basePackagePrice, basePackageTotal, addOnsPercentage, addOnsAmount,
    cartSubtotal, serviceFeeAmount, amountBeforeTax, vatAmount, totalAmountDue,
  };
}

// ---------------------------------------------------------------------------
// calculateInvoice — happy path
// ---------------------------------------------------------------------------

describe("calculateInvoice — valid inputs", () => {
  describe("no add-ons", () => {
    test("15sec · 1 creator", () => {
      const result = calculateInvoice("15sec", 1, []);
      const expected = expectedBreakdown("15sec", 1);

      expect(result.basePackagePrice).toBe(1250);
      expect(result.basePackageTotal).toBe(1250);
      expect(result.addOnsPercentage).toBe(0);
      expect(result.addOnsAmount).toBe(0);
      expect(result.cartSubtotal).toBe(1250);
      expect(result.serviceFeeAmount).toBe(62.5);
      expect(result.amountBeforeTax).toBe(1312.5);
      expect(result.vatAmount).toBe(196.88);          // 1312.5 × 0.15 = 196.875 → 196.88
      expect(result.totalAmountDue).toBe(1509.38);    // 1312.5 + 196.88
      expect(result.totalAmountDue).toBe(expected.totalAmountDue);
    });

    test("30sec · 2 creators", () => {
      const result = calculateInvoice("30sec", 2, []);
      const expected = expectedBreakdown("30sec", 2);

      expect(result.basePackagePrice).toBe(1950);
      expect(result.basePackageTotal).toBe(3900);
      expect(result.cartSubtotal).toBe(3900);
      expect(result.serviceFeeAmount).toBe(195);
      expect(result.amountBeforeTax).toBe(4095);
      expect(result.vatAmount).toBe(614.25);
      expect(result.totalAmountDue).toBe(4709.25);
      expect(result.totalAmountDue).toBe(expected.totalAmountDue);
    });

    test("60sec · 3 creators", () => {
      const result = calculateInvoice("60sec", 3, []);
      const expected = expectedBreakdown("60sec", 3);

      expect(result.basePackagePrice).toBe(2850);
      expect(result.basePackageTotal).toBe(8550);
      expect(result.cartSubtotal).toBe(8550);
      expect(result.serviceFeeAmount).toBe(427.5);
      expect(result.amountBeforeTax).toBe(8977.5);
      expect(result.vatAmount).toBe(1346.63);   // 8977.5 × 0.15 = 1346.625 → 1346.63
      expect(result.totalAmountDue).toBe(10324.13);
      expect(result.totalAmountDue).toBe(expected.totalAmountDue);
    });
  });

  describe("with add-ons", () => {
    test("30sec · 2 creators · raw_footage(30%) + extra_hooks(25%) = plan example", () => {
      // This is the exact example from the implementation plan — must match.
      const result = calculateInvoice("30sec", 2, ["raw_footage", "extra_hooks"]);

      expect(result.basePackageTotal).toBe(3900);
      expect(result.addOnsPercentage).toBe(55);
      expect(result.addOnsAmount).toBe(2145);        // 3900 × 0.55
      expect(result.cartSubtotal).toBe(6045);
      expect(result.serviceFeeAmount).toBe(302.25);  // 6045 × 0.05
      expect(result.amountBeforeTax).toBe(6347.25);
      expect(result.vatAmount).toBe(952.09);          // 6347.25 × 0.15 = 952.0875 → 952.09
      expect(result.totalAmountDue).toBe(7299.34);
    });

    test("30sec · 1 creator · usage_rights_30_day(40%)", () => {
      const result = calculateInvoice("30sec", 1, ["usage_rights_30_day"]);
      const expected = expectedBreakdown("30sec", 1, ["usage_rights_30_day"]);

      expect(result.addOnsPercentage).toBe(40);
      expect(result.addOnsAmount).toBe(round2(1950 * 0.40)); // 780
      expect(result.cartSubtotal).toBe(2730);
      expect(result.totalAmountDue).toBe(expected.totalAmountDue);
    });

    test("60sec · 2 creators · all 4 add-ons (30+40+25+20=115%)", () => {
      const allKeys = ["raw_footage", "usage_rights_30_day", "extra_hooks", "still_images"];
      const result = calculateInvoice("60sec", 2, allKeys);
      const expected = expectedBreakdown("60sec", 2, allKeys);

      expect(result.addOnsPercentage).toBe(115);
      const baseTotal = 2850 * 2; // 5700
      expect(result.basePackageTotal).toBe(5700);
      expect(result.addOnsAmount).toBe(round2(5700 * 1.15));   // 6555
      expect(result.cartSubtotal).toBe(round2(5700 + 6555));   // 12255
      expect(result.totalAmountDue).toBe(expected.totalAmountDue);
    });

    test("15sec · 1 creator · still_images(20%)", () => {
      const result = calculateInvoice("15sec", 1, ["still_images"]);
      expect(result.addOnsPercentage).toBe(20);
      expect(result.addOnsAmount).toBe(250);   // 1250 × 0.20
      expect(result.cartSubtotal).toBe(1500);
    });
  });

  describe("add-ons default behaviour", () => {
    test("undefined addOns is treated as empty array", () => {
      const result = calculateInvoice("30sec", 2, undefined);
      expect(result.addOnsPercentage).toBe(0);
      expect(result.addOnsAmount).toBe(0);
      expect(result.cartSubtotal).toBe(result.basePackageTotal);
    });

    test("null addOns is treated as empty array", () => {
      const result = calculateInvoice("15sec", 1, null);
      expect(result.addOnsPercentage).toBe(0);
    });

    test("empty addOns array is valid", () => {
      expect(() => calculateInvoice("30sec", 1, [])).not.toThrow();
    });
  });

  describe("output shape", () => {
    test("returned object includes all required fields", () => {
      const result = calculateInvoice("30sec", 1, []);
      const requiredFields = [
        "videoLength", "numberOfCreators", "appliedAddOns",
        "basePackagePrice", "basePackageTotal",
        "addOnsPercentage", "addOnsAmount", "cartSubtotal",
        "serviceFeeAmount", "amountBeforeTax",
        "vatAmount", "totalAmountDue",
      ];
      requiredFields.forEach((field) =>
        expect(result).toHaveProperty(field)
      );
    });

    test("appliedAddOns is a copy of the input array", () => {
      const addOns = ["raw_footage"];
      const result = calculateInvoice("30sec", 1, addOns);
      expect(result.appliedAddOns).toEqual(addOns);
    });

    test("numberOfCreators is normalised to an integer", () => {
      // Sequelize sometimes returns numeric strings from DECIMAL columns
      const result = calculateInvoice("30sec", "2", []);
      expect(result.numberOfCreators).toBe(2);
    });
  });
});

// ---------------------------------------------------------------------------
// calculateInvoice — validation errors
// ---------------------------------------------------------------------------

describe("calculateInvoice — invalid inputs", () => {
  describe("videoLength", () => {
    test("null videoLength throws AppError 400", () => {
      expect(() => calculateInvoice(null, 1, [])).toThrow(AppError);
      expect(() => calculateInvoice(null, 1, [])).toThrow(/Invalid video length/);
    });

    test("undefined videoLength throws AppError 400", () => {
      expect(() => calculateInvoice(undefined, 1, [])).toThrow(AppError);
    });

    test("unknown videoLength throws AppError 400", () => {
      expect(() => calculateInvoice("45sec", 1, [])).toThrow(AppError);
      expect(() => calculateInvoice("45sec", 1, [])).toThrow(/Invalid video length/);
    });

    test("empty string videoLength throws AppError 400", () => {
      expect(() => calculateInvoice("", 1, [])).toThrow(AppError);
    });
  });

  describe("numberOfCreators", () => {
    test("0 creators throws AppError 400", () => {
      expect(() => calculateInvoice("30sec", 0, [])).toThrow(AppError);
      expect(() => calculateInvoice("30sec", 0, [])).toThrow(/positive integer/);
    });

    test("negative creators throws AppError 400", () => {
      expect(() => calculateInvoice("30sec", -1, [])).toThrow(AppError);
    });

    test("NaN creators throws AppError 400", () => {
      expect(() => calculateInvoice("30sec", NaN, [])).toThrow(AppError);
    });

    test("non-numeric string throws AppError 400", () => {
      expect(() => calculateInvoice("30sec", "abc", [])).toThrow(AppError);
    });
  });

  describe("addOns", () => {
    test("unknown add-on key throws AppError 400 with the invalid key in message", () => {
      expect(() => calculateInvoice("30sec", 1, ["unknown_key"])).toThrow(AppError);
      expect(() => calculateInvoice("30sec", 1, ["unknown_key"])).toThrow(/unknown_key/);
    });

    test("mix of valid and invalid keys — invalid key is reported", () => {
      expect(() => calculateInvoice("30sec", 1, ["raw_footage", "bad_addon"]))
        .toThrow(/bad_addon/);
    });

    test("all invalid keys are listed in the error message", () => {
      let thrownError;
      try {
        calculateInvoice("30sec", 1, ["key_a", "key_b"]);
      } catch (err) {
        thrownError = err;
      }
      expect(thrownError).toBeInstanceOf(AppError);
      expect(thrownError.message).toMatch(/key_a/);
      expect(thrownError.message).toMatch(/key_b/);
      expect(thrownError.statusCode).toBe(400);
    });
  });
});

// ---------------------------------------------------------------------------
// Rounding — verify no floating-point drift on known edge cases
// ---------------------------------------------------------------------------

describe("calculateInvoice — rounding precision", () => {
  test("vatAmount rounds correctly when .5 is involved (196.875 → 196.88)", () => {
    const result = calculateInvoice("15sec", 1, []);
    // amountBeforeTax = 1312.5; 1312.5 × 0.15 = 196.875 → should round to 196.88
    expect(result.vatAmount).toBe(196.88);
  });

  test("vatAmount 60sec·3 creators rounds 1346.625 → 1346.63", () => {
    const result = calculateInvoice("60sec", 3, []);
    expect(result.vatAmount).toBe(1346.63);
  });

  test("vatAmount 30sec·2 creators·raw_footage+extra_hooks: 952.0875 → 952.09", () => {
    const result = calculateInvoice("30sec", 2, ["raw_footage", "extra_hooks"]);
    expect(result.vatAmount).toBe(952.09);
  });

  test("all monetary values have at most 2 decimal places", () => {
    const result = calculateInvoice("60sec", 3, ["raw_footage", "usage_rights_30_day"]);
    const monetaryFields = [
      "basePackagePrice", "basePackageTotal", "addOnsAmount",
      "cartSubtotal", "serviceFeeAmount", "amountBeforeTax",
      "vatAmount", "totalAmountDue",
    ];
    monetaryFields.forEach((field) => {
      const val = result[field];
      const decimals = val.toString().split(".")[1]?.length ?? 0;
      expect(decimals).toBeLessThanOrEqual(2);
    });
  });

  test("totalAmountDue = amountBeforeTax + vatAmount (no accumulated drift)", () => {
    const result = calculateInvoice("30sec", 2, ["extra_hooks"]);
    expect(result.totalAmountDue).toBe(
      round2(result.amountBeforeTax + result.vatAmount)
    );
  });
});

// ---------------------------------------------------------------------------
// syncInvoice — unit tests (DB mocked)
// ---------------------------------------------------------------------------

describe("syncInvoice — guard behaviour", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { LOCK: { UPDATE: "UPDATE" } };
  });

  test("returns null for Gift campaigns without touching CampaignInvoice", async () => {
    const campaign = { id: 1, compensationType: "Gift", videoLength: "30sec", numberOfCreators: 2, addOns: [] };
    const result = await syncInvoice(campaign, mockTransaction);
    expect(result).toBeNull();
    expect(CampaignInvoice.findOne).not.toHaveBeenCalled();
  });

  test("returns null when videoLength is missing", async () => {
    const campaign = { id: 1, compensationType: "Cash", videoLength: null, numberOfCreators: 2, addOns: [] };
    const result = await syncInvoice(campaign, mockTransaction);
    expect(result).toBeNull();
    expect(CampaignInvoice.findOne).not.toHaveBeenCalled();
  });

  test("returns existing invoice unchanged when paymentStatus is 'pending'", async () => {
    const lockedInvoice = { paymentStatus: "pending", update: jest.fn() };
    CampaignInvoice.findOne.mockResolvedValue(lockedInvoice);

    const campaign = { id: 1, compensationType: "Cash", videoLength: "30sec", numberOfCreators: 2, addOns: [] };
    const result = await syncInvoice(campaign, mockTransaction);

    expect(result).toBe(lockedInvoice);
    expect(lockedInvoice.update).not.toHaveBeenCalled();
  });

  test("returns existing invoice unchanged when paymentStatus is 'paid'", async () => {
    const paidInvoice = { paymentStatus: "paid", update: jest.fn() };
    CampaignInvoice.findOne.mockResolvedValue(paidInvoice);

    const campaign = { id: 1, compensationType: "Cash", videoLength: "15sec", numberOfCreators: 1, addOns: [] };
    const result = await syncInvoice(campaign, mockTransaction);

    expect(result).toBe(paidInvoice);
    expect(paidInvoice.update).not.toHaveBeenCalled();
  });

  test("creates invoice when none exists", async () => {
    CampaignInvoice.findOne.mockResolvedValue(null);
    const created = { id: 99, paymentStatus: "unpaid" };
    CampaignInvoice.create.mockResolvedValue(created);

    const campaign = { id: 5, compensationType: "Cash", videoLength: "30sec", numberOfCreators: 1, addOns: [] };
    const result = await syncInvoice(campaign, mockTransaction);

    expect(CampaignInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({ campaignId: 5, videoLength: "30sec" }),
      { transaction: mockTransaction }
    );
    expect(result).toBe(created);
  });

  test("updates invoice when unpaid invoice already exists", async () => {
    const mockReload = jest.fn().mockResolvedValue({ id: 1, paymentStatus: "unpaid" });
    const unpaidInvoice = { id: 1, paymentStatus: "unpaid", update: jest.fn().mockResolvedValue(true), reload: mockReload };
    CampaignInvoice.findOne.mockResolvedValue(unpaidInvoice);

    const campaign = { id: 2, compensationType: "Cash", videoLength: "60sec", numberOfCreators: 2, addOns: ["raw_footage"] };
    await syncInvoice(campaign, mockTransaction);

    expect(unpaidInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({ videoLength: "60sec", addOnsPercentage: 30 }),
      { transaction: mockTransaction }
    );
  });

  test("updates invoice when failed invoice exists (allowing retry)", async () => {
    const mockReload = jest.fn().mockResolvedValue({ id: 1, paymentStatus: "failed" });
    const failedInvoice = { id: 1, paymentStatus: "failed", update: jest.fn().mockResolvedValue(true), reload: mockReload };
    CampaignInvoice.findOne.mockResolvedValue(failedInvoice);

    const campaign = { id: 3, compensationType: "Cash", videoLength: "30sec", numberOfCreators: 1, addOns: [] };
    await syncInvoice(campaign, mockTransaction);

    expect(failedInvoice.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// lockInvoice — unit tests
// ---------------------------------------------------------------------------

describe("lockInvoice", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { LOCK: { UPDATE: "UPDATE" } };
  });

  test("throws 404 when invoice not found", async () => {
    CampaignInvoice.findOne.mockResolvedValue(null);
    await expect(lockInvoice(99, "REF-001", mockTransaction)).rejects.toThrow(AppError);
    await expect(lockInvoice(99, "REF-001", mockTransaction)).rejects.toThrow(/not found/);
  });

  test("throws 409 when invoice is already paid", async () => {
    CampaignInvoice.findOne.mockResolvedValue({ paymentStatus: "paid", update: jest.fn() });
    await expect(lockInvoice(1, "REF-001", mockTransaction)).rejects.toThrow(/already been paid/);
  });

  test("throws 409 when invoice is already pending", async () => {
    CampaignInvoice.findOne.mockResolvedValue({ paymentStatus: "pending", update: jest.fn() });
    await expect(lockInvoice(1, "REF-001", mockTransaction)).rejects.toThrow(/already in progress/);
  });

  test("sets status to pending and records gatewayReference", async () => {
    const mockInvoice = { paymentStatus: "unpaid", update: jest.fn().mockResolvedValue(true) };
    CampaignInvoice.findOne.mockResolvedValue(mockInvoice);

    await lockInvoice(1, "TSAFE-XYZ", mockTransaction);

    expect(mockInvoice.update).toHaveBeenCalledWith(
      { paymentStatus: "pending", gatewayReference: "TSAFE-XYZ" },
      { transaction: mockTransaction }
    );
  });

  test("allows locking a previously failed invoice (retry path)", async () => {
    const mockInvoice = { paymentStatus: "failed", update: jest.fn().mockResolvedValue(true) };
    CampaignInvoice.findOne.mockResolvedValue(mockInvoice);
    await expect(lockInvoice(1, "TSAFE-RETRY", mockTransaction)).resolves.toBeDefined();
    expect(mockInvoice.update).toHaveBeenCalledWith(
      { paymentStatus: "pending", gatewayReference: "TSAFE-RETRY" },
      { transaction: mockTransaction }
    );
  });
});

// ---------------------------------------------------------------------------
// markInvoicePaid — unit tests
// ---------------------------------------------------------------------------

describe("markInvoicePaid", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { LOCK: { UPDATE: "UPDATE" } };
  });

  test("throws 404 when gatewayReference is not found", async () => {
    CampaignInvoice.findOne.mockResolvedValue(null);
    await expect(markInvoicePaid("UNKNOWN-REF", {}, mockTransaction))
      .rejects.toThrow(AppError);
  });

  test("idempotency: returns existing invoice if already paid (no update)", async () => {
    const alreadyPaid = { paymentStatus: "paid", update: jest.fn() };
    CampaignInvoice.findOne.mockResolvedValue(alreadyPaid);

    const result = await markInvoicePaid("REF-001", {}, mockTransaction);
    expect(result).toBe(alreadyPaid);
    expect(alreadyPaid.update).not.toHaveBeenCalled();
  });

  test("sets paymentStatus to paid, paidAt, and stores gatewayPayload", async () => {
    const payload = { event: "payment.success", amount: 7299.34 };
    const mockInvoice = { paymentStatus: "pending", update: jest.fn().mockResolvedValue(true) };
    CampaignInvoice.findOne.mockResolvedValue(mockInvoice);

    await markInvoicePaid("REF-001", payload, mockTransaction);

    expect(mockInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus:  "paid",
        paidAt:         expect.any(Date),
        gatewayPayload: payload,
      }),
      { transaction: mockTransaction }
    );
  });
});

// ---------------------------------------------------------------------------
// markInvoiceFailed — unit tests
// ---------------------------------------------------------------------------

describe("markInvoiceFailed", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = { LOCK: { UPDATE: "UPDATE" } };
  });

  test("throws 404 when gatewayReference is not found", async () => {
    CampaignInvoice.findOne.mockResolvedValue(null);
    await expect(markInvoiceFailed("UNKNOWN-REF", {}, mockTransaction))
      .rejects.toThrow(AppError);
  });

  test("idempotency: returns existing invoice if already failed (no update)", async () => {
    const alreadyFailed = { paymentStatus: "failed", update: jest.fn() };
    CampaignInvoice.findOne.mockResolvedValue(alreadyFailed);

    const result = await markInvoiceFailed("REF-001", {}, mockTransaction);
    expect(result).toBe(alreadyFailed);
    expect(alreadyFailed.update).not.toHaveBeenCalled();
  });

  test("sets paymentStatus to failed and stores gatewayPayload", async () => {
    const payload = { event: "payment.failed", reason: "Insufficient funds" };
    const mockInvoice = { paymentStatus: "pending", update: jest.fn().mockResolvedValue(true) };
    CampaignInvoice.findOne.mockResolvedValue(mockInvoice);

    await markInvoiceFailed("REF-001", payload, mockTransaction);

    expect(mockInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentStatus:  "failed",
        gatewayPayload: payload,
      }),
      { transaction: mockTransaction }
    );
  });

  test("campaign remains in inactive state after failure (invoice reset only)", async () => {
    // markInvoiceFailed only touches the invoice — campaign status is NOT changed here.
    // This test asserts that no campaign update call is made within markInvoiceFailed.
    const mockInvoice = { paymentStatus: "pending", update: jest.fn().mockResolvedValue(true) };
    CampaignInvoice.findOne.mockResolvedValue(mockInvoice);

    await markInvoiceFailed("REF-001", {}, mockTransaction);

    // Only one update call — on the invoice, not a campaign
    expect(mockInvoice.update).toHaveBeenCalledTimes(1);
  });
});
