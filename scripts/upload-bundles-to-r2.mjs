#!/usr/bin/env node
/**
 * upload-bundles-to-r2.mjs
 * 
 * Uploads all game.bundle.js files from gametok-games/ to Cloudflare R2.
 * Uses the same S3-compatible API credentials as the backend.
 * 
 * Required env vars (set them or create a .env):
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 * 
 * Usage:
 *   R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx R2_BUCKET_NAME=xxx node scripts/upload-bundles-to-r2.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GAMES_DIR = path.resolve(__dirname, '../../gametok-games');

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET_NAME = process.env.R2_BUCKET_NAME;

if (!ACCOUNT_ID || !ACCESS_KEY_ID || !SECRET_ACCESS_KEY || !BUCKET_NAME) {
  console.error('Missing required env vars. Need: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME');
  console.error('');
  console.error('Usage:');
  console.error('  R2_ACCOUNT_ID=xxx R2_ACCESS_KEY_ID=xxx R2_SECRET_ACCESS_KEY=xxx R2_BUCKET_NAME=xxx node scripts/upload-bundles-to-r2.mjs');
  process.exit(1);
}

const R2_ENDPOINT = `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`;

// We use the S3 API directly with fetch + AWS Signature V4
// But for simplicity, let's use @aws-sdk/client-s3 which is already in gametok-backend
async function main() {
  let S3Client, PutObjectCommand;
  try {
    const s3mod = await import('@aws-sdk/client-s3');
    S3Client = s3mod.S3Client;
    PutObjectCommand = s3mod.PutObjectCommand;
  } catch {
    console.error('@aws-sdk/client-s3 not found. Install it or run from gametok-backend:');
    console.error('  npm install @aws-sdk/client-s3');
    process.exit(1);
  }

  const s3 = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: ACCESS_KEY_ID,
      secretAccessKey: SECRET_ACCESS_KEY,
    },
  });

  const entries = fs.readdirSync(GAMES_DIR, { withFileTypes: true });
  const SKIP = new Set(['node_modules', 'report', 'scripts', 'support', 'thumbnails', 'openpigeon-games', 'game', 'icons', 'loops-games']);
  
  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
    
    const bundlePath = path.join(GAMES_DIR, entry.name, 'game.bundle.js');
    if (!fs.existsSync(bundlePath)) {
      console.log(`  [SKIP] ${entry.name} — no game.bundle.js`);
      skipped++;
      continue;
    }

    const fileContent = fs.readFileSync(bundlePath);
    const key = `${entry.name}/game.bundle.js`;

    try {
      await s3.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: fileContent,
        ContentType: 'application/javascript',
      }));
      console.log(`  ✅ ${key} (${fileContent.length} bytes)`);
      uploaded++;
    } catch (err) {
      console.error(`  ❌ ${key}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n========================================`);
  console.log(`Upload complete: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed`);
  console.log(`Public base: https://pub-b7694276c8f54290854b276638a93b62.r2.dev/<gameId>/game.bundle.js`);
  process.exit(0);
}

main();
