const cloudinary = require("../config/cloudinary.config");
const slugify = require("slugify");
const streamifier = require("streamifier");
const fs = require("fs").promises;

// Upload to cloudinary
const uploadToCloudinary = async (file, country, category, type) => {
  const safeFileName = slugify(file.originalname, {
    lower: true,
    strict: true,
  });

  const prefix = process.env.CLOUDINARY_FOLDER_PREFIX || "creatrend";
  const folderPath = `${prefix}/${country}/${category}/${type}`;

  const public_id = `${safeFileName.split(".")[0]}_${Date.now()}`; 

  try {
    if (file.path) {
      // Disk Storage handling (optimized for large files/videos)
      const options = {
        folder: folderPath,
        public_id: public_id,
        resource_type: "auto",
      };

      let result;
      if (file.mimetype && file.mimetype.startsWith("video/")) {
        result = await cloudinary.uploader.upload_large(file.path, options);
      } else {
        result = await cloudinary.uploader.upload(file.path, options);
      }

      return {
        url: result.secure_url,
        id: result.public_id,
      };
    } else if (file.buffer) {
      // Memory Storage handling (stream for small files)
      return new Promise((resolve, reject) => {
        let cldStream = cloudinary.uploader.upload_stream(
          {
            folder: folderPath,
            public_id: public_id,
            resource_type: "auto",
          },
          (error, result) => {
            if (error) reject(error);
            else
              resolve({
                url: result.secure_url,
                id: result.public_id,
              });
          }
        );
        streamifier.createReadStream(file.buffer).pipe(cldStream);
      });
    } else {
      throw new Error("Invalid file object provided for upload");
    }
  } finally {
    // Always clean up temp files
    if (file.path) {
      try {
        await fs.unlink(file.path);
      } catch (cleanupError) {
        console.error("Failed to clean up temp file:", file.path, cleanupError);
      }
    }
  }
};

module.exports = { uploadToCloudinary };
