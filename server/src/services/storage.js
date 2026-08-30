import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { config } from '../config.js';

/**
 * Image storage for customer design-reference photos.
 *  - Cloudinary (recommended for Render/production — free tier, set CLOUDINARY_* vars)
 *  - Local disk (default — fine for local dev; Render's disk is ephemeral)
 */

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

export function ensureUploadDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export async function saveImage(buffer, originalName) {
  const ext = (path.extname(originalName || '').toLowerCase() || '.jpg').slice(0, 6);
  if (config.storage.useCloudinary) return uploadToCloudinary(buffer, originalName);

  ensureUploadDir();
  const name = crypto.randomBytes(16).toString('hex') + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}

async function uploadToCloudinary(buffer, originalName) {
  const { cloudName, apiKey, apiSecret, uploadPreset } = config.storage;
  const form = new FormData();
  form.append('file', new Blob([buffer]), originalName || 'design.jpg');

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
