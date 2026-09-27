import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import sharp from 'sharp';
import { config } from '../config.js';

/**
 * Image storage for product and design-reference photos.
 *  - Cloudinary (recommended for Render/production — free tier, set CLOUDINARY_* vars)
 *  - Local disk (default — fine for local dev; Render's disk is ephemeral)
 *
 * Every image is re-encoded through sharp before it is stored, whatever the destination:
 *
 *  - Phone photos work. A modern phone shoots 8–24 MB photos and the old 5 MB cap
 *    quietly rejected them — the single most likely reason an uploaded product photo
 *    never appeared. Now anything up to 20 MB is accepted and reduced to ~150–400 KB.
 *  - Photos taken in portrait arrive with their orientation in EXIF metadata; `rotate()`
 *    bakes that in so they never display sideways.
 *  - Anything a browser cannot display (HEIC clips, exotic formats) is either converted
 *    or rejected with a message that says what to do, instead of uploading "successfully"
 *    and then rendering as a broken image.
 *  - Nothing is stored byte-for-byte as uploaded: SVG scripts and payload tricks are
 *    neutralised because only re-encoded pixels are ever written to disk.
 */

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// Menu cards show photos ~150 px tall and the product page ~600 px wide; 1800 px covers
// both on a high-DPI phone without storing the camera's original 4000 px.
const MAX_DIMENSION = 1800;

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Returns { buffer, ext } — pixels safe to store and serve, whatever came in.
 * Throws an Error with a customer-facing message for formats that cannot be used.
 */
async function processImage(buffer) {
  // One message covers both a corrupt file and a format sharp cannot decode (HEIC
  // clips and the like): it says what to do instead of failing with jargon.
  const unreadable = () =>
    new Error('That file is not a photo this site can use — please choose a JPG, PNG or WebP image.');

  // Decoding matches what a browser does: browsers ignore recoverable PNG glitches
  // (bad CRCs are common in photos that survived a bad Bluetooth or WhatsApp
  // transfer), so a photo that displays on the customer's phone is accepted here.
  // This is safe because nothing is stored as-decoded: everything below is re-encoded
  // from the pixels, which also strips any payload the file carried.
  let meta;
  try {
    meta = await sharp(buffer, { failOn: 'none' }).metadata();
  } catch {
    throw unreadable();
  }

  const pipeline = sharp(buffer, { failOn: 'none' })
    .rotate() // bake in EXIF orientation so portrait photos are not sideways
    .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true });

  try {
    // Flat photos become JPEG (small); images with transparency stay PNG.
    if (meta.hasAlpha) {
      return { buffer: await pipeline.png({ compressionLevel: 9, palette: true }).toBuffer(), ext: '.png' };
    }
    return { buffer: await pipeline.jpeg({ quality: 82, mozjpeg: true }).toBuffer(), ext: '.jpg' };
  } catch {
    // sharp decodes JPEG, PNG, WebP, GIF, TIFF, AVIF and SVG. HEIC (iPhone clips) is not
    // in that list — browsers cannot show it either, so it is refused with instructions
    // rather than accepted and then displaying as nothing.
    throw unreadable();
  }
}

export async function saveImage(buffer, originalName) {
  const { buffer: pixels, ext } = await processImage(buffer);
  if (config.storage.useCloudinary) return uploadToCloudinary(pixels, originalName, ext);

  ensureUploadDir();
  const name = crypto.randomBytes(16).toString('hex') + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), pixels);
  return `/uploads/${name}`;
}

async function uploadToCloudinary(buffer, originalName, ext) {
  const { cloudName, apiKey, apiSecret, uploadPreset } = config.storage;
  const form = new FormData();
  form.append('file', new Blob([buffer]), (path.parse(originalName || 'photo').name || 'photo') + ext);

  if (uploadPreset) {
    form.append('upload_preset', uploadPreset);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
    const data = await res.json();
    if (!res.ok || !data.secure_url) throw new Error(data?.error?.message || 'Cloudinary upload failed');
    return data.secure_url;
  }

  // Signed upload (no preset required)
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { timestamp };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (!res.ok || !data.secure_url) throw new Error(data?.error?.message || 'Cloudinary upload failed');
  return data.secure_url;
}
