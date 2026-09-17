const CreatorSocialAccount = require("../models/socialAccounts/creatorSocialAccount.model");
const { encryptToken } = require("../utils/tokenCrypto");

const saveSocialAccount = async (
  creatorId,
  platform,
  tokenData,
  profileData,
) => {
  const encryptedAccessToken = encryptToken(tokenData.accessToken);
  const expiresAt = tokenData.expiresIn
    ? new Date(Date.now() + tokenData.expiresIn * 1000)
    : null;

  const [account] = await CreatorSocialAccount.upsert(
    {
      creatorId,
      platform,
      platformUserId: profileData.platformUserId,
      username: profileData.username,
      profileUrl: profileData.profileUrl,
      followersCount: profileData.followersCount,
      accessToken: encryptedAccessToken,
      tokenExpiresAt: expiresAt,
      lastSyncedAt: new Date(),
    },
    { returning: true },
  );

  return account;
};

module.exports = { saveSocialAccount };
