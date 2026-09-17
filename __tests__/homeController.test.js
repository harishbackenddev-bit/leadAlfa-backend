const { getHomepageCreatorVideos, toSlug } = require("../services/homeService");
const { getHomepageCreatorVideosController } = require("../controllers/homeController");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");

jest.mock("../models/creatorProfile/creatorProfile.model");

describe("Homepage Creator Videos API & Service", () => {
  let req, res;

  beforeEach(() => {
    req = { query: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("toSlug helper", () => {
    it("should convert category names into URL-friendly slugs", () => {
      expect(toSlug("Beauty & Cosmetics")).toBe("beauty-cosmetics");
      expect(toSlug("Apparel & Fashion")).toBe("apparel-fashion");
      expect(toSlug("Health & Wellness")).toBe("health-wellness");
      expect(toSlug("")).toBe("");
    });
  });

  describe("getHomepageCreatorVideos (Service)", () => {
    it("should bypass DB and return empty array when HOMEPAGE_REAL_CREATORS_ENABLED is false", async () => {
      process.env.HOMEPAGE_REAL_CREATORS_ENABLED = "false";
      
      const result = await getHomepageCreatorVideos();

      expect(CreatorProfile.findAll).not.toHaveBeenCalled();
      expect(result).toEqual([]);

      delete process.env.HOMEPAGE_REAL_CREATORS_ENABLED;
    });

    it("should return empty array when no real approved creators exist in DB", async () => {
      CreatorProfile.findAll.mockResolvedValue([]);

      const result = await getHomepageCreatorVideos();

      expect(result).toEqual([]);
    });

    it("should return exact count of real creators when fewer than 8 without adding fallbacks", async () => {
      const mockApprovedCreators = [
        {
          id: 101,
          publicName: "Jane Creator",
          city: "Cape Town",
          categories: [{ name: "Beauty & Cosmetics" }],
          mediaLinks: [
            {
              usageType: "intro_video",
              mediaDetails: { url: "https://cloudinary.com/intro101.mp4" },
            },
          ],
        },
        {
          id: 102,
          firstName: "John",
          lastName: "Doe",
          city: "Johannesburg",
          categories: [{ name: "Apparel & Fashion" }],
          mediaLinks: [
            {
              usageType: "intro_video",
              mediaDetails: { url: "https://cloudinary.com/intro102.mp4" },
            },
          ],
        },
      ];

      CreatorProfile.findAll.mockResolvedValue(mockApprovedCreators);

      const result = await getHomepageCreatorVideos();

      expect(result.length).toBe(2);
      expect(result[0].source).toBe("creator");
      expect(result[0].id).toBe("creator-101");
      expect(result[0].name).toBe("Jane Creator");
      expect(result[0].videoUrl).toBe("https://cloudinary.com/intro101.mp4");

      expect(result[1].source).toBe("creator");
      expect(result[1].id).toBe("creator-102");
      expect(result[1].name).toBe("John Doe");
    });

    it("should cap real creator videos at 8 maximum when more than 8 exist", async () => {
      const mockCreators = Array.from({ length: 10 }, (_, i) => ({
        id: 100 + i,
        publicName: `Creator ${i + 1}`,
        city: "Cape Town",
        categories: [{ name: "Beauty & Cosmetics" }],
        mediaLinks: [
          {
            usageType: "intro_video",
            mediaDetails: { url: `https://cloudinary.com/intro${100 + i}.mp4` },
          },
        ],
      }));

      CreatorProfile.findAll.mockResolvedValue(mockCreators);

      const result = await getHomepageCreatorVideos();

      expect(result.length).toBe(8);
      expect(result.every((item) => item.source === "creator")).toBe(true);
    });

    it("should filter real creators by category", async () => {
      const mockApprovedCreators = [
        {
          id: 201,
          publicName: "Beauty Queen",
          city: "Durban",
          categories: [{ name: "Beauty & Cosmetics" }],
          mediaLinks: [
            {
              usageType: "intro_video",
              mediaDetails: { url: "https://cloudinary.com/beauty201.mp4" },
            },
          ],
        },
      ];

      CreatorProfile.findAll.mockResolvedValue(mockApprovedCreators);

      const result = await getHomepageCreatorVideos("beauty-cosmetics");

      expect(result.length).toBe(1);
      expect(result[0].category).toBe("beauty-cosmetics");
      expect(result[0].id).toBe("creator-201");
    });

    describe("Location Refinement Tests", () => {
      it("should format location as 'City' only, excluding province and country", async () => {
        const mockCreators = [
          {
            id: 301,
            publicName: "Creator One",
            city: "Johannesburg",
            province: "Gauteng",
            country: "South Africa",
            categories: [{ name: "Apparel & Fashion" }],
            mediaLinks: [
              {
                usageType: "intro_video",
                mediaDetails: { url: "https://cloudinary.com/video301.mp4" },
              },
            ],
          },
        ];

        CreatorProfile.findAll.mockResolvedValue(mockCreators);
        const result = await getHomepageCreatorVideos();

        expect(result[0].location).toBe("Johannesburg");
        expect(result[0].location).not.toContain("Gauteng");
        expect(result[0].location).not.toContain("South Africa");
      });

      it("should return null for location when city is missing/null", async () => {
        const mockCreators = [
          {
            id: 303,
            publicName: "Creator Three",
            city: null,
            province: "Gauteng",
            categories: [{ name: "Apparel & Fashion" }],
            mediaLinks: [
              {
                usageType: "intro_video",
                mediaDetails: { url: "https://cloudinary.com/video303.mp4" },
              },
            ],
          },
        ];

        CreatorProfile.findAll.mockResolvedValue(mockCreators);
        const result = await getHomepageCreatorVideos();

        expect(result[0].location).toBeNull();
      });
    });

    describe("Profile Image Tests", () => {
      it("should return profileImage URL when creator has a profile_photo media link", async () => {
        const mockCreators = [
          {
            id: 401,
            publicName: "Photo Creator",
            city: "Cape Town",
            categories: [{ name: "Beauty & Cosmetics" }],
            mediaLinks: [
              {
                usageType: "intro_video",
                mediaDetails: { url: "https://cloudinary.com/intro401.mp4" },
              },
              {
                usageType: "profile_photo",
                mediaDetails: { url: "https://cloudinary.com/photo401.jpg" },
              },
            ],
          },
        ];

        CreatorProfile.findAll.mockResolvedValue(mockCreators);
        const result = await getHomepageCreatorVideos();

        expect(result[0].profileImage).toBe("https://cloudinary.com/photo401.jpg");
      });

      it("should return null for profileImage when creator has no profile_photo media link", async () => {
        const mockCreators = [
          {
            id: 402,
            publicName: "No Photo Creator",
            city: "Durban",
            categories: [{ name: "Fitness" }],
            mediaLinks: [
              {
                usageType: "intro_video",
                mediaDetails: { url: "https://cloudinary.com/intro402.mp4" },
              },
            ],
          },
        ];

        CreatorProfile.findAll.mockResolvedValue(mockCreators);
        const result = await getHomepageCreatorVideos();

        expect(result[0].profileImage).toBeNull();
      });
    });
  });

  describe("getHomepageCreatorVideosController", () => {
    it("should return HTTP 200 with success: true and data array", async () => {
      req.query = { category: "beauty-cosmetics" };
      CreatorProfile.findAll.mockResolvedValue([]);

      await getHomepageCreatorVideosController(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.any(Array),
        })
      );
    });
  });
});
