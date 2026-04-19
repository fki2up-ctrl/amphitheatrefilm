// ---------------------------------------------------------------------------
// Font catalog — 12 curated Google Fonts that the editor's Typography panel
// lets the user pick from for each role (body / display / brand).
//
// Each entry describes:
//   id              stable slug used as dropdown <option value>
//   name            display label shown in the dropdown
//   family          full CSS font-family fragment written to the :root
//                   custom property — MUST include web-safe fallbacks
//   googleParam     the `family=...` query fragment appended to
//                   https://fonts.googleapis.com/css2?... by fontLoader.js
//                   when the user picks this font. `null` means the font is
//                   already in the static <link> tag in index.html.
//   weights         numeric weights actually shipped by the family; the UI
//                   constrains the weight picker to these so we don't ask
//                   the browser to synthesise faux-bold.
//   category        'sans' | 'serif' | 'script' — drives grouping in the
//                   dropdown and also filters sensible defaults per role
//                   (e.g. "brand" defaults to script fonts).
// ---------------------------------------------------------------------------

export const FONT_CATALOG = [
  // ── Sans-serif ────────────────────────────────────────────────────────────
  {
    id:          'dm-sans',
    name:        'DM Sans',
    family:      '"DM Sans", ui-sans-serif, system-ui, sans-serif',
    googleParam: null, // preloaded in index.html
    weights:     [300, 400, 500, 600, 700],
    category:    'sans',
  },
  {
    id:          'inter',
    name:        'Inter',
    family:      '"Inter", ui-sans-serif, system-ui, sans-serif',
    googleParam: 'Inter:wght@300;400;500;600;700',
    weights:     [300, 400, 500, 600, 700],
    category:    'sans',
  },
  {
    id:          'space-grotesk',
    name:        'Space Grotesk',
    family:      '"Space Grotesk", ui-sans-serif, system-ui, sans-serif',
    googleParam: 'Space+Grotesk:wght@300;400;500;600;700',
    weights:     [300, 400, 500, 600, 700],
    category:    'sans',
  },
  {
    id:          'manrope',
    name:        'Manrope',
    family:      '"Manrope", ui-sans-serif, system-ui, sans-serif',
    googleParam: 'Manrope:wght@300;400;500;600;700',
    weights:     [300, 400, 500, 600, 700],
    category:    'sans',
  },

  // ── Serif / Display ──────────────────────────────────────────────────────
  {
    id:          'playfair-display',
    name:        'Playfair Display',
    family:      '"Playfair Display", ui-serif, serif',
    googleParam: null, // preloaded in index.html
    weights:     [400, 500, 600, 700],
    category:    'serif',
  },
  {
    id:          'cormorant-garamond',
    name:        'Cormorant Garamond',
    family:      '"Cormorant Garamond", ui-serif, serif',
    googleParam: 'Cormorant+Garamond:wght@300;400;500;600;700',
    weights:     [300, 400, 500, 600, 700],
    category:    'serif',
  },
  {
    id:          'dm-serif-display',
    name:        'DM Serif Display',
    family:      '"DM Serif Display", ui-serif, serif',
    googleParam: 'DM+Serif+Display',
    weights:     [400],
    category:    'serif',
  },

  // ── Handwriting / Script ─────────────────────────────────────────────────
  {
    id:          'sacramento',
    name:        'Sacramento',
    family:      '"Sacramento", ui-serif, cursive',
    googleParam: null, // preloaded in index.html
    weights:     [400],
    category:    'script',
  },
  {
    id:          'caveat',
    name:        'Caveat',
    family:      '"Caveat", ui-serif, cursive',
    googleParam: 'Caveat:wght@400;500;600;700',
    weights:     [400, 500, 600, 700],
    category:    'script',
  },
  {
    id:          'dancing-script',
    name:        'Dancing Script',
    family:      '"Dancing Script", ui-serif, cursive',
    googleParam: 'Dancing+Script:wght@400;500;600;700',
    weights:     [400, 500, 600, 700],
    category:    'script',
  },
  {
    id:          'homemade-apple',
    name:        'Homemade Apple',
    family:      '"Homemade Apple", ui-serif, cursive',
    googleParam: 'Homemade+Apple',
    weights:     [400],
    category:    'script',
  },
  {
    id:          'great-vibes',
    name:        'Great Vibes',
    family:      '"Great Vibes", ui-serif, cursive',
    googleParam: 'Great+Vibes',
    weights:     [400],
    category:    'script',
  },
];

// Human-readable category headings used by the <optgroup> in the dropdown.
export const FONT_CATEGORY_LABELS = {
  sans:   'Sans-serif',
  serif:  'Serif / Display',
  script: 'Handwriting / Script',
};

// Letter-spacing presets shown in the tracking picker. em units scale with
// the font-size so they stay visually consistent across all role usages.
export const TRACKING_PRESETS = [
  { id: 'tight',  label: 'Tight',  value: '-0.02em' },
  { id: 'snug',   label: 'Snug',   value: '-0.01em' },
  { id: 'normal', label: 'Normal', value: '0em'     },
  { id: 'wide',   label: 'Wide',   value: '0.03em'  },
  { id: 'wider',  label: 'Wider',  value: '0.08em'  },
];

// Find a catalog entry by its CSS family string (reverse lookup used by the
// editor when loading settings from Supabase/localStorage). Returns null if
// the stored family doesn't match any curated font — in that case the UI
// falls back to a "Custom" read-only indicator.
export function findFontByFamily(family) {
  if (!family) return null;
  return FONT_CATALOG.find((f) => f.family === family) || null;
}

// Find a catalog entry by its id (used by the dropdown on change).
export function findFontById(id) {
  return FONT_CATALOG.find((f) => f.id === id) || null;
}
