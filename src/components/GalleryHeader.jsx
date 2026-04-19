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

import { motion } from 'framer-motion';
import { useContent } from '../store/content';
import { usePhase, CATEGORY_ALL } from '../flow/PhaseProvider';

const TITLE_EASE = [0.16, 1, 0.3, 1];

export default function GalleryHeader() {
  const { CATEGORIES } = useContent();
  const { selectedCategory, openCategory } = usePhase();

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
    { id: CATEGORY_ALL, label: 'All' },
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
            className="font-display text-3xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight"
          >
            {title}
          </motion.h1>
          <p className="mt-2 text-[11px] sm:text-xs text-white/45 tracking-widest2 uppercase">
            {subtitle}
          </p>
        </div>
      </motion.div>

      {/* Pill nav — enters just after the title. Current selection is filled;
          others are ghosted. Keyboard-navigable; click to swap view. */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: TITLE_EASE, delay: 0.55 }}
        className="mt-6 sm:mt-8"
      >
        <ul className="flex flex-wrap gap-2 sm:gap-2.5">
          {pills.map((p) => {
            const active = p.id === selectedCategory;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => openCategory(p.id)}
                  aria-pressed={active}
                  className={`
                    inline-flex items-center px-3.5 py-1.5
                    text-[11px] sm:text-xs tracking-[0.14em] uppercase
                    rounded-full border transition-colors duration-200
                    focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60
                    ${active
                      ? 'border-white/60 bg-white/10 text-white'
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
    </header>
  );
}
