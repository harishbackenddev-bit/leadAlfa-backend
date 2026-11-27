const turnstileService = require("../services/turnstileService");
const turnstileConfig = require("../config/turnstile.config");
const { verifyTurnstileToken } = require("../middlewares/turnstileMiddleware");

jest.mock("../services/turnstileService");

describe("Turnstile Middleware & Integration", () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      body: {},
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
    jest.clearAllMocks();

    // Default config state for tests
    turnstileConfig.enabled = true;
    turnstileConfig.failOpen = true;
  });

  describe("verifyTurnstileToken", () => {
    it("should bypass verification and call next() if TURNSTILE_ENABLED is false", async () => {
      turnstileConfig.enabled = false;

      await verifyTurnstileToken(req, res, next);

      expect(turnstileService.verifyToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should extract token from req.body['cf-turnstile-response'] (Priority 1)", async () => {
      req.body["cf-turnstile-response"] = "token-from-widget";
      turnstileService.verifyToken.mockResolvedValue({
        success: true,
        challenge_ts: "2026-08-14T22:00:00Z",
      });

      await verifyTurnstileToken(req, res, next);

      expect(turnstileService.verifyToken).toHaveBeenCalledWith("token-from-widget", "127.0.0.1");
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.turnstile).toBeDefined();
    });

    it("should extract token from req.body.captchaToken (Priority 2)", async () => {
      req.body.captchaToken = "token-from-json";
      turnstileService.verifyToken.mockResolvedValue({
        success: true,
      });

      await verifyTurnstileToken(req, res, next);

      expect(turnstileService.verifyToken).toHaveBeenCalledWith("token-from-json", "127.0.0.1");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should extract token from req.headers['x-turnstile-response'] (Priority 3)", async () => {
      req.headers["x-turnstile-response"] = "token-from-header";
      turnstileService.verifyToken.mockResolvedValue({
        success: true,
      });

      await verifyTurnstileToken(req, res, next);

      expect(turnstileService.verifyToken).toHaveBeenCalledWith("token-from-header", "127.0.0.1");
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("should return 400 Bad Request when token is missing", async () => {
      turnstileService.verifyToken.mockResolvedValue({
        success: false,
        reason: "MISSING_TOKEN",
        errorCodes: ["missing-input-response"],
      });

      await verifyTurnstileToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Security verification failed",
          reason: "MISSING_TOKEN",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should return 400 Bad Request when token is invalid or bot detected", async () => {
      req.body["cf-turnstile-response"] = "invalid-token";
      turnstileService.verifyToken.mockResolvedValue({
        success: false,
        reason: "INVALID_TOKEN",
        errorCodes: ["invalid-input-response"],
      });

      await verifyTurnstileToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Security verification failed",
          reason: "INVALID_TOKEN",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("should pass request with next() when service is unreachable and failOpen is true", async () => {
      req.body["cf-turnstile-response"] = "some-token";
      turnstileService.verifyToken.mockResolvedValue({
        success: true,
        bypassed: true,
        reason: "SERVICE_UNREACHABLE",
      });

      await verifyTurnstileToken(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should return 503 Service Unavailable when service is unreachable and failOpen is false", async () => {
      req.body["cf-turnstile-response"] = "some-token";
      turnstileService.verifyToken.mockResolvedValue({
        success: false,
        reason: "SERVICE_UNREACHABLE",
        error: "timeout of 5000ms exceeded",
      });

      await verifyTurnstileToken(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: "Security verification service unavailable",
          reason: "SERVICE_UNREACHABLE",
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });
});
