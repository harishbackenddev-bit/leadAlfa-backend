jest.mock("uuid", () => ({ v4: () => "mock-uuid" }));

const { generateUploadSignature } = require("../services/uploadService");
const { registerUploadedMedia } = require("../services/mediaService");
const Media = require("../models/media/media.model");
const { sequelize } = require("../config/database");

jest.mock("../config/cloudinary.config", () => ({
  utils: {
    api_sign_request: jest.fn().mockReturnValue("mocked_signature"),
  },
}));

jest.mock("../config/database", () => ({
  sequelize: {
    transaction: jest.fn(),
    fn: jest.fn(),
    col: jest.fn(),
    define: jest.fn().mockReturnValue({
      associate: jest.fn(),
    }),
  },
  Op: { in: Symbol("in") },
}));

jest.mock("../models/media/media.model", () => ({
  create: jest.fn(),
}));

describe("Upload Service", () => {
  it("should generate signature for video in campaign_application folder", async () => {
    const ticket = await generateUploadSignature({
      resourceType: "video",
      uploadType: "campaign_application",
      userId: 1,
    });
    expect(ticket.folder).toBe("creatrend/media_assets/campaign_applications");
    expect(ticket.resourceType).toBe("video");
    expect(ticket.signature).toBe("mocked_signature");
    expect(ticket.use_filename).toBe(true);
    expect(ticket.unique_filename).toBe(true);
  });

  it("should generate signature for raw in work_submission folder", async () => {
    const ticket = await generateUploadSignature({
      resourceType: "raw",
      uploadType: "work_submission",
      userId: 1,
    });
    expect(ticket.folder).toBe("creatrend/media_assets/work_submissions");
    expect(ticket.resourceType).toBe("raw");
    expect(ticket.use_filename).toBe(true);
    expect(ticket.unique_filename).toBe(true);
  });

  it("should generate signature for portfolio_video in user-scoped creator_portfolio folder", async () => {
    const ticket = await generateUploadSignature({
      resourceType: "video",
      uploadType: "portfolio_video",
      userId: 1,
    });
    expect(ticket.folder).toBe("creatrend/media_assets/creator_portfolio/1");
    expect(ticket.resourceType).toBe("video");
    expect(ticket.signature).toBe("mocked_signature");
    expect(ticket.use_filename).toBe(true);
    expect(ticket.unique_filename).toBe(true);
  });

  it("should throw error for invalid resource type", async () => {
    await expect(
      generateUploadSignature({
        resourceType: "invalid",
        userId: 1,
      })
    ).rejects.toThrow("Invalid resourceType");
  });

  it("should throw error for invalid upload type", async () => {
    await expect(
      generateUploadSignature({
        resourceType: "raw",
        uploadType: "invalid",
        userId: 1,
      })
    ).rejects.toThrow("Invalid uploadType");
  });
});

describe("Media Service - registerUploadedMedia", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should register uploaded image inside campaign applications folder", async () => {
    Media.create.mockResolvedValue({ id: 50 });
    const result = await registerUploadedMedia({
      publicId: "creatrend/media_assets/campaign_applications/test_img",
      secureUrl: "https://cloudinary.com/test_img.jpg",
      resourceType: "image",
      originalName: "test_img.jpg",
      userId: 1,
    });

    expect(Media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "test_img.jpg",
        url: "https://cloudinary.com/test_img.jpg",
        type: "image",
        public_id: "creatrend/media_assets/campaign_applications/test_img",
        uploadedBy: 1,
      }),
      expect.any(Object)
    );
    expect(result.id).toBe(50);
  });

  it("should register ZIP raw file under work submissions folder as document", async () => {
    Media.create.mockResolvedValue({ id: 60 });
    const result = await registerUploadedMedia({
      publicId: "creatrend/media_assets/work_submissions/project",
      secureUrl: "https://cloudinary.com/project.zip",
      resourceType: "raw",
      originalName: "project.ZIP",
      bytes: 1024,
      userId: 1,
    });

    expect(Media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "project.ZIP",
        type: "document", // raw maps to document
      }),
      expect.any(Object)
    );
    expect(result.id).toBe(60);
  });

  it("should successfully register raw file if extension is in publicId but stripped in originalName", async () => {
    Media.create.mockResolvedValue({ id: 70 });
    const result = await registerUploadedMedia({
      publicId: "creatrend/media_assets/work_submissions/project.zip",
      secureUrl: "https://cloudinary.com/project.zip",
      resourceType: "raw",
      originalName: "project-stripped-extension", // no extension!
      bytes: 1024,
      userId: 1,
    });

    expect(Media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "project-stripped-extension",
        type: "document",
      }),
      expect.any(Object)
    );
    expect(result.id).toBe(70);
  });

  it("should reject publicId outside allowed folders", async () => {
    await expect(
      registerUploadedMedia({
        publicId: "unauthorized_folder/image",
        secureUrl: "https://cloudinary.com/image.jpg",
        resourceType: "image",
        originalName: "image.jpg",
        userId: 1,
      })
    ).rejects.toThrow("Invalid public_id: asset must reside in one of the allowed folders");
  });

  it("should reject raw file without ZIP extension", async () => {
    await expect(
      registerUploadedMedia({
        publicId: "creatrend/media_assets/work_submissions/malicious",
        secureUrl: "https://cloudinary.com/malicious.exe",
        resourceType: "raw",
        originalName: "malicious.exe",
        userId: 1,
      })
    ).rejects.toThrow("Invalid file extension: Only ZIP archives are allowed for raw uploads");
  });

  it("should reject raw file exceeding 200MB size limit", async () => {
    await expect(
      registerUploadedMedia({
        publicId: "creatrend/media_assets/work_submissions/huge",
        secureUrl: "https://cloudinary.com/huge.zip",
        resourceType: "raw",
        originalName: "huge.zip",
        bytes: 201 * 1024 * 1024, // 201MB
        userId: 1,
      })
    ).rejects.toThrow("File size exceeds the maximum limit of 200MB");
  });
});
