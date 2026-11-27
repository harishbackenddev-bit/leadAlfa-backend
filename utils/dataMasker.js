const { parsePhoneNumberWithError } = require("libphonenumber-js/max");

/**
 * Masks an ID number, passport number, or registration number string.
 * Keeps only the last 4 characters unmasked, replacing all preceding characters with '*'.
 *
 * @param {string|null|undefined} val
 * @returns {string|null|undefined}
 */
function maskIdOrPassport(val) {
  if (val === null || val === undefined) return val;
  const str = String(val).trim();
  if (!str) return val;
  if (str.length <= 4) return str;
  return "*".repeat(str.length - 4) + str.slice(-4);
}

/**
 * Masks a phone number string.
 * Keeps country code prefix if present (e.g. +27) and the last 2 digits unmasked.
 * Replaces all other digits with '*'.
 *
 * @param {string|null|undefined} phoneVal
 * @returns {string|null|undefined}
 */
function maskPhoneNumber(phoneVal) {
  if (phoneVal === null || phoneVal === undefined) return phoneVal;
  const str = String(phoneVal).trim();
  if (!str) return phoneVal;

  let countryPrefix = "";
  let nationalNumber = "";

  if (str.startsWith("+")) {
    try {
      const parsed = parsePhoneNumberWithError(str);
      if (parsed && parsed.countryCallingCode) {
        countryPrefix = "+" + parsed.countryCallingCode;
        nationalNumber = parsed.nationalNumber || "";
      }
    } catch (_) {}

    if (!countryPrefix) {
      const match = str.match(/^(\+\d{1,4})(.*)$/);
      if (match) {
        countryPrefix = match[1];
        nationalNumber = match[2].replace(/\D/g, "");
      }
    }
  }

  if (!nationalNumber) {
    nationalNumber = str.replace(/\D/g, "");
  }

  if (!nationalNumber) return str;

  if (nationalNumber.length <= 2) {
    return `${countryPrefix}${nationalNumber}`;
  }

  const maskedNational = "*".repeat(nationalNumber.length - 2) + nationalNumber.slice(-2);
  return `${countryPrefix}${maskedNational}`;
}

/**
 * Applies masking to a creator profile object.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function maskCreatorProfile(profile) {
  if (!profile) return profile;
  const clone = typeof profile.toJSON === "function" ? profile.toJSON() : { ...profile };

  if (clone.saIdNumber) {
    clone.saIdNumber = maskIdOrPassport(clone.saIdNumber);
  }
  if (clone.passportNumber) {
    clone.passportNumber = maskIdOrPassport(clone.passportNumber);
  }
  if (clone.phoneNumber) {
    clone.phoneNumber = maskPhoneNumber(clone.phoneNumber);
  }
  return clone;
}

/**
 * Applies masking to a brand profile object.
 *
 * @param {Object} profile
 * @returns {Object}
 */
function maskBrandProfile(profile) {
  if (!profile) return profile;
  const clone = typeof profile.toJSON === "function" ? profile.toJSON() : { ...profile };

  if (clone.companyRegistrationNumber) {
    clone.companyRegistrationNumber = maskIdOrPassport(clone.companyRegistrationNumber);
  }
  if (clone.phoneNumber) {
    clone.phoneNumber = maskPhoneNumber(clone.phoneNumber);
  }
  return clone;
}

module.exports = {
  maskIdOrPassport,
  maskPhoneNumber,
  maskCreatorProfile,
  maskBrandProfile,
};
