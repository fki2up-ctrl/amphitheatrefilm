// ---------------------------------------------------------------------------
// Landing — the cinematic hero screen that sits between the Intro sequence
// and the Gallery.
//
// Composition (back → front):
//   1. Background video (PROFILE.featuredVideo), fading in on player ready.
//   2. Subtle dark-blue linear gradient along the bottom for text legibility.
//   3. Horizontal category menu with staggered left-to-right entrance.
//   4. Brand name + role docked at the bottom-center via Framer Motion's
//      shared `layoutId` so they appear to flow in from the Intro screen.
//
// Interactions:
//   • Clicking a category advances the phase to `gallery` and records the
//     selection. The dive-in zoom/blur/fade-to-black animation is added in
//     Chunk E; for now the transition is a plain cross-fade.
// ---------------------------------------------------------------------------

import { motion } from 'framer-motion';
import { useContent } from '../store/content';
import { usePhase, CATEGORY_ALL } from '../flow/PhaseProvider';
import BackgroundVideo from './BackgroundVideo';

// Shared layoutId constants — Intro.PhaseTwo writes the same values so
// Framer can interpolate position/size during the Intro → Landing handoff.
export const LAYOUT_ID_BRAND_NAME = 'brand-name';
export const LAYOUT_ID_BRAND_ROLE = 'brand-role';

// The name+role pair collapse toward the bottom of the screen during the
// morph. This ease feels deliberate / cinematic rather than springy.
const MORPH_EASE     = [0.4, 0, 0.2, 1];
const MORPH_DURATION = 1.1;

// Menu item stagger — first item appears at `MENU_BASE_DELAY`, each
// successive item follows `MENU_STEP` seconds later. Tuned so the last
// item lands ~1.2s after the first (feels unhurried but not sluggish).
const MENU_BASE_DELAY = 0.6;  // wait for the brand morph to be most of the way done
const MENU_STEP       = 0.09;

// Fallback background video used when PROFILE.featuredVideo hasn't been
// set in the editor yet. Editable via the Editor → Featured Video panel.
const DEFAULT_LANDING_VIDEO = 'https://youtu.be/ViB1YJVlIFk';

export default function Landing() {
  const { PROFILE, CATEGORIES } = useContent();
  const { openCategory } = usePhase();

  // Prefer the user-configured featured video, fall back to the default.
  const videoUrl = (PROFILE.featuredVideo && PROFILE.featuredVideo.trim()) || DEFAULT_LANDING_VIDEO;

  // Menu data — "All" pseudo-item prepended to the live Supabase topics.
  // `id` for "All" is the sentinel from PhaseProvider; everything else is
  // the real topic id used by the Gallery filter in Chunk F.
  const menuItems = [
    { id: CATEGORY_ALL, label: 'All' },
    ...CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
  ];

  return (
    <motion.div
      key="landing"
      className="fixed inset-0 z-[90] overflow-hidden bg-black text-white select-none"
      initial={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
      // Cinematic dive-in: camera shoves forward (scale 1 → 1.35) while the
      // image goes soft (blur 0 → 20px) and dissolves to black (opacity
      // 1 → 0). Ease curve starts slow, accelerates at the end for the
      // classic "snap into the void" feel.
      exit={{
        opacity: 0,
        scale: 1.35,
        filter: 'blur(20px)',
        transition: { duration: 1.0, ease: [0.65, 0, 0.35, 1] },
      }}
      style={{ transformOrigin: 'center center' }}
    >
      {/* 1. Background video — z-0. Starts at opacity 0, fades to 1 when
             react-player reports `onReady`. */}
      <BackgroundVideo url={videoUrl} />

      {/* 2. Dark gradient overlay — transparent at top, deep blue-black at
             the bottom. Keeps the menu + brand legible over bright footage. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(to bottom, rgba(5,10,25,0) 0%, rgba(5,10,25,0) 45%, rgba(5,10,25,0.25) 72%, rgba(5,10,25,0.4) 100%)',
        }}
      />

      {/* 3 + 4. Bottom stack — brand name, role, and category menu share a
             single flex-column container anchored near the lower third of
             the viewport. The brand pair carries layoutIds so Framer morphs
             them in from the Intro's centered position; the menu fades /
             slides up with a left-to-right stagger right below. */}
      <div className="absolute inset-x-0 bottom-8 sm:bottom-12 flex flex-col items-center gap-4 sm:gap-6 text-center px-6">
        <motion.h1
          layoutId={LAYOUT_ID_BRAND_NAME}
          transition={{ duration: MORPH_DURATION, ease: MORPH_EASE }}
          className="
            font-hand font-normal text-white
            text-[clamp(1.75rem,4vw,2.75rem)]
            leading-[1.05] tracking-[0.005em]
            [text-shadow:0_1px_24px_rgba(0,0,0,0.6)]
            pointer-events-none
          "
        >
          {PROFILE.name || 'Natthawut Niyomrot'}
        </motion.h1>

        <motion.p
          layoutId={LAYOUT_ID_BRAND_ROLE}
          transition={{ duration: MORPH_DURATION, ease: MORPH_EASE }}
          className="
            -mt-2 sm:-mt-3
            font-sans font-semibold text-white/85
            text-[clamp(0.7rem,1.05vw,0.85rem)]
            tracking-[0.22em] uppercase
            [text-shadow:0_1px_10px_rgba(0,0,0,0.6)]
            pointer-events-none
          "
        >
          {PROFILE.role || 'Director / Cinematographer'}
        </motion.p>

        <nav className="mt-2 sm:mt-3">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 sm:gap-x-7 md:gap-x-8 max-w-4xl">
            {menuItems.map((item, i) => (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.7,
                  ease: [0.16, 1, 0.3, 1],
                  delay: MENU_BASE_DELAY + i * MENU_STEP,
                }}
              >
                <button
                  type="button"
                  onClick={() => openCategory(item.id)}
                  className="
                    group relative inline-flex items-center
                    px-1 py-1.5
                    text-white/85 hover:text-white
                    text-[clamp(0.7rem,1vw,0.85rem)]
                    tracking-[0.12em]
                    font-medium
                    transition-colors duration-300
                    focus:outline-none focus-visible:text-white
                  "
                >
                  <span className="relative z-10 whitespace-nowrap">
                    {item.label}
                  </span>
                  {/* Animated underline — swells on hover/focus. */}
                  <span
                    aria-hidden="true"
                    className="
                      absolute left-1/2 -translate-x-1/2 bottom-0
                      h-px w-0 bg-white/70
                      transition-all duration-500 ease-out
                      group-hover:w-full group-focus-visible:w-full
                    "
                  />
                </button>
              </motion.li>
            ))}
          </ul>
        </nav>
      </div>
    </motion.div>
  );
}
