const mime = require("mime-types");
const AppError = require("./appError");

function getEffectiveMime(file) {
  if (!file) return "application/octet-stream";
  const rawMime = file.mimetype;
  if (!rawMime || rawMime === "application/octet-stream" || rawMime === "binary/octet-stream") {
    const lookedUp = mime.lookup(file.originalname || "");
    if (lookedUp) return lookedUp;
  }
  return rawMime || "application/octet-stream";
}

const generateMulterFields = (config) => {
  return Object.keys(config).map((fieldname) => ({
    name: fieldname,
    maxCount: config[fieldname].maxCount || 1,
  }));
};

const validateMediaFields = (config) => {
  return (req, res, next) => {
    if (!req.files) return next();

    for (const [fieldname, files] of Object.entries(req.files)) {
      const fieldConfig = config[fieldname];

      if (!fieldConfig) {
        return next(new AppError(`Unexpected file upload field: ${fieldname}`, 400));
      }

      if (fieldConfig.maxCount && files.length > fieldConfig.maxCount) {
        return next(new AppError(`Too many files for '${fieldname}'. Maximum allowed is ${fieldConfig.maxCount}.`, 400));
      }

      for (const file of files) {
        file.mimetype = getEffectiveMime(file);

        if (fieldConfig.allowedTypes && !fieldConfig.allowedTypes.includes(file.mimetype)) {
          return next(
            new AppError(
              `Invalid file type for '${fieldname}'. Allowed types: ${fieldConfig.allowedTypes.join(", ")}`,
              400
            )
          );
        }

        if (fieldConfig.maxSize && file.size > fieldConfig.maxSize) {
          const maxSizeMB = fieldConfig.maxSize / (1024 * 1024);
          return next(
            new AppError(
              `File size for '${fieldname}' exceeds the limit of ${maxSizeMB}MB.`,
              400
            )
          );
        }
      }
    }
    
    next();
  };
};

const validateMediaArray = (config) => {
  return (req, res, next) => {
    if (!req.files || !Array.isArray(req.files)) return next();

    for (const file of req.files) {
      file.mimetype = getEffectiveMime(file);

      if (config.allowedTypes && !config.allowedTypes.includes(file.mimetype)) {
        return next(
          new AppError(`Invalid file type. Allowed types: ${config.allowedTypes.join(", ")}`, 400)
        );
      }
      if (config.maxSize && file.size > config.maxSize) {
        return next(
          new AppError(`File size exceeds the limit of ${config.maxSize / (1024 * 1024)}MB.`, 400)
        );
      }
    }
    next();
  };
};

const validateMediaSingle = (config) => {
  return (req, res, next) => {
    if (!req.file) return next();

    const file = req.file;
    file.mimetype = getEffectiveMime(file);

    if (config.allowedTypes && !config.allowedTypes.includes(file.mimetype)) {
      return next(
        new AppError(`Invalid file type. Allowed types: ${config.allowedTypes.join(", ")}`, 400)
      );
    }
    if (config.maxSize && file.size > config.maxSize) {
      return next(
        new AppError(`File size exceeds the limit of ${config.maxSize / (1024 * 1024)}MB.`, 400)
      );
    }
    
    next();
  };
};

module.exports = { validateMediaFields, generateMulterFields, validateMediaArray, validateMediaSingle };
