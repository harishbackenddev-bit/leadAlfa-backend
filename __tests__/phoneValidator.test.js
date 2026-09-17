const {
  validateGenericPhone,
  validateSouthAfricanPhone,
} = require("../utils/phoneValidator");

describe("Phone Validator Utility (libphonenumber-js/max)", () => {
  describe("validateGenericPhone (Global International Numbers)", () => {
    it("should validate and canonicalize valid US phone number", () => {
      const result = validateGenericPhone("+14155552671");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+14155552671");
      expect(result.country).toBe("US");
    });

    it("should validate and canonicalize valid UK phone number", () => {
      const result = validateGenericPhone("+442079460912");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+442079460912");
      expect(result.country).toBe("GB");
    });

    it("should validate and canonicalize valid SA phone number in E.164 format", () => {
      const result = validateGenericPhone("+27821234567");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+27821234567");
      expect(result.country).toBe("ZA");
    });

    it("should sanitize and validate formatted numbers with spaces, brackets, hyphens", () => {
      const result = validateGenericPhone("+1 (415) 555-2671");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+14155552671");
      expect(result.country).toBe("US");
    });

    it("should validate international number entered without '+' prefix (e.g. 919041227845)", () => {
      const result = validateGenericPhone("919041227845");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+919041227845");
      expect(result.country).toBe("IN");
    });

    it("should validate local SA phone number entered without country code (e.g. 0821234567)", () => {
      const result = validateGenericPhone("0821234567");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+27821234567");
      expect(result.country).toBe("ZA");
    });

    it("should reject regex anti-pattern inputs (e.g. ++++--0000000)", () => {
      const result = validateGenericPhone("++++--0000000");
      expect(result.isValid).toBe(false);
      expect(result.message).toBeDefined();
    });

    it("should reject short / malformed numbers", () => {
      const result = validateGenericPhone("12345");
      expect(result.isValid).toBe(false);
    });

    it("should reject non-string or empty input", () => {
      expect(validateGenericPhone("").isValid).toBe(false);
      expect(validateGenericPhone(null).isValid).toBe(false);
      expect(validateGenericPhone(undefined).isValid).toBe(false);
    });
  });

  describe("validateSouthAfricanPhone (Strict South Africa Numbers)", () => {
    it("should validate and canonicalize local 10-digit SA mobile number starting with 0", () => {
      const result = validateSouthAfricanPhone("0821234567");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+27821234567");
      expect(result.country).toBe("ZA");
    });

    it("should validate and canonicalize formatted local SA number (082) 123-4567", () => {
      const result = validateSouthAfricanPhone("(082) 123-4567");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+27821234567");
      expect(result.country).toBe("ZA");
    });

    it("should validate international format +27821234567", () => {
      const result = validateSouthAfricanPhone("+27821234567");
      expect(result.isValid).toBe(true);
      expect(result.e164).toBe("+27821234567");
    });

    it("should reject non-South African international numbers (e.g. US +14155552671)", () => {
      const result = validateSouthAfricanPhone("+14155552671");
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("South African");
    });

    it("should reject invalid SA phone numbers (e.g. 0000000000)", () => {
      const result = validateSouthAfricanPhone("0000000000");
      expect(result.isValid).toBe(false);
    });

    it("should reject invalid length SA numbers", () => {
      const result = validateSouthAfricanPhone("082123");
      expect(result.isValid).toBe(false);
    });
  });
});
