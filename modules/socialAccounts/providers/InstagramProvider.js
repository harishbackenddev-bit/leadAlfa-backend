const axios = require("axios");
const BaseSocialProvider = require("../BaseSocialProvider");

class InstagramProvider extends BaseSocialProvider {
  constructor() {
    super({
      appId: process.env.INSTA_APP_ID,
      appSecret: process.env.INSTA_APP_SECRET,
      redirectUri: process.env.INSTA_CALLBACK_URL,
    });
  }

  getAuthUrl(state) {
    const scope = [
      "instagram_basic",
      "pages_show_list",
      "pages_read_engagement",
      "instagram_manage_insights"
    ].join(",");

    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${this.config.appId}&redirect_uri=${encodeURIComponent(
      this.config.redirectUri,
    )}&scope=${scope}&state=${state}&response_type=code`;
  }

  async exchangeCodeForToken(code) {
    const shortTokenRes = await axios.get(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        params: {
          client_id: this.config.appId,
          client_secret: this.config.appSecret,
          redirect_uri: this.config.redirectUri,
          code,
        },
      },
    );

    const shortToken = shortTokenRes.data.access_token;

    const longTokenRes = await axios.get(
      "https://graph.facebook.com/v18.0/oauth/access_token",
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: this.config.appId,
          client_secret: this.config.appSecret,
          fb_exchange_token: shortToken,
        },
      },
    );

    return {
      accessToken: longTokenRes.data.access_token,
      expiresIn: longTokenRes.data.expires_in,
    };
  }

  async fetchProfile(accessToken) {
    const pageRes = await axios.get(
      "https://graph.facebook.com/v18.0/me/accounts",
      { params: { access_token: accessToken } },
    );

    if (!pageRes.data.data.length) {
      throw new Error("No Facebook pages linked");
    }

    const pageId = pageRes.data.data[0].id;

    const igAccountRes = await axios.get(
      `https://graph.facebook.com/v18.0/${pageId}`,
      {
        params: {
          fields: "instagram_business_account",
          access_token: accessToken,
        },
      },
    );

    const igUserId = igAccountRes.data.instagram_business_account?.id;

    if (!igUserId) {
      throw new Error("Instagram business account not found");
    }

    const profileRes = await axios.get(
      `https://graph.facebook.com/v18.0/${igUserId}`,
      {
        params: {
          fields: "username,followers_count,profile_picture_url",
          access_token: accessToken,
        },
      },
    );

    return {
      platformUserId: igUserId,
      username: profileRes.data.username,
      followersCount: profileRes.data.followers_count,
      profileUrl: `https://instagram.com/${profileRes.data.username}`,
    };
  }
}

module.exports = InstagramProvider;
