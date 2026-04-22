// ---------------------------------------------------------------------------
// Backblaze B2 — secure client-side video upload.
//
// Flow:
//   1. Client calls the `get-b2-upload-url` Supabase Edge Function (requires
//      an authenticated session — only editor users can mint upload URLs).
//   2. Edge fn authenticates with B2 using the server-side key, requests a
//      one-shot upload URL + token, and returns them to the client.
//   3. Client POSTs the raw file directly to B2 with progress tracking via
//      axios' `onUploadProgress`.
//   4. On success the final public URL is constructed from
//      `B2_PUBLIC_BASE_URL` (the Cloudflare CNAME, e.g. video.example.com).
// ---------------------------------------------------------------------------

import axios from 'axios';
import { supabase, hasSupabase } from './supabase';

// 5 GB — B2's single-upload cap is actually 5 GB too, so match it.
const MAX_BYTES = 5 * 1024 * 1024 * 1024;

// Sanitize for B2 file keys (no leading slash, preserve dots/dashes).
function sanitizeFileName(name) {
  return name
    .replace(/^\/+/, '')
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9._\-\/]/g, '');
}

/**
 * Request a presigned S3 PUT URL from the Supabase Edge Function.
 * @param {string} fileName
 * @param {string} contentType
 */
async function requestUploadUrl(fileName, contentType) {
  if (!hasSupabase) {
    throw new Error('Supabase not configured — cannot reach Edge Function.');
  }
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('Sign in to upload videos.');

  const { data, error } = await supabase.functions.invoke('get-b2-upload-url', {
    body: { fileName, contentType },
  });
  if (error) throw new Error(error.message || 'Edge function failed.');
  if (!data?.uploadUrl) {
    throw new Error('Edge function returned invalid credentials.');
  }
  return data; // { uploadUrl, filePath, publicUrl, contentType }
}

/**
 * Upload a video file to Backblaze B2 via its S3-compatible presigned URL.
 *
 * @param {File} file
 * @param {(pct:number)=>void} onProgress
 * @returns {Promise<{ url: string, filePath: string, bytes: number, contentType: string }>}
 */
export async function uploadVideoToB2(file, onProgress = () => {}) {
  if (!file) throw new Error('No file selected.');
  if (file.size > MAX_BYTES) {
    throw new Error(`Video too large (${(file.size / 1e9).toFixed(2)} GB). Max 5 GB.`);
  }

  // Normalize content-type — the task spec says force video/mp4 when possible
  // so browsers stream cleanly. Fall back to the browser's detected type.
  const contentType =
    file.type && file.type.startsWith('video/')
      ? file.type
      : 'video/mp4';

  const safeName = sanitizeFileName(file.name || `upload-${Date.now()}.mp4`);
  const creds    = await requestUploadUrl(safeName, contentType);

  // S3 presigned PUT — URL carries all auth via query params. Only the
  // Content-Type header must match what was signed server-side.
  await axios.put(creds.uploadUrl, file, {
    headers: { 'Content-Type': contentType },
    onUploadProgress: (evt) => {
      if (!evt.total) return;
      onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
    timeout:          0,
    maxContentLength: Infinity,
    maxBodyLength:    Infinity,
  });

  return {
    url:        creds.publicUrl,
    filePath:   creds.filePath,
    bytes:      file.size,
    contentType,
  };
}
