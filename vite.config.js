import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileP = promisify(execFile);

// Run `git add/commit/push` for the given file. Returns { pushed, message,
// error? }. Silently disabled if AMPHITHEATRE_GIT_SYNC=0 or the working tree
// isn't inside a git repo. Relies on the machine's configured git credentials
// (here: GitHub CLI helper) so pushes are non-interactive.
async function gitSync(filePath, cwd) {
  if (process.env.AMPHITHEATRE_GIT_SYNC === '0') {
    return { pushed: false, message: 'Git sync disabled (env flag).' };
  }
  try {
    // Only act if we're inside a repo.
    await execFileP('git', ['rev-parse', '--is-inside-work-tree'], { cwd });

    await execFileP('git', ['add', filePath], { cwd });

    // Skip if the working-tree change was actually a no-op.
    const { stdout: porcelain } = await execFileP(
      'git',
      ['status', '--porcelain', filePath],
      { cwd }
    );
    if (!porcelain.trim()) {
      return { pushed: false, message: 'No changes to commit.' };
    }

    const timestamp = new Date()
      .toISOString()
      .replace('T', ' ')
      .slice(0, 16);
    await execFileP(
      'git',
      ['commit', '-m', `Content update via editor — ${timestamp}`],
      { cwd }
    );

    // Push to the currently-tracked upstream. If no upstream is set this will
    // fail — that's fine, we surface the error to the editor UI.
    const { stdout: pushOut, stderr: pushErr } = await execFileP(
      'git',
      ['push'],
      { cwd }
    );
    return {
      pushed: true,
      message: `Committed & pushed at ${timestamp}`,
      detail: (pushErr || pushOut || '').trim().split('\n').slice(-1)[0] || '',
    };
  } catch (e) {
    return {
      pushed: false,
      error:
        (e?.stderr && String(e.stderr).trim()) ||
        e?.message ||
        String(e),
    };
  }
}

// Dev-only endpoint the Editor hits to persist changes back to disk, then
// auto-commit + push to GitHub. Disabled in production builds.
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
          // Stricter guard — require both top-level markers so we never
          // accept a half-formed payload that would blank the file.
          if (
            !body.includes('export const PROFILE') ||
            !body.includes('export const TOPICS')
          ) {
            throw new Error('Payload does not look like a projects.js file');
          }
          fs.writeFileSync(TARGET, body, 'utf8');

          // Then try to auto-push to GitHub.
          const git = await gitSync(TARGET, __dirname);

          res.statusCode = 200;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ ok: true, bytes: body.length, git }));
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
