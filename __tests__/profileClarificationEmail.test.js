const profileClarificationEmail = require("../utils/email/templates/profileClarificationEmail");

describe("profileClarificationEmail template", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should generate creator clarification email with staging FRONTEND_URL", () => {
    process.env.FRONTEND_URL = "https://staging.creatrend.com";
    process.env.ADMIN_EMAIL = "admin@creatrend.com";

    const { subject, text, html, replyTo, targetUrl } = profileClarificationEmail(
      "Jane Doe",
      "Please re-upload your residence permit and intro video.",
      "Creator"
    );

    expect(subject).toBe("Clarification required for your Creator Profile");
    expect(replyTo).toBe("admin@creatrend.com");
    expect(targetUrl).toBe("https://staging.creatrend.com/creator/profile");

    // Text assertions
    expect(text).toContain("Hi Jane Doe,");
    expect(text).toContain("Please re-upload your residence permit and intro video.");
    expect(text).toContain("https://staging.creatrend.com/creator/profile");
    expect(text).toContain("residence permit or introduction video");

    // HTML assertions
    expect(html).toContain("Hi Jane Doe,");
    expect(html).toContain("Please re-upload your residence permit and intro video.");
    expect(html).toContain('href="https://staging.creatrend.com/creator/profile"');
    expect(html).toContain("Review &amp; Update Profile");
  });

  it("should generate creator clarification email with prod FRONTEND_URL and handle trailing slash", () => {
    process.env.FRONTEND_URL = "https://creatrend.com/";

    const { targetUrl, html } = profileClarificationEmail(
      "John",
      "Video is not clear",
      "Creator"
    );

    expect(targetUrl).toBe("https://creatrend.com/creator/profile");
    expect(html).toContain('href="https://creatrend.com/creator/profile"');
  });

  it("should generate brand clarification email with brand profile link", () => {
    process.env.FRONTEND_URL = "https://staging.creatrend.com";

    const { subject, targetUrl, text, html } = profileClarificationEmail(
      "Acme Corp",
      "Upload proof of registration",
      "Brand"
    );

    expect(subject).toBe("Clarification required for your Brand Profile");
    expect(targetUrl).toBe("https://staging.creatrend.com/brand/profile");
    expect(text).toContain("https://staging.creatrend.com/brand/profile");
    expect(html).toContain('href="https://staging.creatrend.com/brand/profile"');
  });

  it("should respect custom actionUrl when provided", () => {
    process.env.FRONTEND_URL = "https://creatrend.com";

    const customUrl = "https://creatrend.com/custom/review/path";
    const { targetUrl, html, text } = profileClarificationEmail(
      "Jane",
      "Need documents",
      "Creator",
      customUrl
    );

    expect(targetUrl).toBe(customUrl);
    expect(text).toContain(customUrl);
    expect(html).toContain(`href="${customUrl}"`);
  });

  it("should fallback gracefully if FRONTEND_URL is not set", () => {
    delete process.env.FRONTEND_URL;

    const { targetUrl } = profileClarificationEmail(
      "Jane",
      "Need permit",
      "Creator"
    );

    expect(targetUrl).toBe("https://creatrend.co.za/creator/profile");
  });
});
