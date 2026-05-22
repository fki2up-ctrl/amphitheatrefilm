// ---------------------------------------------------------------------------
// FloatingCategoryBar — desktop-only thumb-friendly category pill bar.
//
// Mirrors the mobile MobileNav behaviour on desktop: once the user scrolls
// past the top GalleryHeader pill nav (id="gallery-pill-nav"), this bar
// slides up from the bottom of the viewport so the user can switch topics
// without scrolling back up. Hides again when the top pill nav re-enters.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../store/content';
import { usePhase, CATEGORY_ALL } from '../flow/PhaseProvider';

export default function FloatingCategoryBar() {
  const { CATEGORIES, PROFILE } = useContent();
  const { selectedCategory, openCategory } = usePhase();
  const allLabel = (PROFILE.allLabel && PROFILE.allLabel.trim()) || 'All';

  const pills = [
    { id: CATEGORY_ALL, label: allLabel },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];

  const [visible, setVisible] = useState(false);
  const scrollerRef = useRef(null);
  const pillRefs = useRef({});

  // Observe the top pill nav — when it leaves the viewport, reveal this bar.
  useEffect(() => {
    const target = document.getElementById('gallery-pill-nav');
    if (!target) return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0, rootMargin: '0px 0px -20px 0px' }
    );
    io.observe(target);
    return () => io.disconnect();
  }, []);

  // Keep the active pill centred inside the bar whenever selection changes.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const pill = pillRefs.current[selectedCategory];
    if (!scroller || !pill) return;
    const target =
      pill.offsetLeft - (scroller.clientWidth - pill.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [selectedCategory, visible]);

  return (
    <AnimatePresence>
      {visible && (
        <>
        {/* Fade-up gradient sitting above project cards (z-30) but below the
            floating bar (z-40). Gives the impression cards dissolve into
            darkness behind the pill bar as it slides into view. */}
        <motion.div
          key="floating-cat-fade"
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="hidden lg:block fixed inset-x-0 bottom-0 h-40 z-30 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.55) 40%, rgba(0,0,0,0) 100%)',
          }}
        />
        <div
          className="hidden lg:block fixed bottom-6 z-40 max-w-[min(92vw,1100px)] pointer-events-none"
          style={{
            left: 'calc(50% + var(--site-sidebar-width, 280px) / 2)',
            transform: 'translateX(-50%)',
          }}
        >
        <motion.nav
          key="floating-cat-bar"
          aria-label="Categories"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="pointer-events-auto"
        >
          <div
            className="
              rounded-full
              bg-ink-950/80 backdrop-blur-md
              border border-white/10
              shadow-2xl shadow-black/50
              px-2 py-2
            "
            style={{
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
              maskImage:
                'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
            }}
          >
            <ul
              ref={scrollerRef}
              className="flex flex-nowrap items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth px-6"
            >
              {pills.map((p) => {
                const active = p.id === selectedCategory;
                return (
                  <li key={p.id} className="shrink-0">
                    <button
                      ref={(el) => { pillRefs.current[p.id] = el; }}
                      type="button"
                      onClick={() => openCategory(p.id)}
                      aria-pressed={active}
                      className={`
                        inline-flex items-center px-4 py-2 whitespace-nowrap
                        tracking-[0.18em] uppercase
                        rounded-full border transition-all duration-300
                        focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60
                        ${active
                          ? 'border-white/70 bg-white/10 text-white'
                          : 'border-white/15 text-white/65 hover:text-white hover:border-white/40'}
                      `}
                      style={{ fontSize: 'var(--site-topic-menu-size, 12px)' }}
                    >
                      {p.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </motion.nav>
        </div>
        </>
      )}
    </AnimatePresence>
  );
}
