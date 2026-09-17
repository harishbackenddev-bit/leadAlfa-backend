class BaseSocialProvider {
  constructor(config) {
    this.config = config;
  }

  getAuthUrl(state) {
    throw new Error("getAuthUrl not implemented");
  }

  async exchangeCodeForToken(code) {
    throw new Error("exchangeCodeForToken not implemented");
  }

  async fetchProfile(accessToken) {
    throw new Error("fetchProfile not implemented");
  }
}

module.exports = BaseSocialProvider;
