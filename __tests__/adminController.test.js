const adminController = require("../controllers/adminController");
const adminService = require("../services/adminService");
const AppError = require("../utils/appError");

jest.mock("../services/adminService");

describe("Admin Controller", () => {
  let req, res;

  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { id: 999 },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe("approveProfile", () => {
    it("should approve profile and return 200", async () => {
      req.params.id = 1;
      const mockProfile = { id: 1, status: "approved" };
      adminService.approveProfile.mockResolvedValue(mockProfile);

      await adminController.approveProfile(req, res);

      expect(adminService.approveProfile).toHaveBeenCalledWith(1, 999);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Profile approved successfully",
        profile: mockProfile,
      });
    });

    it("should handle custom AppError", async () => {
      req.params.id = 1;
      adminService.approveProfile.mockRejectedValue(
        new AppError("Already approved", 400)
      );

      await adminController.approveProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Already approved" });
    });
  });

  describe("rejectProfile", () => {
    it("should reject profile and return 200", async () => {
      req.params.id = 1;
      req.body.reason = "Duplicate content";
      const mockProfile = { id: 1, status: "rejected" };
      adminService.rejectProfile.mockResolvedValue(mockProfile);

      await adminController.rejectProfile(req, res);

      expect(adminService.rejectProfile).toHaveBeenCalledWith(
        1,
        "Duplicate content",
        999
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Profile rejected successfully",
        profile: mockProfile,
      });
    });
  });

  describe("askClarification", () => {
    it("should ask clarification and return 200", async () => {
      req.params.id = 1;
      req.body.message = "Need more portfolio links";
      const mockProfile = { id: 1, status: "clarification_requested" };
      adminService.askClarification.mockResolvedValue(mockProfile);

      await adminController.askClarification(req, res);

      expect(adminService.askClarification).toHaveBeenCalledWith(
        1,
        "Need more portfolio links",
        999
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Clarification requested successfully",
        profile: mockProfile,
      });
    });
  });

  describe("getCreatorProfileRequests", () => {
    it("should return paginated profile requests", async () => {
      req.query = { status: "pending", page: 1, limit: 10 };
      const mockResult = {
        count: 5,
        rows: [],
        page: 1,
        limit: 10,
      };
      adminService.getCreatorProfileRequests.mockResolvedValue(mockResult);

      await adminController.getCreatorProfileRequests(req, res);

      expect(adminService.getCreatorProfileRequests).toHaveBeenCalledWith(
        "pending",
        1,
        10
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalItems: 5,
        totalPages: 1,
        currentPage: 1,
        data: [],
      });
    });
  });

  describe("getCreatorProfileById", () => {
    it("should fetch a profile by id", async () => {
      req.params.id = 1;
      const mockProfile = { id: 1, name: "Test" };
      adminService.getCreatorProfileById.mockResolvedValue(mockProfile);

      await adminController.getCreatorProfileById(req, res);

      expect(adminService.getCreatorProfileById).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ profile: mockProfile });
    });
  });

  describe("deleteProfileRequest", () => {
    it("should delete profile request and return 200", async () => {
      req.params.id = 1;
      adminService.deleteProfileRequest.mockResolvedValue(true);

      await adminController.deleteProfileRequest(req, res);

      expect(adminService.deleteProfileRequest).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Profile request deleted successfully",
      });
    });
  });

  // --- Brand Profile Admin Controller Unit Tests ---

  describe("approveBrandProfile", () => {
    it("should approve brand profile and return 200", async () => {
      req.params.id = 1;
      const mockProfile = { id: 1, status: "approved" };
      adminService.approveBrandProfile.mockResolvedValue(mockProfile);

      await adminController.approveBrandProfile(req, res);

      expect(adminService.approveBrandProfile).toHaveBeenCalledWith(1, 999);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Brand profile approved successfully",
        profile: mockProfile,
      });
    });

    it("should handle custom AppError", async () => {
      req.params.id = 1;
      adminService.approveBrandProfile.mockRejectedValue(
        new AppError("Already approved", 400)
      );

      await adminController.approveBrandProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Already approved" });
    });
  });

  describe("rejectBrandProfile", () => {
    it("should reject brand profile and return 200", async () => {
      req.params.id = 1;
      req.body.reason = "Incomplete details";
      const mockProfile = { id: 1, status: "rejected" };
      adminService.rejectBrandProfile.mockResolvedValue(mockProfile);

      await adminController.rejectBrandProfile(req, res);

      expect(adminService.rejectBrandProfile).toHaveBeenCalledWith(
        1,
        "Incomplete details",
        999
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Brand profile rejected successfully",
        profile: mockProfile,
      });
    });
  });

  describe("askBrandClarification", () => {
    it("should ask clarification for brand profile and return 200", async () => {
      req.params.id = 1;
      req.body.message = "Upload tax ID";
      const mockProfile = { id: 1, status: "clarification_requested" };
      adminService.askBrandClarification.mockResolvedValue(mockProfile);

      await adminController.askBrandClarification(req, res);

      expect(adminService.askBrandClarification).toHaveBeenCalledWith(
        1,
        "Upload tax ID",
        999
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Clarification requested successfully",
        profile: mockProfile,
      });
    });
  });

  describe("getBrandProfileRequests", () => {
    it("should return paginated brand profile requests", async () => {
      req.query = { status: "pending", page: 1, limit: 10 };
      const mockResult = {
        count: 3,
        rows: [],
        page: 1,
        limit: 10,
      };
      adminService.getBrandProfileRequests.mockResolvedValue(mockResult);

      await adminController.getBrandProfileRequests(req, res);

      expect(adminService.getBrandProfileRequests).toHaveBeenCalledWith(
        "pending",
        1,
        10
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        totalItems: 3,
        totalPages: 1,
        currentPage: 1,
        data: [],
      });
    });
  });

  describe("getBrandProfileById", () => {
    it("should fetch brand profile by id", async () => {
      req.params.id = 1;
      const mockProfile = { id: 1, companyName: "Acme" };
      adminService.getBrandProfileById.mockResolvedValue(mockProfile);

      await adminController.getBrandProfileById(req, res);

      expect(adminService.getBrandProfileById).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ profile: mockProfile });
    });
  });

  describe("deleteBrandProfileRequest", () => {
    it("should delete brand profile request and return 200", async () => {
      req.params.id = 1;
      adminService.deleteBrandProfileRequest.mockResolvedValue(true);

      await adminController.deleteBrandProfileRequest(req, res);

      expect(adminService.deleteBrandProfileRequest).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        message: "Brand profile request deleted successfully",
      });
    });
  });
});
