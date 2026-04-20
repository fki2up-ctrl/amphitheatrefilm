import { motion } from 'framer-motion';
import { Instagram, Facebook, Mail, Link as LinkIcon, Pencil } from 'lucide-react';
import { useContent } from '../store/content';

// Render the tagline with one word optionally italicised for emphasis.
function renderTagline(text, emphasis) {
  if (!emphasis) return text;
  const i = text.toLowerCase().indexOf(String(emphasis).toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <span className="italic text-white/60">
        {text.slice(i, i + emphasis.length)}
      </span>
      {text.slice(i + emphasis.length)}
    </>
  );
}

export default function Sidebar({ onOpenEditor }) {
  const { BRAND, SITE_ASSETS, PROFILE } = useContent();

  return (
    <motion.aside
      // Slide in from off-screen left with a soft ease-in-out when the
      // Gallery phase first mounts (after the Landing dive-in). Subsequent
      // re-renders within the gallery don't re-animate because this element
      // never unmounts once the gallery is shown.
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1], delay: 0.35 }}
      className="hidden lg:flex fixed left-0 top-0 h-screen w-[var(--site-sidebar-width,280px)] border-r border-white/5 bg-ink-950 z-40"
    >
      <div className="flex flex-col justify-between w-full pb-10">
        {/* Brand */}
        <div className="min-h-0 flex flex-col">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            {SITE_ASSETS.headerImage && (
              // Full-width header image with a soft "fade-off" mask at the
              // bottom that blends into the sidebar's background.
              <div
                className="relative w-full aspect-[4/5] overflow-hidden bg-ink-800"
                style={{
                  WebkitMaskImage:
                    'linear-gradient(to bottom, black 55%, transparent 100%)',
                  maskImage:
                    'linear-gradient(to bottom, black 55%, transparent 100%)',
                }}
              >
                <img
                  src={SITE_ASSETS.headerImage}
                  alt={`${BRAND.name} — ${BRAND.role}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: PROFILE.photoPosition || '50% 50%' }}
                />
              </div>
            )}

            {/* Clean whitespace between image and text */}
            <div className="px-7 pt-2">
              <h1 className="text-[26px] leading-[1.1] tracking-tight text-white">
                {BRAND.name}
              </h1>
              <p className="mt-2 text-[12px] tracking-wide text-white/55">
                {BRAND.role}
              </p>
              {/* Tagline — pulled from PROFILE in src/data/projects.js */}
              {PROFILE.tagline && (
                <p className="mt-5 text-[15px] leading-snug text-white/80 text-balance">
                  {renderTagline(PROFILE.tagline, PROFILE.taglineEmphasis)}
                </p>
              )}
            </div>
          </motion.div>

          {/* Contact list — replaces the previous category accordion. */}
          <nav className="mt-8 flex-1 overflow-y-auto pretty-scroll px-7 pr-4">
            <ul className="space-y-5">
              <ContactRow label="Email" value={BRAND.email} href={BRAND.email ? `mailto:${BRAND.email}` : null} />
              <ContactRow label="Instagram" value={prettyHandle(BRAND.socials.instagram) || BRAND.socials.instagram} href={BRAND.socials.instagram} />
              <ContactRow label="Facebook" value={prettyHandle(BRAND.socials.facebook) || BRAND.socials.facebook} href={BRAND.socials.facebook} />
              <ContactRow label="Linktree" value={prettyHandle(BRAND.socials.linktree) || BRAND.socials.linktree} href={BRAND.socials.linktree} />
            </ul>
          </nav>
        </div>

        {/* Socials */}
        <div className="pt-6 px-7">
          <div className="flex items-center gap-2">
            <SocialBtn href={BRAND.socials.instagram} label="Instagram">
              <Instagram className="w-3.5 h-3.5" />
            </SocialBtn>
            <SocialBtn href={BRAND.socials.facebook} label="Facebook">
              <Facebook className="w-3.5 h-3.5" />
            </SocialBtn>
            <SocialBtn href={`mailto:${BRAND.email}`} label="Email">
              <Mail className="w-3.5 h-3.5" />
            </SocialBtn>
            <SocialBtn href={BRAND.socials.linktree} label="Linktree">
              <LinkIcon className="w-3.5 h-3.5" />
            </SocialBtn>
            {onOpenEditor && (
              <button
                onClick={onOpenEditor}
                aria-label="Edit content"
                title="Edit content"
                className="ml-auto w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/65 hover:text-white hover:border-white/40 hover:-translate-y-0.5 transition-all duration-300"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <p className="mt-5 text-[10px] tracking-widest2 uppercase text-white/30">
            © {new Date().getFullYear()} — All rights reserved
          </p>
        </div>
      </div>
    </motion.aside>
  );
}

function SocialBtn({ href, label, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/65 hover:text-white hover:border-white/40 hover:-translate-y-0.5 transition-all duration-300"
    >
      {children}
    </a>
  );
}

// Contact list row — small label above a clickable value.
function ContactRow({ label, value, href }) {
  if (!value) return null;
  const isExternal = href && !href.startsWith('mailto:');
  return (
    <li>
      <div className="text-[10px] tracking-[0.18em] uppercase text-white/35">
        {label}
      </div>
      {href ? (
        <a
          href={href}
          {...(isExternal ? { target: '_blank', rel: 'noreferrer' } : {})}
          className="mt-1 block text-[13px] text-white/80 hover:text-white break-all transition-colors duration-200"
        >
          {value}
        </a>
      ) : (
        <div className="mt-1 text-[13px] text-white/80 break-all">{value}</div>
      )}
    </li>
  );
}

// Convert a social URL to a pretty @handle (best-effort, falls back to URL).
function prettyHandle(url) {
  if (!url || typeof url !== 'string') return '';
  try {
    const u = new URL(url);
    const seg = u.pathname.replace(/\/+$/, '').split('/').filter(Boolean).pop();
    return seg ? `@${seg}` : '';
  } catch {
    return '';
  }
}
