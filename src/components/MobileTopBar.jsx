// ---------------------------------------------------------------------------
// MobileTopBar — sticky header for mobile only.
// Stacked layout mirroring the desktop sidebar:
//   Row 1 — full-width portrait (adjustable height + crop, fade at bottom)
//   Row 2 — name + role  ·  social icons (right-aligned)
// Publishes its own measured height as --mobile-header-height so the page's
// main content can offset dynamically regardless of portrait size.
// Visible under lg breakpoint; desktop uses Sidebar instead.
// ---------------------------------------------------------------------------

import { useLayoutEffect, useRef } from 'react';
import { Instagram, Facebook, Mail, Link as LinkIcon } from 'lucide-react';
import { useContent } from '../store/content';

export default function MobileTopBar() {
  const { BRAND, SITE_ASSETS, PROFILE } = useContent();
  const ref = useRef(null);

  // Publish the bar's actual height so <main> can pt-[var(--mobile-header-height)]
  // and stay clear of it regardless of how the user has sized the portrait.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publish = () => {
      document.documentElement.style.setProperty(
        '--mobile-header-height',
        `${el.offsetHeight}px`
      );
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const photoHeight = Number(PROFILE.mobilePhotoHeight) || 180;
  const photoPosition = PROFILE.photoPosition || '50% 50%';

  return (
    <header
      ref={ref}
      className="
        lg:hidden fixed top-0 inset-x-0 z-50
        bg-ink-950/85 backdrop-blur-md
        border-b border-white/10
      "
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
    >
      {/* Row 1 — portrait, full-width with fade-off mask into the bar */}
      {SITE_ASSETS.headerImage && (
        <div
          className="relative w-full overflow-hidden bg-ink-800"
          style={{
            height: `${photoHeight}px`,
            WebkitMaskImage:
              'linear-gradient(to bottom, black 60%, transparent 100%)',
            maskImage:
              'linear-gradient(to bottom, black 60%, transparent 100%)',
          }}
        >
          <img
            src={SITE_ASSETS.headerImage}
            alt={`${BRAND.name} — ${BRAND.role}`}
            loading="lazy"
            className="w-full h-full object-cover"
            style={{ objectPosition: photoPosition }}
          />
        </div>
      )}

      {/* Row 2 — name + role · social icons */}
      <div className="px-4 pb-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[22px] tracking-tight text-white truncate">
              {BRAND.name}
            </div>
            {BRAND.role && (
              <div className="mt-1 text-[12px] tracking-wide text-white/60 truncate">
                {BRAND.role}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <IconLink href={BRAND.socials.instagram} label="Instagram">
              <Instagram className="w-3.5 h-3.5" />
            </IconLink>
            <IconLink href={BRAND.socials.facebook} label="Facebook">
              <Facebook className="w-3.5 h-3.5" />
            </IconLink>
            <IconLink href={BRAND.email ? `mailto:${BRAND.email}` : null} label="Email">
              <Mail className="w-3.5 h-3.5" />
            </IconLink>
            <IconLink href={BRAND.socials.linktree} label="Linktree">
              <LinkIcon className="w-3.5 h-3.5" />
            </IconLink>
          </div>
        </div>
      </div>
    </header>
  );
}

function IconLink({ href, label, children }) {
  if (!href) return null;
  const isExternal = !href.startsWith('mailto:');
  return (
    <a
      href={href}
      {...(isExternal ? { target: '_blank', rel: 'noreferrer' } : {})}
      aria-label={label}
      className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/40 transition-colors"
    >
      {children}
    </a>
  );
}
