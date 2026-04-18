/* ============================================================================
 * Cloudinary URL helpers — framework-free, pure functions.
 *
 * A Cloudinary delivery URL looks like:
 *   https://res.cloudinary.com/<cloud>/image/upload/<transforms>/<version>/<public_id>.<ext>
 *
 * `<transforms>` is an optional, comma-separated, slash-delimited chain of
 * transformation segments. `<version>` is optional and looks like `v1234567890`.
 *
 * This module exposes two helpers:
 *
 *   optimizeCloudinaryUrl(url, width)     → delivery URL with our transforms
 *                                           injected, preserving any existing
 *                                           transforms the caller had.
 *
 *   cloudinaryPlaceholderUrl(url, width)  → a tiny, heavily-blurred URL for
 *                                           LQIP blur-up placeholders.
 *
 * Both return the input unchanged when it isn't a recognisable Cloudinary URL,
 * so callers can pipe arbitrary `<img src>` values through safely.
 * ========================================================================== */

const CLOUDINARY_HOST_RE = /^https?:\/\/res\.cloudinary\.com\//i;
const UPLOAD_MARKER      = '/upload/';

/**
 * Quick structural check — is this URL delivered via Cloudinary's /upload/
 * endpoint? (Excludes /fetch/, /private/, etc. since those take different
 * shapes and we don't currently support them.)
 */
export function isCloudinaryUrl(url) {
  return (
    typeof url === 'string' &&
    CLOUDINARY_HOST_RE.test(url) &&
    url.includes(UPLOAD_MARKER)
  );
}

/**
 * Heuristic: does `segment` look like a Cloudinary transform chain
 * (e.g. "w_800,c_fill,q_80") rather than a version ("v1234") or a filename?
 * Transforms contain `letter_value` pairs and never start with `v\d+`.
 */
function looksLikeTransformSegment(segment) {
  if (!segment) return false;
  if (/^v\d+$/.test(segment)) return false;       // version marker
  if (segment.includes('.'))  return false;       // filename
  // Must contain at least one `x_y` pair.
  return /[a-z]_[^,/]+/i.test(segment);
}

/**
 * Inject `f_auto,q_auto,w_{width}` transforms into a Cloudinary /upload/ URL.
 *
 * - Gracefully returns the original string if `rawUrl` isn't a valid Cloudinary
 *   delivery URL, so this is safe to wrap around *any* `src`.
 * - If the URL already carries a transform chain, our transforms are appended
 *   to that same chain (later transforms override earlier ones on Cloudinary,
 *   so our f_auto/q_auto wins over a stale q_80 etc.).
 * - `width` is coerced to a positive integer; falls back to 1200 on garbage.
 */
export function optimizeCloudinaryUrl(rawUrl, width = 1200) {
  if (!isCloudinaryUrl(rawUrl)) return rawUrl;

  const w = Math.max(1, Math.round(Number(width)) || 1200);
  const ourTransform = `f_auto,q_auto,w_${w}`;

  const markerIdx = rawUrl.indexOf(UPLOAD_MARKER);
  const head      = rawUrl.slice(0, markerIdx + UPLOAD_MARKER.length);
  const tail      = rawUrl.slice(markerIdx + UPLOAD_MARKER.length);

  // Inspect the first path segment after /upload/ to decide whether to merge
  // with an existing transform chain or prepend a fresh one.
  const firstSlash = tail.indexOf('/');
  if (firstSlash === -1) {
    // Just a bare public_id after /upload/ — prepend our transform.
    return `${head}${ourTransform}/${tail}`;
  }

  const first = tail.slice(0, firstSlash);
  const rest  = tail.slice(firstSlash + 1);

  if (looksLikeTransformSegment(first)) {
    // Merge: existing,ours (ours wins on collision).
    return `${head}${first},${ourTransform}/${rest}`;
  }

  // Version marker or filename — just prepend.
  return `${head}${ourTransform}/${tail}`;
}

/**
 * Generate a tiny, heavily-blurred placeholder URL for the LQIP ("blur-up")
 * technique. Roughly 1–3 KB per image, safe to ship inline as a background.
 */
export function cloudinaryPlaceholderUrl(rawUrl, width = 50) {
  if (!isCloudinaryUrl(rawUrl)) return '';

  const w = Math.max(10, Math.round(Number(width)) || 50);
  const placeholder = `w_${w},e_blur:1000,q_auto,f_auto`;

  const markerIdx = rawUrl.indexOf(UPLOAD_MARKER);
  const head      = rawUrl.slice(0, markerIdx + UPLOAD_MARKER.length);
  const tail      = rawUrl.slice(markerIdx + UPLOAD_MARKER.length);

  const firstSlash = tail.indexOf('/');
  if (firstSlash === -1) return `${head}${placeholder}/${tail}`;

  const first = tail.slice(0, firstSlash);
  const rest  = tail.slice(firstSlash + 1);

  if (looksLikeTransformSegment(first)) {
    return `${head}${first},${placeholder}/${rest}`;
  }
  return `${head}${placeholder}/${tail}`;
}
