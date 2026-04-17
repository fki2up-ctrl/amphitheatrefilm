import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, ChevronDown, Instagram, Facebook, Mail } from 'lucide-react';
import { useContent } from '../store/content';

export default function MobileNav({ onNavigateCategory, onSelectProject, activeCategoryId }) {
  const { BRAND, CATEGORIES, SITE_ASSETS } = useContent();
  const [open, setOpen] = useState(false);
  const [openCatId, setOpenCatId] = useState(CATEGORIES[0]?.id);

  return (
    <>
      {/* Compact horizontal mini-sidebar — brand row + scrolling nav strip. */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 bg-ink-950/95 backdrop-blur-sm border-b border-white/5">
        {/* Row 1 — brand */}
        <div className="flex items-center gap-3 px-4 pt-3 pb-2">
          {SITE_ASSETS.headerImage && (
            <button
              onClick={() => CATEGORIES[0] && onNavigateCategory(CATEGORIES[0].id)}
              className="w-9 h-9 shrink-0 rounded-full overflow-hidden bg-ink-800 ring-1 ring-white/10"
              aria-label={BRAND.name}
            >
              <img
                src={SITE_ASSETS.headerImage}
                alt=""
                className="w-full h-full object-cover"
              />
            </button>
          )}
          <button
            onClick={() => CATEGORIES[0] && onNavigateCategory(CATEGORIES[0].id)}
            className="flex-1 min-w-0 text-left leading-tight"
          >
            <div className="text-[13px] truncate tracking-tight">{BRAND.name}</div>
            {BRAND.role && (
              <div className="text-[10px] text-white/40 truncate tracking-wide">
                {BRAND.role}
              </div>
            )}
          </button>
          <button
            onClick={() => setOpen(true)}
            aria-label="Open full menu"
            className="w-8 h-8 shrink-0 rounded-full border border-white/10 flex items-center justify-center text-white/65 hover:text-white hover:border-white/40 transition-colors"
          >
            <Menu className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 2 — editorial underline-style nav, fade-masked edges */}
        <nav
          className="relative"
          style={{
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
            maskImage:
              'linear-gradient(to right, transparent 0, black 20px, black calc(100% - 20px), transparent 100%)',
          }}
        >
          <ul className="flex items-end gap-5 overflow-x-auto no-scrollbar px-5 pb-2">
            {CATEGORIES.map((cat) => {
              const isActive = activeCategoryId === cat.id;
              return (
                <li key={cat.id} className="shrink-0">
                  <button
                    onClick={() => onNavigateCategory(cat.id)}
                    className="group relative inline-flex flex-col items-start gap-1 py-1.5"
                  >
                    <span
                      className={`text-[11px] uppercase tracking-widest whitespace-nowrap transition-colors duration-200 ${
                        isActive
                          ? 'text-white'
                          : 'text-white/45 group-hover:text-white/80'
                      }`}
                    >
                      {cat.label}
                    </span>
                    <span
                      className={`h-[2px] transition-all duration-300 rounded-full ${
                        isActive
                          ? 'w-full bg-white'
                          : 'w-0 bg-white/50 group-hover:w-3'
                      }`}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="lg:hidden fixed inset-0 z-[70] bg-ink-950 overflow-y-auto"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 sticky top-0 bg-ink-950">
              <span className="text-lg">{BRAND.name}</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="px-6 py-8 pb-24">
              {SITE_ASSETS.headerImage && (
                <div
                  className={`mb-8 overflow-hidden ring-1 ring-white/10 bg-ink-800 ${
                    SITE_ASSETS.headerImageShape === 'square'
                      ? 'rounded-xl w-24 h-24'
                      : 'rounded-full w-20 h-20'
                  }`}
                >
                  <img
                    src={SITE_ASSETS.headerImage}
                    alt={`${BRAND.name} logo`}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <ul className="space-y-2">
                {CATEGORIES.map((cat, i) => {
                  const isOpenCat = openCatId === cat.id;
                  return (
                    <motion.li
                      key={cat.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-white/5"
                    >
                      <button
                        onClick={() =>
                          setOpenCatId((cur) => (cur === cat.id ? null : cat.id))
                        }
                        className="w-full flex items-center justify-between py-4 text-left"
                      >
                        <span className="flex items-baseline gap-3">
                          <span className="text-[10px] text-white/30 tabular-nums">
                            0{i + 1}
                          </span>
                          <span className="text-2xl text-white/90">
                            {cat.label}
                          </span>
                        </span>
                        <motion.span
                          animate={{ rotate: isOpenCat ? 180 : 0 }}
                          transition={{ duration: 0.3 }}
                          className="text-white/40"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.span>
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpenCat && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            className="overflow-hidden"
                          >
                            <ul className="pb-4 pl-7 space-y-1">
                              {cat.projects.map((p) => (
                                <li key={p.id}>
                                  <button
                                    onClick={() => {
                                      setOpen(false);
                                      onSelectProject(p.id);
                                    }}
                                    className="w-full text-left text-sm text-white/55 hover:text-white py-1.5"
                                  >
                                    {p.title}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.li>
                  );
                })}
              </ul>

              <div className="mt-10 flex gap-3">
                <a
                  href={BRAND.socials.instagram}
                  className="w-11 h-11 rounded-full border border-white/10 flex items-center justify-center"
                  aria-label="Instagram"
                >
                  <Instagram className="w-4 h-4" />
                </a>
                <a
                  href={BRAND.socials.facebook}
                  className="w-11 h-11 rounded-full border border-white/10 flex items-center justify-center"
                  aria-label="Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </a>
                <a
                  href={`mailto:${BRAND.email}`}
                  className="w-11 h-11 rounded-full border border-white/10 flex items-center justify-center"
                  aria-label="Email"
                >
                  <Mail className="w-4 h-4" />
                </a>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
