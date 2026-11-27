const creatorProfileService = require("../services/creatorProfileService");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const Media = require("../models/media/media.model");
const Category = require("../models/creatorProfile/category.model");
const Skill = require("../models/creatorProfile/skill.model");
const AppError = require("../utils/appError");
const { sequelize } = require("../config/database");
const mediaService = require("../services/mediaService");

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../models/creatorProfile/creatorProfile.model");
jest.mock("../models/creatorProfile/creatorMedia.model");
jest.mock("../models/media/media.model");
jest.mock("../models/creatorProfile/category.model");
jest.mock("../models/creatorProfile/skill.model");
jest.mock("../services/mediaService", () => ({
  uploadCreatorMedia: jest.fn(),
  deleteMediaData: jest.fn(),
  uploadMediaToCloudinary: jest.fn(),
}));
jest.mock("../utils/storage/StorageProvider", () => ({ deleteMedia: jest.fn() }));
jest.mock("../utils/storage/providers/s3Provider", () => ({ remove: jest.fn() }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal valid creation payload with a complete shipping address and publicName. */
const validCreationPayload = (overrides = {}) => ({
  publicName: "TestCreator",
  firstName: "Test",
  lastName: "Creator",
  email: "creator@example.com",
  addressLine1: "24 Main Road",
  suburb: "Sea Point",
  city: "Cape Town",
  province: "Western Cape",
  postalCode: "8005",
  ...overrides,
});

/** Factory for a mock Sequelize transaction. */
const buildMockTransaction = () => ({
  commit: jest.fn().mockResolvedValue(true),
  rollback: jest.fn().mockResolvedValue(true),
});

describe("creatorProfileService", () => {
  let mockTransaction;

  beforeEach(() => {
    jest.clearAllMocks();
    mockTransaction = buildMockTransaction();
    jest.spyOn(sequelize, "transaction").mockResolvedValue(mockTransaction);

    // Default: no profile exists yet (creation scenario)
    CreatorProfile.findOne.mockResolvedValue(null);

    // Default: successful creation
    CreatorProfile.create.mockImplementation((data) =>
      Promise.resolve({
        id: 1,
        ...data,
        toJSON: () => ({ id: 1, ...data }),
        setCategories: jest.fn().mockResolvedValue(true),
        setSkills: jest.fn().mockResolvedValue(true),
      })
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // createOrUpdateCreatorProfile — creation validation
  // -------------------------------------------------------------------------

  describe("createOrUpdateCreatorProfile — required address fields on creation", () => {
    it("should create a profile when all required address fields are present", async () => {
      const result = await creatorProfileService.createOrUpdateCreatorProfile(
        42,
        validCreationPayload(),
        {},
        [],
        []
      );
      expect(CreatorProfile.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("profile");
    });

    it("should also succeed when optional addressLine2 is absent", async () => {
      const payload = validCreationPayload();
      delete payload.addressLine2;
      const result = await creatorProfileService.createOrUpdateCreatorProfile(
        42,
        payload,
        {},
        [],
        []
      );
      expect(CreatorProfile.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("profile");
    });

    it("should also succeed when optional deliveryInstructions is absent", async () => {
      const payload = validCreationPayload();
      delete payload.deliveryInstructions;
      const result = await creatorProfileService.createOrUpdateCreatorProfile(
        42,
        payload,
        {},
        [],
        []
      );
      expect(CreatorProfile.create).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty("profile");
    });

    it("should throw AppError(400) when addressLine1 is missing on creation", async () => {
      const payload = validCreationPayload({ addressLine1: undefined });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toThrow(AppError);
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({ statusCode: 400, message: "addressLine1 is required" });
    });

    it("should throw AppError(400) when addressLine1 is an empty string on creation", async () => {
      const payload = validCreationPayload({ addressLine1: "   " });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({ statusCode: 400, message: "addressLine1 is required" });
    });

    it("should throw AppError(400) when suburb is missing on creation", async () => {
      const payload = validCreationPayload({ suburb: undefined });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({ statusCode: 400, message: "suburb is required" });
    });

    it("should throw AppError(400) when city is missing on creation", async () => {
      const payload = validCreationPayload({ city: undefined });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({ statusCode: 400, message: "city is required" });
    });

    it("should throw AppError(400) when province is missing on creation", async () => {
      const payload = validCreationPayload({ province: undefined });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({ statusCode: 400, message: "province is required" });
    });

    it("should throw AppError(400) when postalCode is missing on creation", async () => {
      const payload = validCreationPayload({ postalCode: undefined });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({ statusCode: 400, message: "postalCode is required" });
    });

    it("should throw AppError(400) when postalCode is null on creation", async () => {
      const payload = validCreationPayload({ postalCode: null });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({ statusCode: 400, message: "postalCode is required" });
    });
  });

  // -------------------------------------------------------------------------
  // createOrUpdateCreatorProfile — dateOfBirth (18+ age requirement)
  // -------------------------------------------------------------------------

  describe("createOrUpdateCreatorProfile — dateOfBirth validation", () => {
    it("should succeed when creator is 18 years or older on creation", async () => {
      const payload = validCreationPayload({ dateOfBirth: "1995-05-15" });
      const result = await creatorProfileService.createOrUpdateCreatorProfile(
        42,
        payload,
        {},
        [],
        []
      );
      expect(CreatorProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ dateOfBirth: "1995-05-15" }),
        expect.anything()
      );
      expect(result).toHaveProperty("profile");
    });

    it("should throw AppError(400) when creator is younger than 18 on creation", async () => {
      const today = new Date();
      const sixteenYearsAgo = new Date(today.getFullYear() - 16, today.getMonth(), today.getDate())
        .toISOString()
        .split("T")[0];

      const payload = validCreationPayload({ dateOfBirth: sixteenYearsAgo });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Creator must be at least 18 years old",
      });
    });

    it("should throw AppError(400) when dateOfBirth is in the future", async () => {
      const payload = validCreationPayload({ dateOfBirth: "2099-01-01" });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Creator must be at least 18 years old",
      });
    });

    it("should throw AppError(400) when dateOfBirth is an invalid date string", async () => {
      const payload = validCreationPayload({ dateOfBirth: "not-a-valid-date" });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Date of birth must be a valid date",
      });
    });

    it("should throw AppError(400) when updating profile with an under-18 dateOfBirth", async () => {
      const existingProfile = {
        id: 7,
        userId: 42,
        status: "approved",
        update: jest.fn().mockResolvedValue(true),
        setCategories: jest.fn().mockResolvedValue(true),
        setSkills: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: 7, userId: 42 }),
      };
      CreatorProfile.findOne.mockResolvedValue(existingProfile);

      const today = new Date();
      const tenYearsAgo = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate())
        .toISOString()
        .split("T")[0];

      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(
          42,
          { dateOfBirth: tenYearsAgo },
          {},
          [],
          []
        )
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Creator must be at least 18 years old",
      });
    });
  });

  // -------------------------------------------------------------------------
  // createOrUpdateCreatorProfile — update path (legacy / partial-update)
  // -------------------------------------------------------------------------

  describe("createOrUpdateCreatorProfile — update path (legacy backward compatibility)", () => {
    /** Simulate an existing legacy profile (NULL new address fields) */
    const buildLegacyProfile = (overrides = {}) => ({
      id: 7,
      status: "approved",
      addressLine1: null,
      addressLine2: null,
      suburb: null,
      postalCode: null,
      deliveryInstructions: null,
      update: jest.fn().mockResolvedValue(true),
      setCategories: jest.fn().mockResolvedValue(true),
      setSkills: jest.fn().mockResolvedValue(true),
      toJSON: () => ({ id: 7, status: "approved", ...overrides }),
      ...overrides,
    });

    it("should NOT throw when updating a legacy profile that has NULL address fields", async () => {
      const legacyProfile = buildLegacyProfile();
      CreatorProfile.findOne.mockResolvedValue(legacyProfile);

      // Update payload does NOT include address fields (legacy client)
      const result = await creatorProfileService.createOrUpdateCreatorProfile(
        7,
        { bio: "Updated bio" },
        {},
        [],
        []
      );

      expect(legacyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({ bio: "Updated bio" }),
        expect.anything()
      );
      expect(CreatorProfile.create).not.toHaveBeenCalled();
    });

    it("should NOT throw when updating an approved profile missing new address fields", async () => {
      const legacyProfile = buildLegacyProfile({ status: "approved" });
      CreatorProfile.findOne.mockResolvedValue(legacyProfile);

      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(
          7,
          { firstName: "Updated" },
          {},
          [],
          []
        )
      ).resolves.not.toThrow();
    });

    it("should update profile with new address fields when provided on update", async () => {
      const legacyProfile = buildLegacyProfile();
      CreatorProfile.findOne.mockResolvedValue(legacyProfile);

      await creatorProfileService.createOrUpdateCreatorProfile(
        7,
        { addressLine1: "10 Long Street", suburb: "Gardens", postalCode: "8001" },
        {},
        [],
        []
      );

      expect(legacyProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          addressLine1: "10 Long Street",
          suburb: "Gardens",
          postalCode: "8001",
        }),
        expect.anything()
      );
    });
  });

  // -------------------------------------------------------------------------
  // checkPublicNameAvailability
  // -------------------------------------------------------------------------

  describe("checkPublicNameAvailability", () => {
    it("should return { available: true } when name is not taken", async () => {
      CreatorProfile.findOne.mockResolvedValue(null);

      const result = await creatorProfileService.checkPublicNameAvailability(42, "NewCreator");

      expect(result).toEqual({ available: true });
    });

    it("should return { available: false } when name is taken by another user", async () => {
      CreatorProfile.findOne.mockResolvedValue({
        id: 10,
        userId: 99, // different user
        publicName: "NewCreator",
      });

      const result = await creatorProfileService.checkPublicNameAvailability(42, "NewCreator");

      expect(result).toEqual({
        available: false,
        message: "This creator name is already taken.",
      });
    });

    it("should return { available: true } when name belongs to current authenticated creator", async () => {
      CreatorProfile.findOne.mockResolvedValue({
        id: 10,
        userId: 42, // same user
        publicName: "MyOwnName",
      });

      const result = await creatorProfileService.checkPublicNameAvailability(42, "MyOwnName");

      expect(result).toEqual({ available: true });
    });

    it("should return { available: false } for case-insensitive duplicate", async () => {
      CreatorProfile.findOne.mockResolvedValue({
        id: 10,
        userId: 99,
        publicName: "RajCreates",
      });

      const result = await creatorProfileService.checkPublicNameAvailability(42, "rajcreates");

      expect(result).toEqual({
        available: false,
        message: "This creator name is already taken.",
      });
    });

    it("should return { available: false } for whitespace-padded match", async () => {
      CreatorProfile.findOne.mockResolvedValue({
        id: 10,
        userId: 99,
        publicName: "RajCreates",
      });

      const result = await creatorProfileService.checkPublicNameAvailability(42, "  RajCreates  ");

      expect(result).toEqual({
        available: false,
        message: "This creator name is already taken.",
      });
    });

    it("should throw AppError(400) when name query param is missing or empty", async () => {
      await expect(creatorProfileService.checkPublicNameAvailability(42, "")).rejects.toThrow(AppError);
      await expect(creatorProfileService.checkPublicNameAvailability(42, "   ")).rejects.toThrow(AppError);
      await expect(creatorProfileService.checkPublicNameAvailability(42, null)).rejects.toThrow(AppError);
    });

    it("should throw AppError(400) when name is shorter than 2 chars or longer than 50 chars", async () => {
      await expect(creatorProfileService.checkPublicNameAvailability(42, "a")).rejects.toThrow(AppError);
      await expect(creatorProfileService.checkPublicNameAvailability(42, "a".repeat(51))).rejects.toThrow(AppError);
    });
  });

  // -------------------------------------------------------------------------
  // createOrUpdateCreatorProfile — publicName validation & uniqueness
  // -------------------------------------------------------------------------

  describe("createOrUpdateCreatorProfile — publicName validation and uniqueness", () => {
    it("should throw AppError(400) when publicName is missing on creation", async () => {
      const payload = validCreationPayload({ publicName: undefined });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Public name is required",
      });
    });

    it("should throw AppError(400) when publicName is empty string or whitespace on creation", async () => {
      const payload = validCreationPayload({ publicName: "   " });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Public name is required",
      });
    });

    it("should throw AppError(400) when publicName length is invalid (< 2 or > 50 chars)", async () => {
      const payloadShort = validCreationPayload({ publicName: "x" });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payloadShort, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Public name must be between 2 and 50 characters",
      });

      const payloadLong = validCreationPayload({ publicName: "x".repeat(51) });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payloadLong, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Public name must be between 2 and 50 characters",
      });
    });

    it("should throw AppError(409) when publicName is already taken (pre-query)", async () => {
      CreatorProfile.findOne
        .mockResolvedValueOnce(null) // isUpdate check -> false (creation)
        .mockResolvedValueOnce({ id: 99, publicName: "ExistingName" }); // uniqueness pre-query -> found

      const payload = validCreationPayload({ publicName: "existingname" });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "This creator name is already taken.",
      });
    });

    it("should throw AppError(409) when database throws SequelizeUniqueConstraintError (race condition)", async () => {
      CreatorProfile.findOne.mockResolvedValue(null); // creation scenario & uniqueness pre-query returns null

      const dbConstraintError = new Error("Unique constraint violation");
      dbConstraintError.name = "SequelizeUniqueConstraintError";
      CreatorProfile.create.mockRejectedValue(dbConstraintError);

      const payload = validCreationPayload({ publicName: "ConcurrentName" });
      await expect(
        creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], [])
      ).rejects.toMatchObject({
        statusCode: 409,
        message: "This creator name is already taken.",
      });
    });

    it("should trim and preserve original casing when publicName is valid and unique", async () => {
      CreatorProfile.findOne.mockResolvedValue(null);

      const payload = validCreationPayload({ publicName: "  RajCreates  " });
      await creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], []);

      expect(CreatorProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          publicName: "RajCreates",
        }),
        expect.anything()
      );
    });

    it("should allow creator to update their profile with their own publicName", async () => {
      const existingProfile = {
        id: 1,
        userId: 42,
        publicName: "MyCustomName",
        status: "approved",
        update: jest.fn().mockResolvedValue(true),
        setCategories: jest.fn().mockResolvedValue(true),
        setSkills: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: 1, userId: 42, publicName: "MyCustomName" }),
      };

      CreatorProfile.findOne
        .mockResolvedValueOnce(existingProfile) // isUpdate -> true
        .mockResolvedValueOnce(null); // uniqueness check excluding profile.id 1 -> null

      const payload = { publicName: "MyCustomName" };
      await creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], []);

      expect(existingProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          publicName: "MyCustomName",
        }),
        expect.anything()
      );
    });
  });

  // -------------------------------------------------------------------------
  // getCreatorProfile — new fields appear in response
  // -------------------------------------------------------------------------

  describe("getCreatorProfile — new address fields in response", () => {
    it("should return new address fields in the profile response", async () => {
      const profileData = {
        id: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        addressLine1: "24 Main Road",
        addressLine2: null,
        suburb: "Sea Point",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8005",
        deliveryInstructions: "Leave at gate",
        streetNumber: null,
        status: "approved",
        isDeleted: false,
        mediaLinks: [],
        categories: [],
        skills: [],
        dateOfBirth: null,
        saIdNumber: null,
        passportNumber: null,
        phoneNumber: null,
      };

      CreatorProfile.findOne.mockResolvedValue({
        toJSON: () => profileData,
        ...profileData,
      });

      const result = await creatorProfileService.getCreatorProfile(99);

      expect(result).toHaveProperty("addressLine1", "24 Main Road");
      expect(result).toHaveProperty("suburb", "Sea Point");
      expect(result).toHaveProperty("postalCode", "8005");
      expect(result).toHaveProperty("deliveryInstructions", "Leave at gate");
      expect(result).toHaveProperty("addressLine2", null);
    });

    it("should return null for new address fields when profile has legacy NULL values", async () => {
      const profileData = {
        id: 2,
        firstName: "Legacy",
        lastName: "Creator",
        email: "legacy@example.com",
        addressLine1: null,
        addressLine2: null,
        suburb: null,
        postalCode: null,
        deliveryInstructions: null,
        streetNumber: "14",
        city: "Johannesburg",
        province: "Gauteng",
        status: "approved",
        isDeleted: false,
        mediaLinks: [],
        categories: [],
        skills: [],
        dateOfBirth: null,
        saIdNumber: null,
        passportNumber: null,
        phoneNumber: null,
      };

      CreatorProfile.findOne.mockResolvedValue({
        toJSON: () => profileData,
        ...profileData,
      });

      const result = await creatorProfileService.getCreatorProfile(100);

      // Should not crash, and should return null for new fields
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("addressLine1", null);
      expect(result).toHaveProperty("suburb", null);
      expect(result).toHaveProperty("postalCode", null);
      // Legacy field still accessible
      expect(result).toHaveProperty("streetNumber", "14");
    });
  });

  // -------------------------------------------------------------------------
  // reuploadCreatorDocuments
  // -------------------------------------------------------------------------

  describe("reuploadCreatorDocuments", () => {
    const mockProfile = {
      id: 1,
      userId: 42,
      status: "clarification_requested",
      clarificationRequested: true,
      rejectionReason: "Please provide valid permit",
      save: jest.fn().mockResolvedValue(true),
      toJSON: () => ({
        id: 1,
        userId: 42,
        status: "pending",
        clarificationRequested: false,
        rejectionReason: null,
        mediaLinks: [],
      }),
    };

    it("should throw AppError(400) when no files are provided", async () => {
      await expect(
        creatorProfileService.reuploadCreatorDocuments(42, {})
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "At least one document (residencePermit file or introVideoMediaId) is required for re-upload.",
      });

      await expect(
        creatorProfileService.reuploadCreatorDocuments(42, null)
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("should throw AppError(404) when creator profile is not found", async () => {
      mediaService.uploadMediaToCloudinary.mockResolvedValue({
        public_id: "residence_permit_123",
        provider: "cloudinary",
      });
      CreatorProfile.findOne.mockResolvedValue(null);

      const files = {
        residencePermit: [{ originalname: "permit.pdf", mimetype: "application/pdf", buffer: Buffer.from("pdf") }],
      };

      await expect(
        creatorProfileService.reuploadCreatorDocuments(42, files)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Creator profile not found.",
      });
    });

    it("should throw AppError(400) when creator profile is already approved", async () => {
      mediaService.uploadMediaToCloudinary.mockResolvedValue({
        public_id: "residence_permit_123",
        provider: "cloudinary",
      });
      CreatorProfile.findOne.mockResolvedValue({
        statusCode: 409,
        message: "This creator name is already taken.",
      });
    });

    it("should trim and preserve original casing when publicName is valid and unique", async () => {
      CreatorProfile.findOne.mockResolvedValue(null);

      const payload = validCreationPayload({ publicName: "  RajCreates  " });
      await creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], []);

      expect(CreatorProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          publicName: "RajCreates",
        }),
        expect.anything()
      );
    });

    it("should allow creator to update their profile with their own publicName", async () => {
      const existingProfile = {
        id: 1,
        userId: 42,
        publicName: "MyCustomName",
        status: "approved",
        update: jest.fn().mockResolvedValue(true),
        setCategories: jest.fn().mockResolvedValue(true),
        setSkills: jest.fn().mockResolvedValue(true),
        toJSON: () => ({ id: 1, userId: 42, publicName: "MyCustomName" }),
      };

      CreatorProfile.findOne
        .mockResolvedValueOnce(existingProfile) // isUpdate -> true
        .mockResolvedValueOnce(null); // uniqueness check excluding profile.id 1 -> null

      const payload = { publicName: "MyCustomName" };
      await creatorProfileService.createOrUpdateCreatorProfile(42, payload, {}, [], []);

      expect(existingProfile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          publicName: "MyCustomName",
        }),
        expect.anything()
      );
    });
  });

  // -------------------------------------------------------------------------
  // getCreatorProfile — new fields appear in response
  // -------------------------------------------------------------------------

  describe("getCreatorProfile — new address fields in response", () => {
    it("should return new address fields in the profile response", async () => {
      const profileData = {
        id: 1,
        firstName: "Jane",
        lastName: "Doe",
        email: "jane@example.com",
        addressLine1: "24 Main Road",
        addressLine2: null,
        suburb: "Sea Point",
        city: "Cape Town",
        province: "Western Cape",
        postalCode: "8005",
        deliveryInstructions: "Leave at gate",
        streetNumber: null,
        status: "approved",
        isDeleted: false,
        mediaLinks: [],
        categories: [],
        skills: [],
        dateOfBirth: null,
        saIdNumber: null,
        passportNumber: null,
        phoneNumber: null,
      };

      CreatorProfile.findOne.mockResolvedValue({
        toJSON: () => profileData,
        ...profileData,
      });

      const result = await creatorProfileService.getCreatorProfile(99);

      expect(result).toHaveProperty("addressLine1", "24 Main Road");
      expect(result).toHaveProperty("suburb", "Sea Point");
      expect(result).toHaveProperty("postalCode", "8005");
      expect(result).toHaveProperty("deliveryInstructions", "Leave at gate");
      expect(result).toHaveProperty("addressLine2", null);
    });

    it("should return null for new address fields when profile has legacy NULL values", async () => {
      const profileData = {
        id: 2,
        firstName: "Legacy",
        lastName: "Creator",
        email: "legacy@example.com",
        addressLine1: null,
        addressLine2: null,
        suburb: null,
        postalCode: null,
        deliveryInstructions: null,
        streetNumber: "14",
        city: "Johannesburg",
        province: "Gauteng",
        status: "approved",
        isDeleted: false,
        mediaLinks: [],
        categories: [],
        skills: [],
        dateOfBirth: null,
        saIdNumber: null,
        passportNumber: null,
        phoneNumber: null,
      };

      CreatorProfile.findOne.mockResolvedValue({
        toJSON: () => profileData,
        ...profileData,
      });

      const result = await creatorProfileService.getCreatorProfile(100);

      // Should not crash, and should return null for new fields
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("addressLine1", null);
      expect(result).toHaveProperty("suburb", null);
      expect(result).toHaveProperty("postalCode", null);
      // Legacy field still accessible
      expect(result).toHaveProperty("streetNumber", "14");
    });
  });

  // -------------------------------------------------------------------------
  // reuploadCreatorDocuments
  // -------------------------------------------------------------------------

  describe("reuploadCreatorDocuments", () => {
    const mockProfile = {
      id: 1,
      userId: 42,
      status: "clarification_requested",
      clarificationRequested: true,
      rejectionReason: "Please provide valid permit",
      save: jest.fn().mockResolvedValue(true),
      toJSON: () => ({
        id: 1,
        userId: 42,
        status: "pending",
        clarificationRequested: false,
        rejectionReason: null,
        mediaLinks: [],
      }),
    };

    it("should throw AppError(400) when no files are provided", async () => {
      await expect(
        creatorProfileService.reuploadCreatorDocuments(42, {})
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "At least one document (residencePermit file or introVideoMediaId) is required for re-upload.",
      });

      await expect(
        creatorProfileService.reuploadCreatorDocuments(42, null)
      ).rejects.toMatchObject({
        statusCode: 400,
      });
    });

    it("should throw AppError(404) when creator profile is not found", async () => {
      mediaService.uploadMediaToCloudinary.mockResolvedValue({
        public_id: "residence_permit_123",
        provider: "cloudinary",
      });
      CreatorProfile.findOne.mockResolvedValue(null);

      const files = {
        residencePermit: [{ originalname: "permit.pdf", mimetype: "application/pdf", buffer: Buffer.from("pdf") }],
      };

      await expect(
        creatorProfileService.reuploadCreatorDocuments(42, files)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Creator profile not found.",
      });
    });

    it("should throw AppError(400) when creator profile is already approved", async () => {
      mediaService.uploadMediaToCloudinary.mockResolvedValue({
        public_id: "residence_permit_123",
        provider: "cloudinary",
      });
      CreatorProfile.findOne.mockResolvedValue({
        ...mockProfile,
        status: "approved",
      });

      const files = {
        residencePermit: [{ originalname: "permit.pdf", mimetype: "application/pdf", buffer: Buffer.from("pdf") }],
      };

      await expect(
        creatorProfileService.reuploadCreatorDocuments(42, files)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Creator profile is already approved.",
      });
    });

    it("should successfully re-upload residencePermit, reset status to pending and clear clarificationRequested", async () => {
      const activeProfile = {
        ...mockProfile,
        status: "clarification_requested",
        clarificationRequested: true,
        rejectionReason: "Need updated document",
        save: jest.fn().mockResolvedValue(true),
        toJSON: () => ({
          id: 1,
          userId: 42,
          status: "pending",
          clarificationRequested: false,
          rejectionReason: null,
          mediaLinks: [],
        }),
      };

      CreatorProfile.findOne
        .mockResolvedValueOnce(activeProfile) // In reupload transaction
        .mockResolvedValueOnce({              // In getCreatorProfile
          toJSON: () => ({
            id: 1,
            userId: 42,
            status: "pending",
            clarificationRequested: false,
            rejectionReason: null,
            mediaLinks: [],
          }),
        });

      CreatorMedia.findAll.mockResolvedValue([
        { mediaId: "old-media-id-1" },
      ]);
      mediaService.deleteMediaData.mockResolvedValue(["old-public-id-1"]);
      mediaService.uploadMediaToCloudinary.mockResolvedValue({
        public_id: "new-permit-1",
        secure_url: "https://cloudinary.com/new-permit.pdf",
      });
      mediaService.uploadCreatorMedia.mockResolvedValue({
        id: "new-media-id",
        url: "https://cloudinary.com/new-permit.pdf",
      });

      const files = {
        residencePermit: [{ originalname: "permit.pdf", mimetype: "application/pdf" }],
      };

      const result = await creatorProfileService.reuploadCreatorDocuments(42, files);

      expect(activeProfile.status).toBe("pending");
      expect(activeProfile.clarificationRequested).toBe(false);
      expect(activeProfile.rejectionReason).toBeNull();
      expect(activeProfile.save).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result).toHaveProperty("profile");
      expect(result).toHaveProperty("media");
    });
    it("should successfully link introVideo via introVideoMediaId for a rejected profile and reset rejectionReason", async () => {
      const activeProfile = {
        id: 10,
        status: "rejected",
        rejectionReason: "Bad video",
        clarificationRequested: false,
        save: jest.fn().mockResolvedValue(true),
        toJSON: jest.fn().mockReturnValue({
          id: 10,
          status: "pending",
          rejectionReason: null,
          mediaLinks: [],
        }),
      };

      CreatorProfile.findOne
        .mockResolvedValueOnce(activeProfile)
        .mockResolvedValueOnce({
          toJSON: () => ({
            id: 10,
            status: "pending",
            rejectionReason: null,
            mediaLinks: [],
          }),
        });

      // Mock Media.findByPk to return a valid video media owned by the user
      const mockMediaRecord = {
        id: 77,
        type: "video",
        uploadedBy: 42,
        provider: "s3",
        storageKey: "media/creator_intro_videos/42/abc.mp4",
        save: jest.fn().mockResolvedValue(true),
      };
      Media.findByPk.mockResolvedValue(mockMediaRecord);

      // No existing intro_video links and no existing links elsewhere
      CreatorMedia.findOne.mockResolvedValue(null);
      CreatorMedia.findAll.mockResolvedValue([]);
      CreatorMedia.create.mockResolvedValue({ id: 99 });

      const result = await creatorProfileService.reuploadCreatorDocuments(42, {}, 77);

      // save() is a mock — verify it was called (which sets status/rejectionReason via service logic)
      expect(activeProfile.save).toHaveBeenCalled();
      expect(mockTransaction.commit).toHaveBeenCalled();
      expect(result).toHaveProperty("profile");
    });
  });
});
