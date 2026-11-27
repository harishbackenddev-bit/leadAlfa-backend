const {
  getProvider,
} = require("../modules/socialAccounts/providers/providerFactory");
const { saveSocialAccount } = require("../services/socialAccountService");

const connect = (req, res) => {
  const { platform } = req.params;
  const provider = getProvider(platform);

  const state = encodeURIComponent(JSON.stringify({
    creatorId: req.creatorId,
    platform,
    nonce: Date.now(),
  }));
  const authUrl = provider.getAuthUrl(state);

  return res.json({ url: authUrl });
};

const callback = async (req, res) => {
  console.log("OAuth callback received with query:", req.query);
  try {
    const { platform } = req.params;
    const { code,state } = req.query;

    if (!code || !state) {
      throw new Error("Missing OAuth parameters");
    }

    const parsedState = JSON.parse(decodeURIComponent(state));
    const creatorId = parsedState.creatorId;

    const provider = getProvider(platform);

    const tokenData = await provider.exchangeCodeForToken(code);
    const profile = await provider.fetchProfile(tokenData.accessToken);

    await saveSocialAccount(creatorId, platform, tokenData, profile);

    return res.redirect(
      `${process.env.FRONTEND_URL}/dashboard?${platform}=connected`,
    );
  } catch (err) {
    console.error("Social connect error:", err.message);

    return res.redirect(`${process.env.FRONTEND_URL}/dashboard?status=error`);
  }
};

module.exports = { connect, callback };

