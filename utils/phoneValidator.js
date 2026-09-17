const { parsePhoneNumberWithError } = require("libphonenumber-js/max");

/**
 * Universal phone number validator for generic registration.
 *
 * @param {string} phoneInput - Raw user input
 * @param {string[]} priorityCountries - Priority target regions to check for prefix-less local numbers
 * @returns {{ isValid: boolean, e164?: string, country?: string, type?: string, message?: string }}
 */
function validateGenericPhone(phoneInput, priorityCountries = ["ZA", "IN", "US", "GB"]) {
  if (!phoneInput || typeof phoneInput !== "string") {
    return {
      isValid: false,
      message: "Phone number cannot be blank.",
    };
  }

  const cleaned = phoneInput.trim().replace(/[\s\-\(\)\.]/g, "");

  if (!cleaned) {
    return {
      isValid: false,
      message: "Phone number cannot be blank.",
    };
  }

  let phoneNumber = null;

  if (cleaned.startsWith("+")) {
    try {
      const parsed = parsePhoneNumberWithError(cleaned);
      if (parsed && parsed.isValid()) {
        phoneNumber = parsed;
      }
    } catch (_) {}
  } else {
    try {
      const parsed = parsePhoneNumberWithError("+" + cleaned);
      if (parsed && parsed.isValid()) {
        phoneNumber = parsed;
      }
    } catch (_) {}

    if (!phoneNumber) {
      for (const country of priorityCountries) {
        try {
          const parsed = parsePhoneNumberWithError(cleaned, country);
          if (parsed && parsed.isValid()) {
            phoneNumber = parsed;
            break;
          }
        } catch (_) {}
      }
    }
  }

  if (phoneNumber && phoneNumber.isValid()) {
    return {
      isValid: true,
      e164: phoneNumber.format("E.164"),
      country: phoneNumber.country,
      type: phoneNumber.getType ? phoneNumber.getType() : undefined,
    };
  }

  return {
    isValid: false,
    message: "Invalid international phone number format.",
  };
}

/**
 * Validates a South African phone number strictly (local 10-digit format starting with 0 or +27 international format).
 *
 * @param {string} phoneInput - Raw phone number string (e.g. "0821234567", "+27821234567")
 * @param {{ mobileOnly?: boolean }} [options] - Additional validation options
 * @returns {{ isValid: boolean, e164?: string, country?: string, type?: string, message?: string }}
 */
function validateSouthAfricanPhone(phoneInput, options = {}) {
  if (!phoneInput || typeof phoneInput !== "string") {
    return {
      isValid: false,
      message: "Phone number must be a non-empty string.",
    };
  }

  const trimmed = phoneInput.trim();
  if (!trimmed) {
    return {
      isValid: false,
      message: "Phone number cannot be blank.",
    };
  }

  try {
    const phoneNumber = parsePhoneNumberWithError(trimmed, "ZA");

    if (!phoneNumber || !phoneNumber.isValid() || phoneNumber.country !== "ZA") {
      return {
        isValid: false,
        message: "Phone number must be a valid South African phone number.",
      };
    }

    const isSubscriberType = ["MOBILE", "FIXED_LINE", "FIXED_LINE_OR_MOBILE"].includes(phoneNumber.getType());
    const isStandardLength = phoneNumber.nationalNumber && phoneNumber.nationalNumber.length === 9;

    if (!isSubscriberType || !isStandardLength) {
      return {
        isValid: false,
        message: "Phone number must be a valid 10-digit South African subscriber phone number.",
      };
    }

    if (options.mobileOnly && phoneNumber.getType() !== "MOBILE") {
      return {
        isValid: false,
        message: "Phone number must be a valid South African mobile phone number.",
      };
    }

    console.log(`Valid South African phone number detected: ${phoneNumber.format("E.164")} (Type: ${phoneNumber.getType()})`);

    return {
      isValid: true,
      e164: phoneNumber.format("E.164"),
      country: "ZA",
      type: phoneNumber.getType(),
    };
  } catch (error) {
    return {
      isValid: false,
      message: "Phone number must be a valid South African phone number.",
    };
  }
}

module.exports = {
  validateGenericPhone,
  validateSouthAfricanPhone,
};
