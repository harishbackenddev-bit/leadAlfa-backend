"use strict";

/**
 * mediaDelivery.js
 *
 * Central media delivery abstraction. All services must use this module to
 * generate delivery URLs — never construct ImageKit or Cloudinary URLs inline.
 *
 * Architecture:
 *   provider = "cloudinary" → return media.url directly (already a CDN URL stored in DB)
 *   provider = "s3"         → construct ImageKit URL from IMAGEKIT_URL_ENDPOINT + storageKey
 *                             (DB url field is empty for S3 records; URL is computed at read time)
 *
 */

/**
 * Build the delivery URL for a media record.
 *
 * @param {object} media - Media DB record (plain object or Sequelize instance)
 * @param {object} [transformations] - Reserved for Phase 3. Currently unused.
 * @returns {string|null}
 */
function buildUrl(media, transformations = {}) {
  if (!media) return null;

  if (media.provider === "cloudinary") {
    return media.url || null;
  }

  if (media.provider === "s3") {
    if (!media.storageKey) return null;

    const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;
    if (!endpoint) {
      throw new Error(
        "IMAGEKIT_URL_ENDPOINT is not configured. Cannot build delivery URL for S3 media."
      );
    }

    const normalizedEndpoint = endpoint.replace(/\/$/, "");
    return `${normalizedEndpoint}/${media.storageKey}`;
  }

  return media.url || null;
}

/**
 * Enrich a media record so `url` reflects the actual delivery URL.
 *
 * Accepts both plain objects and Sequelize model instances (calls .toJSON() if available).
 * Returns a plain object with `url` replaced by buildUrl(media).
 *
 * This is the primary serialization helper used in all service response formatters.
 *
 * @param {object|null} media - Media DB record or null
 * @returns {object|null}
 */
function enrichMediaRecord(media) {
  if (!media) return null;
  const plain = typeof media.toJSON === "function" ? media.toJSON() : { ...media };
  return {
    ...plain,
    url: buildUrl(plain),
  };
}

/**
 * Enrich a link-table row (e.g., CreatorMedia, BrandMedia) by enriching its
 * nested mediaDetails sub-object.
 *
 * Services receive link objects like:
 *   { id, usageType, mediaDetails: { id, url, type, ... } }
 *
 * This helper replaces the `url` inside `mediaDetails` with the delivery URL
 * while leaving the rest of the link object intact.
 *
 * @param {object|null} linkObj - Link table row (already plain JSON)
 * @returns {object|null}
 */
function enrichLinkRecord(linkObj) {
  if (!linkObj) return null;
  if (!linkObj.mediaDetails) return linkObj;
  return {
    ...linkObj,
    mediaDetails: enrichMediaRecord(linkObj.mediaDetails),
  };
}

module.exports = { buildUrl, enrichMediaRecord, enrichLinkRecord };
