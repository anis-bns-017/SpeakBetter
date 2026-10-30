import { Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

const logger = new Logger('CloudinaryAssets');

/** UploadController configures the SDK at startup; this covers code paths that run first */
function ensureConfigured(): boolean {
  if (cloudinary.config().api_secret) return true;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) return false;
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
  });
  return true;
}

/**
 * https://res.cloudinary.com/<cloud>/<image|video|raw>/upload/[transforms/]v123/<public_id>[.ext]
 * Image/video public ids exclude the extension; raw ones include it.
 */
export function parseCloudinaryUrl(url: string): { resourceType: string; publicId: string } | null {
  const match = /^https?:\/\/res\.cloudinary\.com\/[^/]+\/(image|video|raw)\/upload\/(?:[^?#]*?\/)?v\d+\/([^?#]+)$/.exec(url);
  if (!match) return null;
  const resourceType = match[1];
  let publicId = decodeURIComponent(match[2]);
  if (resourceType !== 'raw') publicId = publicId.replace(/\.[a-z0-9]+$/i, '');
  return { resourceType, publicId };
}

/** Best effort: deletes an uploaded file (view-once media, expired messages) */
export async function destroyCloudinaryUrl(url?: string | null): Promise<void> {
  if (!url) return;
  const parsed = parseCloudinaryUrl(url);
  if (!parsed || !ensureConfigured()) return;
  try {
    await cloudinary.uploader.destroy(parsed.publicId, {
      resource_type: parsed.resourceType,
      invalidate: true,
    });
  } catch (error: any) {
    logger.warn(`Could not delete ${parsed.publicId}: ${error?.message || error}`);
  }
}
