#!/usr/bin/env node
/**
 * Moves chat attachments that were saved on the server's disk (server/uploads/...)
 * to Cloudinary, and repoints the messages that reference them.
 *
 *   node scripts/migrate-local-uploads-to-cloudinary.cjs            # preview only (no changes)
 *   node scripts/migrate-local-uploads-to-cloudinary.cjs --apply    # upload + update messages
 *
 * - Uses CLOUDINARY_* and the CLOUDINARY_UPLOAD_PRESET_* names from server/.env
 *   (a preset Cloudinary doesn't have is skipped, like the upload controller does).
 * - Updates Message.mediaUrl / Message.fileUrl values ending in /uploads/<folder>/<file>.
 * - Never deletes local files; delete server/uploads yourself after checking the app.
 */
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const { Client } = require('pg');
const { v2: cloudinary } = require('cloudinary');

const APPLY = process.argv.includes('--apply');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

/** Local sub-folder → Cloudinary settings (same as upload.controller.ts) */
const TARGETS = {
  images: { resource_type: 'image', folder: 'lingoverse_chat_images', presetEnv: 'CLOUDINARY_UPLOAD_PRESET_IMAGE' },
  audio: { resource_type: 'video', folder: 'lingoverse_voice_messages', presetEnv: 'CLOUDINARY_UPLOAD_PRESET_VOICE' },
  videos: { resource_type: 'video', folder: 'lingoverse_chat_videos', presetEnv: 'CLOUDINARY_UPLOAD_PRESET_VIDEO' },
  files: { resource_type: 'raw', folder: 'lingoverse_chat_files', presetEnv: 'CLOUDINARY_UPLOAD_PRESET_FILE', use_filename: true },
  avatars: { resource_type: 'image', folder: 'lingoverse_user_avatars', presetEnv: 'CLOUDINARY_UPLOAD_PRESET_AVATAR' },
};

async function upload(filePath, target) {
  const { presetEnv, ...options } = target;
  const preset = process.env[presetEnv];
  try {
    return await cloudinary.uploader.upload(filePath, preset ? { ...options, upload_preset: preset } : options);
  } catch (error) {
    const message = error?.message || error?.error?.message || '';
    if (!preset || !/preset/i.test(message)) throw error;
    return cloudinary.uploader.upload(filePath, options); // preset missing in Cloudinary
  }
}

(async () => {
  const { CLOUDINARY_CLOUD_NAME: name, CLOUDINARY_API_KEY: key, CLOUDINARY_API_SECRET: secret, DATABASE_URL } = process.env;
  if (!name || !key || !secret || !DATABASE_URL) {
    throw new Error('CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and DATABASE_URL must be set in server/.env');
  }
  cloudinary.config({ cloud_name: name, api_key: key, api_secret: secret });

  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();

  console.log(APPLY ? '🚚 Moving local uploads to Cloudinary…\n' : '👀 Preview (no changes). Run with --apply to migrate.\n');

  let moved = 0, unreferenced = 0, failed = 0, rowsUpdated = 0;

  for (const [sub, target] of Object.entries(TARGETS)) {
    const dir = path.join(UPLOADS_DIR, sub);
    if (!fs.existsSync(dir)) continue;

    for (const name of fs.readdirSync(dir)) {
      const filePath = path.join(dir, name);
      if (!fs.statSync(filePath).isFile()) continue;

      const suffix = `/uploads/${sub}/${name}`;
      const refs = await db.query(
        `SELECT count(*)::int AS n FROM "Message" WHERE "mediaUrl" LIKE $1 OR "fileUrl" LIKE $1`,
        [`%${suffix}`],
      );
      const count = refs.rows[0].n;
      if (!count) {
        unreferenced++;
        console.log(`  · ${suffix} — not used by any message (left alone)`);
        continue;
      }

      if (!APPLY) {
        console.log(`  → ${suffix} — ${count} message reference(s) → Cloudinary "${target.folder}"`);
        moved++;
        continue;
      }

      try {
        const result = await upload(filePath, target);
        const update = await db.query(
          `UPDATE "Message"
              SET "mediaUrl" = CASE WHEN "mediaUrl" LIKE $1 THEN $2 ELSE "mediaUrl" END,
                  "fileUrl"  = CASE WHEN "fileUrl"  LIKE $1 THEN $2 ELSE "fileUrl"  END
            WHERE "mediaUrl" LIKE $1 OR "fileUrl" LIKE $1`,
          [`%${suffix}`, result.secure_url],
        );
        rowsUpdated += update.rowCount;
        moved++;
        console.log(`  ✅ ${suffix} → ${result.secure_url} (${update.rowCount} message(s))`);
      } catch (error) {
        failed++;
        console.log(`  ❌ ${suffix} — ${error?.message || error?.error?.message || error}`);
      }
    }
  }

  await db.end();
  console.log(
    `\n${APPLY ? 'Moved' : 'Would move'}: ${moved}  ·  messages updated: ${rowsUpdated}  ·  unused files: ${unreferenced}  ·  failed: ${failed}`,
  );
  if (failed && APPLY) {
    console.log('Some uploads failed — fix the cause (e.g. API key upload permission) and run again; finished files are skipped automatically.');
  }
})().catch((error) => {
  console.error('Migration stopped:', error.message);
  process.exit(1);
});
