const {getBrandIdByUser} = require("../services/brandProfileService");

const attachBrandContext = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const brandId = await getBrandIdByUser(userId);

    if (!brandId) {
      return res.status(403).json({
        error: "Brand profile not found. Complete brand setup first.",
      });
    }

    req.brandId = brandId;
    next();
  } catch (err) {
     console.error(err);
    return res.status(500).json({ error: "Could not load brand context" });
  }
};

module.exports = {attachBrandContext};
