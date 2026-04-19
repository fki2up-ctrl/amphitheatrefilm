// ---------------------------------------------------------------------------
// Lazy Google Fonts loader.
//
// The site preloads DM Sans + Playfair Display + Sacramento in index.html;
// any OTHER font the user picks via the editor is fetched on-demand through
// this module, which appends a <link rel="stylesheet"> to <head> once per
// unique Google Fonts `family=...` param.
//
// This keeps the initial page weight minimal — visitors only download the
// fonts actually used by the *current* settings, not the whole 12-font
// catalog.
// ---------------------------------------------------------------------------

// Module-scoped set so repeated calls with the same param are cheap no-ops.
const loaded = new Set();
const pending = new Map(); // param -> Promise<void>

const GOOGLE_FONTS_BASE = 'https://fonts.googleapis.com/css2?';

/**
 * Ensure a Google Fonts family is available for rendering. Returns a Promise
 * that resolves when the stylesheet's <link> emits `load`, or immediately if
 * the font was already fetched / is statically preloaded.
 *
 * @param {string|null} googleParam  The `family=…` fragment from
 *   fontCatalog.js (e.g. "Caveat:wght@400;500"). Pass `null` for fonts
 *   already in the static index.html <link>.
 * @returns {Promise<void>}
 */
export function ensureFontLoaded(googleParam) {
  if (!googleParam) return Promise.resolve();
  if (loaded.has(googleParam)) return Promise.resolve();
  if (pending.has(googleParam)) return pending.get(googleParam);
  if (typeof document === 'undefined') return Promise.resolve();

  const href = `${GOOGLE_FONTS_BASE}family=${googleParam}&display=swap`;

  // Guard against the stylesheet already existing in the DOM (e.g. after
  // hot-reload or SSR hydration). If found, mark as loaded without adding
  // another <link>.
  const existing = document.querySelector(`link[data-font-loader="${CSS.escape(googleParam)}"]`);
  if (existing) {
    loaded.add(googleParam);
    return Promise.resolve();
  }

  const p = new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = href;
    link.setAttribute('data-font-loader', googleParam);
    link.addEventListener('load',  () => { loaded.add(googleParam); resolve(); }, { once: true });
    // Resolve even on error so the UI doesn't hang — the browser will fall
    // back to the font stack defined in the CSS `font-family` declaration.
    link.addEventListener('error', () => { loaded.add(googleParam); resolve(); }, { once: true });
    document.head.appendChild(link);
  });

  pending.set(googleParam, p);
  return p;
}

/**
 * Convenience: ensure a whole batch of params are loaded in parallel. Useful
 * when the editor picks a font and wants to pre-warm the dropdown hover
 * previews for neighbouring fonts in the same category.
 *
 * @param {Array<string|null>} googleParams
 */
export function ensureFontsLoaded(googleParams) {
  return Promise.all((googleParams || []).map(ensureFontLoaded));
}
