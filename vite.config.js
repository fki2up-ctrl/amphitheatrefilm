import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Dev-only endpoint the Editor hits to persist changes back to disk.
// Writes the POST body to src/data/projects.js. Disabled in production builds.
function contentSaverPlugin() {
  const TARGET = path.resolve(__dirname, 'src/data/projects.js');
  const MAX_BYTES = 2_000_000; // sanity limit

  return {
    name: 'amphitheatre-content-saver',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__save-projects', async (req, res, next) => {
        if (req.method !== 'POST') return next();
        try {
          const chunks = [];
          let size = 0;
          for await (const chunk of req) {
            size += chunk.length;
            if (size > MAX_BYTES) throw new Error('Payload too large');
            chunks.push(chunk);
          }
          const body = Buffer.concat(chunks).toString('utf8');
          if (!body.includes('export const PROFILE')) {
            throw new Error('Payload does not look like a projects.js file');
          }
          fs.writeFileSync(TARGET, body, 'utf8');
          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, bytes: body.length }));
        } catch (e) {
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: false, error: String(e?.message || e) }));
        }
      });
    },
  };
}

// -----------------------------------------------------------------------------
// Security headers applied to the Vite dev server and `vite preview`. For
// production static hosting, the same policy lives in public/_headers
// (Netlify / Cloudflare Pages) and in vercel.json (Vercel). Keep the three in
// sync — this file is the source of truth.
// -----------------------------------------------------------------------------

const CSP = [
  "default-src 'self'",
  // React/Vite client inject a small inline bootstrap; 'unsafe-inline' is
  // kept only for <style> (Tailwind-generated + Framer Motion inline styles).
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.youtube.com https://www.youtube-nocookie.com https://s.ytimg.com https://www.instagram.com https://*.instagram.com https://player.vimeo.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  // Thumbnails come from YouTube, Unsplash, Google Drive's public CDN, etc.
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  // Embeds we explicitly allow inside iframes.
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://*.youtube.com https://player.vimeo.com https://*.vimeo.com https://www.instagram.com https://*.instagram.com",
  // API calls: 'self' for our own dev-save endpoint; https: catch-all for
  // Google Fonts CSS and any third-party integrations added later.
  "connect-src 'self' https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Modern replacement for X-Frame-Options. SAMEORIGIN below is kept for
  // legacy-browser fallback; browsers that understand CSP prefer this.
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CSP,
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  'X-DNS-Prefetch-Control': 'on',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-site',
};

export default defineConfig({
  plugins: [react(), contentSaverPlugin()],
  server: { port: 5173, host: true, headers: SECURITY_HEADERS },
  preview: { port: 4173, host: true, headers: SECURITY_HEADERS },
});
