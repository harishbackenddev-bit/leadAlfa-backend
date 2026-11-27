const slugify = require("slugify");
const CreatorProfile = require("../models/creatorProfile/creatorProfile.model");
const CreatorMedia = require("../models/creatorProfile/creatorMedia.model");
const Media = require("../models/media/media.model");
const Category = require("../models/creatorProfile/category.model");
const { CREATOR_MEDIA_TYPES } = require("../config/mediaUsageTypes");


function toSlug(text) {
  if (!text) return "";
  return slugify(String(text).trim(), { lower: true, strict: true })
    .replace(/-and-/g, "-");
}


async function getHomepageCreatorVideos(categoryQuery) {
  let targetCategorySlug = null;
  let targetCategoryId = null;

  if (categoryQuery) {
    const rawQuery = String(categoryQuery).trim();
    if (/^\d+$/.test(rawQuery)) {
      targetCategoryId = parseInt(rawQuery, 10);
      const catRecord = await Category.findByPk(targetCategoryId);
      if (catRecord) {
        targetCategorySlug = toSlug(catRecord.name);
      }
    } else {
      targetCategorySlug = toSlug(rawQuery);
    }
  }

  const realCreatorsEnabled = process.env.HOMEPAGE_REAL_CREATORS_ENABLED !== "false";
  let approvedCreators = [];

  if (realCreatorsEnabled) {
    approvedCreators = await CreatorProfile.findAll({
      where: {
        status: "approved",
        isDeleted: false,
      },
      include: [
        {
          model: CreatorMedia,
          as: "mediaLinks",
          required: false,
          include: [
            {
              model: Media,
              as: "mediaDetails",
              required: true,
            },
          ],
        },
        {
          model: Category,
          as: "categories",
          through: { attributes: [] },
        },
      ],
      order: [["createdAt", "DESC"]],
    });
  }

  const realCreatorVideos = [];

  const { buildUrl } = require("../utils/mediaDelivery");

  for (const profile of approvedCreators) {
    const introVideoMedia = profile.mediaLinks?.find(
      (m) => m.usageType === CREATOR_MEDIA_TYPES.INTRO_VIDEO
    )?.mediaDetails;
    const videoUrl = buildUrl(introVideoMedia);
    if (!videoUrl) continue;

    const profilePhotoMedia = profile.mediaLinks?.find(
      (m) => m.usageType === CREATOR_MEDIA_TYPES.PROFILE_PHOTO
    )?.mediaDetails;
    const profileImage = buildUrl(profilePhotoMedia);

    const categories = profile.categories || [];
    let matchedCategory = null;

    if (targetCategorySlug || targetCategoryId) {
      matchedCategory = categories.find((cat) => {
        if (targetCategoryId && cat.id === targetCategoryId) return true;
        const catSlug = toSlug(cat.name);
        return catSlug === targetCategorySlug;
      });

      if (!matchedCategory) continue;
    } else {
      matchedCategory = categories[0] || null;
    }

    const locationStr =
      profile.city && String(profile.city).trim() ? String(profile.city).trim() : null;
    const displayName = profile.publicName || `${profile.firstName || ""} ${profile.lastName || ""}`.trim() || `Creator ${profile.id}`;

    realCreatorVideos.push({
      id: `creator-${profile.id}`,
      videoUrl: videoUrl,
      name: displayName,
      location: locationStr,
      profileImage: profileImage,
      category: matchedCategory ? toSlug(matchedCategory.name) : "",
      source: "creator",
    });
  }

  return realCreatorVideos.slice(0, 8);
}

module.exports = {
  getHomepageCreatorVideos,
  toSlug,
};
