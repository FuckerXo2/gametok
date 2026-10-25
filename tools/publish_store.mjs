// Uploads the TokBux store page (web/store/) to R2 web-games/store/, where the app opens it
// (src/components/TokBuxSheet.tsx, STORE_HOST in src/avatar/host.ts). Uses the GameTok backend's R2 keys, like
// games/avatar-editor/tools/publish_stage.mjs.
//   node tools/publish_store.mjs        lists what would go up
//   node tools/publish_store.mjs --go   uploads it
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DIR = path.join(ROOT, 'web/store');
const list = fs.readdirSync(DIR).filter((f) => f !== '.DS_Store');
const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png' };
const PREFIX = 'web-games/store';

if (!process.argv.includes('--go')) {
  console.log(`would upload to ${PREFIX}/:`);
  for (const f of list) console.log(`  ${f}  ${(fs.statSync(path.join(DIR, f)).size / 1024).toFixed(0)} KB`);
  process.exit(0);
}
const BACKEND = path.join(ROOT, '../gametok-backend');
const req = createRequire(path.join(BACKEND, 'package.json'));
req('dotenv').config({ path: path.join(BACKEND, '.env') });
const { S3Client, PutObjectCommand } = req('@aws-sdk/client-s3');
const s3 = new S3Client({ region: 'auto', endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
// the page last, always fresh (a change shows on the next open); the picture for a day
for (const f of [...list.filter((x) => !x.endsWith('.html')), ...list.filter((x) => x.endsWith('.html'))]) {
  const raw = fs.readFileSync(path.join(DIR, f)), html = f.endsWith('.html');
  await s3.send(new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: `${PREFIX}/${f}`, Body: html ? zlib.gzipSync(raw, { level: 9 }) : raw,
    ContentType: TYPES[path.extname(f)] || 'application/octet-stream', ContentEncoding: html ? 'gzip' : undefined,
    CacheControl: html ? 'no-cache, max-age=0' : 'public, max-age=86400' }));
}
console.log(`uploaded ${list.length} files -> ${process.env.R2_PUBLIC_URL}/${PREFIX}/tokbux.html`);
