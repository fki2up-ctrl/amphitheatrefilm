// ---------------------------------------------------------------------------
// MobileNav — thumb-friendly bottom-docked horizontal category bar.
//
// Only visible on viewports below the `lg` breakpoint (desktop uses the
// left Sidebar). It mirrors the Landing menu's aesthetic: underline-style
// pills that scroll horizontally, with the currently-active category
// highlighted. Safe-area padding keeps it clear of the iOS home indicator.
//
// Tapping a category advances the phase state machine via `openCategory`,
// which unifies behaviour with the Landing menu and the GalleryHeader pills.
// ---------------------------------------------------------------------------

import { motion } from 'framer-motion';
import { useContent } from '../store/content';
import { usePhase, CATEGORY_ALL } from '../flow/PhaseProvider';

export default function MobileNav() {
  const { CATEGORIES } = useContent();
  const { selectedCategory, openCategory } = usePhase();

  // Menu items — "All" prepended, mirroring the Landing & GalleryHeader lists.
  const items = [
    { id: CATEGORY_ALL, label: 'All' },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <motion.nav
      // Slide up from off-screen when the gallery first appears. Matches
      // the Sidebar's slide-in rhythm so desktop and mobile entrances
      // feel coordinated.
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: [0.65, 0, 0.35, 1], delay: 0.45 }}
      aria-label="Categories"
      className="
        lg:hidden fixed inset-x-0 bottom-0 z-50
        bg-ink-950/85 backdrop-blur-md
        border-t border-white/10
      "
      style={{
        // iOS safe-area inset so the bar doesn't hide behind the home bar.
        paddingBottom: 'max(env(safe-area-inset-bottom), 6px)',
      }}
    >
      {/* Dot indicator UI: a tiny floating label reveals the currently
          selected category (so users still know what they're tapping),
          while the row below is just dots — active one is a horizontal
          pill, the rest are small circles. Tapping any dot swaps the view. */}
      <div className="flex flex-col items-center gap-1.5 px-5 py-3">
        {/* Active-category label — keyed so it cross-fades between values. */}
        <div className="relative h-3 overflow-hidden">
          <motion.span
            key={selectedCategory /* re-animate when switched */}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="
              block whitespace-nowrap
              text-[10px] tracking-[0.22em] uppercase font-medium
              text-white/85
            "
          >
            {items.find((it) => it.id === selectedCategory)?.label ?? ''}
          </motion.span>
        </div>

        {/* Dot row — inactive = small circle, active = pill. */}
        <ul className="flex items-center gap-2.5">
          {items.map((item) => {
            const isActive = selectedCategory === item.id;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openCategory(item.id)}
                  aria-label={item.label}
                  aria-pressed={isActive}
                  className="
                    relative inline-flex items-center justify-center
                    p-2 -m-2
                    focus:outline-none
                  "
                >
                  <motion.span
                    aria-hidden="true"
                    initial={false}
                    animate={{
                      width:   isActive ? 18 : 6,
                      opacity: isActive ? 1   : 0.4,
                    }}
                    transition={{ duration: 0.28, ease: [0.65, 0, 0.35, 1] }}
                    className={`
                      block h-1.5 rounded-full
                      ${isActive ? 'bg-white' : 'bg-white/60'}
                    `}
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </motion.nav>
  );
}
