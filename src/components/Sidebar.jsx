import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Instagram, Facebook, Mail, Link as LinkIcon, Pencil } from 'lucide-react';
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

export default function Sidebar({ activeProjectId, activeCategoryId, onSelectProject, onOpenEditor }) {
  const { BRAND, CATEGORIES, SITE_ASSETS, PROFILE } = useContent();
  // Start with everything collapsed — the left accent bar and any "selected"
  // styling should only appear once the user actively chooses a topic.
  const [openId, setOpenId] = useState(null);

  const toggle = (id) => setOpenId((cur) => (cur === id ? null : id));

  return (
    <motion.aside
      // Slide in from off-screen left with a soft ease-in-out when the
      // Gallery phase first mounts (after the Landing dive-in). Subsequent
      // re-renders within the gallery don't re-animate because this element
      // never unmounts once the gallery is shown.
      initial={{ x: -300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1], delay: 0.35 }}
      className="hidden lg:flex fixed left-0 top-0 h-screen w-[280px] border-r border-white/5 bg-ink-950 z-40"
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

          {/* Accordion nav */}
          <nav className="mt-8 flex-1 overflow-y-auto pretty-scroll px-7 pr-4">
            <ul className="space-y-1">
              {CATEGORIES.map((cat, i) => {
                const isOpen = openId === cat.id;
                const isActiveCat = activeCategoryId === cat.id;
                return (
                  <motion.li
                    key={cat.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{
                      // Only dim others when a category is actually open.
                      opacity: openId == null || isOpen ? 1 : 0.55,
                      x: 0,
                    }}
                    transition={{ delay: 0.1 + i * 0.05, duration: 0.5 }}
                    className={`relative rounded-lg border-b border-white/5 last:border-b-0 transition-colors duration-300 ${
                      isOpen
                        ? 'bg-white/[0.04] border-b-transparent shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]'
                        : ''
                    }`}
                  >
                    {/* Accent bar — only when the user has actually opened this category */}
                    <AnimatePresence>
                      {isOpen && (
                        <motion.span
                          layoutId="sidebar-active-bar"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full bg-white"
                        />
                      )}
                    </AnimatePresence>

                    <button
                      onClick={() => toggle(cat.id)}
                      className={`group w-full flex items-center justify-between gap-3 py-3 text-left transition-[padding] duration-300 ${
                        isOpen ? 'pl-4 pr-3' : 'pl-0 pr-0'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <span
                          className={`h-px transition-all duration-500 ${
                            isOpen
                              ? 'w-8 bg-white'
                              : isActiveCat
                              ? 'w-6 bg-white'
                              : 'w-3 bg-white/25 group-hover:w-5 group-hover:bg-white/60'
                          }`}
                        />
                        <span
                          className={`tracking-wide transition-all duration-300 truncate ${
                            isOpen
                              ? 'text-white text-[14px] font-medium'
                              : isActiveCat
                              ? 'text-white text-[13px]'
                              : 'text-white/55 text-[13px] group-hover:text-white/90'
                          }`}
                        >
                          {cat.label}
                        </span>
                      </span>
                      <motion.span
                        animate={{
                          rotate: isOpen ? 180 : 0,
                          opacity: isOpen ? 1 : 0.45,
                        }}
                        transition={{ duration: 0.3 }}
                        className={isOpen ? 'text-white' : 'text-white/40'}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </motion.span>
                    </button>

                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          key="content"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                          className="overflow-hidden"
                        >
                          <ul className="pb-3 pl-6 space-y-0.5">
                            {cat.projects.map((p) => {
                              const isActive = activeProjectId === p.id;
                              return (
                                <li key={p.id}>
                                  <button
                                    onClick={() => onSelectProject(p.id)}
                                    className={`group w-full text-left text-[12px] leading-snug py-1.5 pl-3 border-l transition-colors duration-200 ${
                                      isActive
                                        ? 'border-white text-white'
                                        : 'border-white/10 text-white/45 hover:text-white/90 hover:border-white/40'
                                    }`}
                                  >
                                    {p.title}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.li>
                );
              })}
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
