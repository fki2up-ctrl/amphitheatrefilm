// ---------------------------------------------------------------------------
// Cloudinary — unsigned direct-from-browser image upload.
//
// Relies on:
//   VITE_CLOUDINARY_CLOUD_NAME    (e.g. "dxxxxx")
//   VITE_CLOUDINARY_UPLOAD_PRESET (must be set to "Unsigned" in Cloudinary)
//
// Cloudinary docs:
//   https://cloudinary.com/documentation/upload_images#unsigned_upload
// ---------------------------------------------------------------------------

import axios from 'axios';

const CLOUD  = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

export const hasCloudinary = Boolean(CLOUD && PRESET);

// Max client-side image size — Cloudinary free tier rejects >10 MB anyway.
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload an image File to Cloudinary via the unsigned upload endpoint.
 *
 * @param {File} file — user-selected image (any MIME Cloudinary accepts)
 * @param {(pct:number)=>void} onProgress — called with 0–100
 * @returns {Promise<{ url: string, publicId: string, width: number, height: number, bytes: number }>}
 */
export async function uploadImageToCloudinary(file, onProgress = () => {}) {
  if (!hasCloudinary) {
    throw new Error(
      'Cloudinary is not configured. Set VITE_CLOUDINARY_CLOUD_NAME and ' +
      'VITE_CLOUDINARY_UPLOAD_PRESET in your environment.'
    );
  }
  if (!file) throw new Error('No file selected.');
  if (file.size > MAX_BYTES) {
    throw new Error(`Image too large (${(file.size / 1e6).toFixed(1)} MB). Max 10 MB.`);
  }

  const form = new FormData();
  form.append('file', file);
  form.append('upload_preset', PRESET);

  const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`;

  const { data } = await axios.post(endpoint, form, {
    onUploadProgress: (evt) => {
      if (!evt.total) return;
      onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });

  // Cloudinary returns secure_url, public_id, width, height, bytes, etc.
  return {
    url:      data.secure_url,
    publicId: data.public_id,
    width:    data.width,
    height:   data.height,
    bytes:    data.bytes,
    format:   data.format,
  };
}
