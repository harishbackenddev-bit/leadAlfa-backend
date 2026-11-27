const { getUserRole } = require("../services/userService");
const { getBrandIdByUser } = require("../services/brandProfileService");
const { getCreatorIdByUser, getCreatorContextByUser } = require("../services/creatorProfileService");
const AppError = require("../utils/appError");

const attachChatContext = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = await getUserRole(userId);

    let profileId;
    if (role === "brand") {
      profileId = await getBrandIdByUser(userId);
    } else {
      const creatorCtx = await getCreatorContextByUser(userId);
      if (creatorCtx && creatorCtx.status !== "approved") {
        throw new AppError(`Action restricted. Your creator profile status is currently '${creatorCtx.status}'.`, 403);
      }
      profileId = creatorCtx?.id;
    }

    if (!profileId)
      throw new AppError(`${role} profile not found for the user`, 404);

    req.chatContext = { role, profileId };
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { attachChatContext };
