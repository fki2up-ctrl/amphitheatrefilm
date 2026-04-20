// ---------------------------------------------------------------------------
// MobileTopBar — sticky header for mobile only.
// Shows: brand photo · name · role · social icons.
// Visible under lg breakpoint; desktop uses Sidebar instead.
// ---------------------------------------------------------------------------

import { Instagram, Facebook, Mail, Link as LinkIcon } from 'lucide-react';
import { useContent } from '../store/content';

export default function MobileTopBar() {
  const { BRAND, SITE_ASSETS } = useContent();

  return (
    <header
      className="
        lg:hidden fixed top-0 inset-x-0 z-50
        bg-ink-950/85 backdrop-blur-md
        border-b border-white/10
      "
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0px)' }}
    >
      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center gap-4">
          {SITE_ASSETS.headerImage && (
            <img
              src={SITE_ASSETS.headerImage}
              alt=""
              className="w-[72px] h-[90px] shrink-0 rounded-lg object-cover bg-ink-800"
              style={{
                WebkitMaskImage:
                  'linear-gradient(to bottom, black 60%, transparent 100%)',
                maskImage:
                  'linear-gradient(to bottom, black 60%, transparent 100%)',
              }}
            />
          )}

          <div className="flex-1 min-w-0 leading-tight">
            <div className="text-[22px] tracking-tight text-white truncate">
              {BRAND.name}
            </div>
            {BRAND.role && (
              <div className="mt-1.5 text-[13px] tracking-wide text-white/60 truncate">
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
