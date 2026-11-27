const { getCreatorContextByUser } = require("../services/creatorProfileService");

const attachCreatorContext = async (req, res, next) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const creatorContext = await getCreatorContextByUser(userId);

    if (!creatorContext) {
      return res.status(403).json({
        error: "Creator profile not found. Complete creator setup first.",
      });
    }

    req.creatorId = creatorContext.id;
    req.creatorStatus = creatorContext.status;
    next();
  } catch (err) {
     console.error(err);
    return res.status(500).json({ error: "Could not load creator context" });
  }
};

module.exports = {attachCreatorContext};
