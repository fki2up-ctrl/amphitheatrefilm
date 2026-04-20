// ---------------------------------------------------------------------------
// siteConfig — defaults, merge helpers, and :root CSS-variable applier for
// the global site configuration engine (layout, typography, animations).
//
// Shape:
//   {
//     layout:      { sidebarWidth, gridCols, cardGap },
//     typography:  { topicSize, bodySize },
//     animations:  { introSpeed, transitionEffect },
//   }
//
// Config is persisted as a single JSONB column (`site_config`) on the
// singleton `site_settings` row in Supabase. Changing it should repaint the
// whole site instantly via CSS custom properties on :root.
// ---------------------------------------------------------------------------

export const DEFAULT_SITE_CONFIG = {
  layout: {
    sidebarWidth: 280,  // px, desktop fixed sidebar
    gridCols:     3,    // project grid columns on md+ screens
    cardGap:      20,   // px, gap between project cards
  },
  typography: {
    topicSize: 32,      // px, big category title in GalleryHeader
    bodySize:  16,      // px, base body size (drives Tailwind rem scale)
  },
  animations: {
    introSpeed:        1,         // multiplier; 1 = default, <1 faster, >1 slower
    transitionEffect: 'dive-in',  // 'dive-in' | 'fade' | 'slide'
  },
};

// Deep-merge a (possibly partial / possibly outdated) stored config on top of
// DEFAULT_SITE_CONFIG so schema additions always have a sane value.
export function mergeSiteConfig(stored) {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_SITE_CONFIG };
  return {
    layout:     { ...DEFAULT_SITE_CONFIG.layout,     ...(stored.layout     || {}) },
    typography: { ...DEFAULT_SITE_CONFIG.typography, ...(stored.typography || {}) },
    animations: { ...DEFAULT_SITE_CONFIG.animations, ...(stored.animations || {}) },
  };
}

// Write every config value to a CSS custom property on :root so Tailwind
// utilities like `w-[var(--site-sidebar-width)]` update instantly.
export function applySiteConfigToRoot(cfg) {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;
  r.setProperty('--site-sidebar-width', `${cfg.layout.sidebarWidth}px`);
  r.setProperty('--site-grid-cols',     String(cfg.layout.gridCols));
  r.setProperty('--site-card-gap',      `${cfg.layout.cardGap}px`);
  r.setProperty('--site-topic-size',    `${cfg.typography.topicSize}px`);
  r.setProperty('--site-body-size',     `${cfg.typography.bodySize}px`);
  r.setProperty('--site-intro-speed',   String(cfg.animations.introSpeed));
}
