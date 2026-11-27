const validateSAIdNumber = (value) => {
  if (!value || typeof value !== "string") {
    return {
      valid: false,
      message: "SA ID is required",
    };
  }

  if (!/^\d{13}$/.test(value)) {
    return {
      valid: false,
      message: "SA ID must contain exactly 13 digits",
    };
  }

  const yy = parseInt(value.substring(0, 2), 10);
  const mm = parseInt(value.substring(2, 4), 10);
  const dd = parseInt(value.substring(4, 6), 10);

  const fullYear = yy <= new Date().getFullYear() % 100 ? 2000 + yy : 1900 + yy;
  const dob = new Date(fullYear, mm - 1, dd);

  if (
    dob.getFullYear() !== fullYear ||
    dob.getMonth() !== mm - 1 ||
    dob.getDate() !== dd
  ) {
    return {
      valid: false,
      message: "Invalid birth date in SA ID",
    };
  }

  if (dob > new Date()) {
    return {
      valid: false,
      message: "Birth date in SA ID cannot be in the future",
    };
  }

  const cit = parseInt(value.charAt(10), 10);
  if (cit !== 0 && cit !== 1 && cit !== 2) {
    return {
      valid: false,
      message: "Invalid citizenship status in SA ID",
    };
  }


  let sum = 0;
  let shouldDouble = true;
  for (let i = 11; i >= 0; i--) {
    let digit = parseInt(value.charAt(i), 10);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  const calculatedChecksum = (10 - (sum % 10)) % 10;
  const providedChecksum = parseInt(value.charAt(12), 10);

  if (calculatedChecksum !== providedChecksum) {
    return {
      valid: false,
      message: "Invalid SA ID checksum",
    };
  }

  return {
    valid: true,
    dob,
    citizenship: cit,
  };
};

module.exports = { validateSAIdNumber };
