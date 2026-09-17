const axios = require("axios");
const turnstileConfig = require("../config/turnstile.config");
const { verifyToken } = require("../services/turnstileService");

jest.mock("axios");

describe("Turnstile Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    turnstileConfig.secretKey = "1x0000000000000000000000000000000AA";
    turnstileConfig.failOpen = true;
    turnstileConfig.timeoutMs = 5000;
  });

  it("should return MISSING_TOKEN if token is empty", async () => {
    const result = await verifyToken("", "127.0.0.1");
    expect(result).toEqual({
      success: false,
      reason: "MISSING_TOKEN",
      errorCodes: ["missing-input-response"],
    });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("should return success: true when Cloudflare verifies token successfully", async () => {
    axios.post.mockResolvedValue({
      data: {
        success: true,
        challenge_ts: "2026-08-14T22:00:00Z",
        hostname: "example.com",
      },
    });

    const result = await verifyToken("valid-token", "192.168.1.1");

    expect(axios.post).toHaveBeenCalledWith(
      turnstileConfig.verifyUrl,
      expect.stringContaining("response=valid-token"),
      expect.objectContaining({
        timeout: 5000,
      })
    );
    expect(result.success).toBe(true);
    expect(result.hostname).toBe("example.com");
  });

  it("should return INVALID_TOKEN when Cloudflare verification fails", async () => {
    axios.post.mockResolvedValue({
      data: {
        success: false,
        "error-codes": ["invalid-input-response"],
      },
    });

    const result = await verifyToken("invalid-token", "192.168.1.1");

    expect(result.success).toBe(false);
    expect(result.reason).toBe("INVALID_TOKEN");
    expect(result.errorCodes).toEqual(["invalid-input-response"]);
  });

  it("should fail open and return success: true with bypassed flag when API times out and failOpen=true", async () => {
    turnstileConfig.failOpen = true;
    axios.post.mockRejectedValue(new Error("timeout of 5000ms exceeded"));

    const result = await verifyToken("any-token", "127.0.0.1");

    expect(result).toEqual({
      success: true,
      bypassed: true,
      reason: "SERVICE_UNREACHABLE",
      error: "timeout of 5000ms exceeded",
    });
  });

  it("should fail closed and return success: false when API times out and failOpen=false", async () => {
    turnstileConfig.failOpen = false;
    axios.post.mockRejectedValue(new Error("Network Error"));

    const result = await verifyToken("any-token", "127.0.0.1");

    expect(result).toEqual({
      success: false,
      reason: "SERVICE_UNREACHABLE",
      error: "Network Error",
    });
  });
});
