const InstagramProvider = require("./InstagramProvider");
const TikTokProvider = require("./TikTokProvider");

const getProvider = (platform) => {
  switch (platform) {
    case "instagram":
      return new InstagramProvider();

    case "tiktok":
      return new TikTokProvider();
      
    default:
      throw new Error("Unsupported platform");
  }
};

module.exports = { getProvider };
