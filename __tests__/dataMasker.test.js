jest.mock("uuid", () => ({ v4: () => "mock-uuid" }));

const {
  maskIdOrPassport,
  maskPhoneNumber,
  maskCreatorProfile,
  maskBrandProfile,
} = require("../utils/dataMasker");

describe("Data Masker Utility", () => {
  describe("maskIdOrPassport", () => {
    it("should mask SA ID number showing only last 4 digits", () => {
      expect(maskIdOrPassport("9201015009087")).toBe("*********9087");
    });

    it("should mask passport number showing only last 4 characters", () => {
      expect(maskIdOrPassport("A12345678")).toBe("*****5678");
    });

    it("should mask company registration number showing only last 4 characters", () => {
      expect(maskIdOrPassport("2015/123456/07")).toBe("**********6/07");
    });

    it("should return string as-is if length is 4 or less", () => {
      expect(maskIdOrPassport("1234")).toBe("1234");
      expect(maskIdOrPassport("ABC")).toBe("ABC");
    });

    it("should handle null, undefined, or empty values", () => {
      expect(maskIdOrPassport(null)).toBeNull();
      expect(maskIdOrPassport(undefined)).toBeUndefined();
      expect(maskIdOrPassport("")).toBe("");
    });
  });

  describe("maskPhoneNumber", () => {
    it("should mask South African phone number with +27 country code prefix", () => {
      expect(maskPhoneNumber("+27821234567")).toBe("+27*******67");
    });

    it("should mask formatted phone number with spaces and +27 prefix", () => {
      expect(maskPhoneNumber("+27 82 123 4567")).toBe("+27*******67");
    });

    it("should mask US phone number with +1 country code prefix", () => {
      expect(maskPhoneNumber("+14155552671")).toBe("+1********71");
    });

    it("should mask local phone number without + prefix", () => {
      expect(maskPhoneNumber("0821234567")).toBe("********67");
    });

    it("should handle short phone numbers gracefully", () => {
      expect(maskPhoneNumber("12")).toBe("12");
    });

    it("should handle null, undefined, or empty values", () => {
      expect(maskPhoneNumber(null)).toBeNull();
      expect(maskPhoneNumber(undefined)).toBeUndefined();
      expect(maskPhoneNumber("")).toBe("");
    });
  });

  describe("maskCreatorProfile", () => {
    it("should mask saIdNumber, passportNumber, and phoneNumber on creator profile object", () => {
      const inputProfile = {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        saIdNumber: "9201015009087",
        passportNumber: "A12345678",
        phoneNumber: "+27821234567",
        email: "john@example.com",
      };

      const masked = maskCreatorProfile(inputProfile);

      expect(masked.saIdNumber).toBe("*********9087");
      expect(masked.passportNumber).toBe("*****5678");
      expect(masked.phoneNumber).toBe("+27*******67");
      expect(masked.firstName).toBe("John");
    });

    it("should work with Sequelize model instance (using toJSON)", () => {
      const mockModelInstance = {
        toJSON: () => ({
          saIdNumber: "9201015009087",
          phoneNumber: "+27821234567",
        }),
      };

      const masked = maskCreatorProfile(mockModelInstance);
      expect(masked.saIdNumber).toBe("*********9087");
      expect(masked.phoneNumber).toBe("+27*******67");
    });

    it("should handle null or missing sensitive fields gracefully", () => {
      const inputProfile = {
        id: 1,
        firstName: "Jane",
        saIdNumber: null,
        passportNumber: undefined,
        phoneNumber: "",
      };

      const masked = maskCreatorProfile(inputProfile);
      expect(masked.saIdNumber).toBeNull();
      expect(masked.passportNumber).toBeUndefined();
      expect(masked.phoneNumber).toBe("");
    });
  });

  describe("maskBrandProfile", () => {
    it("should mask companyRegistrationNumber and phoneNumber on brand profile object", () => {
      const inputProfile = {
        id: 2,
        companyName: "Acme Corp",
        companyRegistrationNumber: "2015/123456/07",
        phoneNumber: "+27821234567",
      };

      const masked = maskBrandProfile(inputProfile);

      expect(masked.companyRegistrationNumber).toBe("**********6/07");
      expect(masked.phoneNumber).toBe("+27*******67");
      expect(masked.companyName).toBe("Acme Corp");
    });

    it("should handle null or missing brand fields gracefully", () => {
      const inputProfile = {
        id: 2,
        companyName: "Acme Corp",
        companyRegistrationNumber: null,
        phoneNumber: undefined,
      };

      const masked = maskBrandProfile(inputProfile);
      expect(masked.companyRegistrationNumber).toBeNull();
      expect(masked.phoneNumber).toBeUndefined();
    });
  });

  describe("Service Unmasking for Admin Review", () => {
    it("should support maskSensitiveData: false option in getCreatorProfile", async () => {
      const creatorProfileService = require("../services/creatorProfileService");
      const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");

      jest.spyOn(CreatorProfile, "findOne").mockResolvedValue({
        toJSON: () => ({
          saIdNumber: "9201015009087",
          passportNumber: "A12345678",
          phoneNumber: "+27821234567",
          mediaLinks: [],
        }),
      });

      const masked = await creatorProfileService.getCreatorProfile(1, { maskSensitiveData: true });
      expect(masked.saIdNumber).toBe("*********9087");

      const unmasked = await creatorProfileService.getCreatorProfile(1, { maskSensitiveData: false });
      expect(unmasked.saIdNumber).toBe("9201015009087");
      expect(unmasked.passportNumber).toBe("A12345678");
      expect(unmasked.phoneNumber).toBe("+27821234567");

      CreatorProfile.findOne.mockRestore();
    });

    it("should support maskSensitiveData: false option in getBrandProfile", async () => {
      const brandProfileService = require("../services/brandProfileService");
      const BrandProfile = require("../models/brandProfile/brandProfile.model");

      jest.spyOn(BrandProfile, "findOne").mockResolvedValue({
        toJSON: () => ({
          companyRegistrationNumber: "2015/123456/07",
          phoneNumber: "+27821234567",
          mediaLinks: [],
        }),
      });

      const masked = await brandProfileService.getBrandProfile(1, { maskSensitiveData: true });
      expect(masked.companyRegistrationNumber).toBe("**********6/07");

      const unmasked = await brandProfileService.getBrandProfile(1, { maskSensitiveData: false });
      expect(unmasked.companyRegistrationNumber).toBe("2015/123456/07");
      expect(unmasked.phoneNumber).toBe("+27821234567");

      BrandProfile.findOne.mockRestore();
    });
  });
});
