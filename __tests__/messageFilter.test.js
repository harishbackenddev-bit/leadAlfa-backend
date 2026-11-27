const { containsDisallowedContent } = require("../utils/messageFilter");

describe("Message Filter Utility", () => {
  test("should block standard email addresses", () => {
    expect(
      containsDisallowedContent("Contact me at user@gmail.com please.")
    ).toBe(true);
  });

  test("should block common phone number formats", () => {
    expect(
      containsDisallowedContent("Call me at 1-555-123-4567 or (555) 123-4567.")
    ).toBe(true);
  });

  test('should block social media handles and domains', () => {
    expect(containsDisallowedContent("Check my portfolio on linkedin.com/in/myname")).toBe(true);
    expect(containsDisallowedContent("My handle is @creative_creator")).toBe(true);
  });

  test('should allow normal text without contact info', () => {
    expect(containsDisallowedContent("The next step is to finalize the project scope.")).toBe(false);
  });

  test('should allow numbers that are not phone numbers', () => {
    expect(containsDisallowedContent("The budget is 5000 dollars.")).toBe(false);
  });
});
