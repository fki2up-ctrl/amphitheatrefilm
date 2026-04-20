// ---------------------------------------------------------------------------
// GalleryHeader — the title strip that slides down from the top when the
// user enters the gallery from the Landing screen. Also hosts the top-nav
// pills so categories can be swapped without returning to Landing.
//
//   • In "All" mode the header shows the generic "Portfolio" title and the
//     full-catalogue long-scroll layout is rendered below.
//   • In single-category mode the header shows that category's label and
//     only its grid appears below (see ProjectGrid `filterCategoryId`).
//
// The horizontal pill list is always visible on the gallery header (desktop
// and mobile) and lets the user flip between categories without rewinding
// the phase state machine.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useContent } from '../store/content';
import { usePhase, CATEGORY_ALL } from '../flow/PhaseProvider';

const TITLE_EASE = [0.16, 1, 0.3, 1];

export default function GalleryHeader() {
  const { CATEGORIES, PROFILE } = useContent();
  const { selectedCategory, openCategory } = usePhase();
  const allLabel = (PROFILE.allLabel && PROFILE.allLabel.trim()) || 'All';

  // Resolve the big title based on which view we're in.
  const activeCategory =
    selectedCategory === CATEGORY_ALL
      ? null
      : CATEGORIES.find((c) => c.id === selectedCategory);
  const title = activeCategory ? activeCategory.label : 'Portfolio';
  const subtitle = activeCategory
    ? `${activeCategory.projects.length} works`
    : `${CATEGORIES.reduce((n, c) => n + c.projects.length, 0)} works · all categories`;

  // Pills for swapping categories from inside the gallery. "All" first,
  // then each topic.
  const pills = [
    { id: CATEGORY_ALL, label: allLabel },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <header className="relative mb-10 sm:mb-14">
      {/* Big category title — slides in from the top with a slight delay so
          it lands AFTER the gallery fades in (which itself is delayed from
          Landing's dive-in). */}
      <motion.div
        initial={{ opacity: 0, y: -32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: TITLE_EASE, delay: 0.25 }}
        className="flex items-end justify-between gap-6 flex-wrap"
      >
        <div>
          <motion.h1
            key={title /* re-animate when switching categories */}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="font-display leading-[1.05] tracking-tight"
            style={{ fontSize: 'var(--site-topic-size, 60px)' }}
          >
            {title}
          </motion.h1>
          <p className="mt-2 text-[11px] sm:text-xs text-white/45 tracking-widest2 uppercase">
            {subtitle}
          </p>
        </div>
      </motion.div>

      {/* Pill nav — single horizontal line, thumb-scrollable. Active pill
          smooth-scrolls into the viewport center on change. */}
      <PillNav
        pills={pills}
        selectedCategory={selectedCategory}
        openCategory={openCategory}
      />
    </header>
  );
}

function PillNav({ pills, selectedCategory, openCategory }) {
  const scrollerRef = useRef(null);
  const pillRefs = useRef({});

  // Center the active pill inside the scroller whenever selection changes.
  useEffect(() => {
    const scroller = scrollerRef.current;
    const pill = pillRefs.current[selectedCategory];
    if (!scroller || !pill) return;
    const target =
      pill.offsetLeft - (scroller.clientWidth - pill.offsetWidth) / 2;
    scroller.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
  }, [selectedCategory]);

  return (
    <motion.nav
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: TITLE_EASE, delay: 0.55 }}
      className="mt-6 sm:mt-8 -mx-4 sm:-mx-8 lg:-mx-12"
      style={{
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
        maskImage:
          'linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)',
      }}
    >
      <ul
        ref={scrollerRef}
        className="flex flex-nowrap items-center gap-2 sm:gap-2.5 overflow-x-auto no-scrollbar scroll-smooth px-4 sm:px-8 lg:px-12 py-1"
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
                  inline-flex items-center px-3.5 py-1.5 whitespace-nowrap
                  text-[11px] sm:text-xs tracking-[0.14em] uppercase
                  rounded-full border transition-all duration-300
                  focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60
                  ${active
                    ? 'border-white/60 bg-white/10 text-white scale-[1.04]'
                    : 'border-white/10 text-white/55 hover:text-white hover:border-white/30'}
                `}
              >
                {p.label}
              </button>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}
