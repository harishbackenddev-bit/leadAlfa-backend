const multer = require("multer");
const fs = require("fs");
const path = require("path");
const os = require("os");

const tmpUploadsDir = path.join(os.tmpdir(), "leeds_uploads");
if (!fs.existsSync(tmpUploadsDir)) {
  fs.mkdirSync(tmpUploadsDir, { recursive: true });
}

const memoryStorage = multer.memoryStorage();

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tmpUploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname.replace(/\s+/g, "_"));
  },
});

const hybridStorage = {
  _handleFile: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("video/")) {
      diskStorage._handleFile(req, file, cb);
    } else {
      memoryStorage._handleFile(req, file, cb);
    }
  },
  _removeFile: (req, file, cb) => {
    if (file.mimetype && file.mimetype.startsWith("video/")) {
      diskStorage._removeFile(req, file, cb);
    } else {
      memoryStorage._removeFile(req, file, cb);
    }
  },
};

const upload = multer({
  storage: hybridStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB Max
  },
});

module.exports = upload;
