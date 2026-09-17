const axios = require("axios");
const BaseSocialProvider = require("../BaseSocialProvider");

class TikTokProvider extends BaseSocialProvider {
  constructor() {
    super({
      clientKey: process.env.TIKTOK_CLIENT_KEY,
      clientSecret: process.env.TIKTOK_CLIENT_SECRET,
      redirectUri: process.env.TIKTOK_CALLBACK_URL,
    });
  }

  getAuthUrl(state) {
    const scope = ["user.info.basic", "user.info.stats"].join(",");

    return `https://www.tiktok.com/v2/auth/authorize/?client_key=${
      this.config.clientKey
    }&response_type=code&scope=${encodeURIComponent(
      scope,
    )}&redirect_uri=${encodeURIComponent(
      this.config.redirectUri,
    )}&state=${state}`;
  }

  async exchangeCodeForToken(code) {
    const tokenRes = await axios.post(
      "https://open.tiktokapis.com/v2/oauth/token/",
      {
        client_key: this.config.clientKey,
        client_secret: this.config.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.config.redirectUri,
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    const data = tokenRes.data;

    if (!data || !data.access_token) {
      throw new Error("Failed to obtain TikTok access token");
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };
  }

  async fetchProfile(accessToken) {
    const profileRes = await axios.get(
      "https://open.tiktokapis.com/v2/user/info/",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          fields: "open_id,username,avatar_url,follower_count",
        },
      },
    );

    const user = profileRes.data?.data?.user;

    if (!user) {
      throw new Error("Failed to fetch TikTok user profile");
    }

    return {
      platformUserId: user.open_id,
      username: user.username,
      followersCount: user.follower_count,
      profileUrl: `https://www.tiktok.com/@${user.username}`,
    };
  }
}

module.exports = TikTokProvider;
