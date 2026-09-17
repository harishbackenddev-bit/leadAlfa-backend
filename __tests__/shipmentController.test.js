jest.mock("../services/shipmentService", () => ({
  createShipments: jest.fn(),
  startCheckout: jest.fn().mockResolvedValue({ url: "https://pay" }),
  toBrandView: (row) => row,
  isProduction: () => false,
}));
jest.mock("../services/payfastService", () => ({ isConfigured: () => true }));

const shipmentService = require("../services/shipmentService");
const { createShipmentsController } = require("../controllers/shipmentController");

// the image and the address override were both dropped here once, so nothing
// reached the creator and every parcel went to the saved address
describe("createShipmentsController", () => {
  it("passes the product image and the address overrides through to the service", async () => {
    shipmentService.createShipments.mockResolvedValue({ shipments: [], paymentReference: "CT-1" });

    const req = {
      brandId: 7,
      body: {
        campaignId: 1,
        creatorIds: [2],
        productName: "Serum",
        productImage: "data:image/jpeg;base64,AAA",
        deliveryAddresses: { 2: { streetAddress: "9 Loop St" } },
        weightKg: 1,
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
        rateId: "r1",
      },
    };
    const res = { status: () => res, json: jest.fn() };

    await createShipmentsController(req, res);

    expect(shipmentService.createShipments).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        productImage: "data:image/jpeg;base64,AAA",
        deliveryAddresses: { 2: { streetAddress: "9 Loop St" } },
      })
    );
  });
});
