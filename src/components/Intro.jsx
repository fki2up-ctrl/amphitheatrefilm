import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useContent } from '../store/content';
import { useSiteSettings } from '../hooks/useSiteSettings';
import {
  LAYOUT_ID_BRAND_NAME,
  LAYOUT_ID_BRAND_ROLE,
} from './Landing';

// ---------------------------------------------------------------------------
// Cinematic intro.
//   Phase 1 (~2.6s) — "I wish to be a light painter"  (focus-pull reveal)
//   Phase 2 (~2.2s) — Name + role fade in (centred)
//   Phase 3 (handoff) — When the intro unmounts, the <h1>/<p> carry a
//                        shared `layoutId` with their twins in Landing, so
//                        Framer Motion smoothly translates + resizes them
//                        to the Landing bottom-center position.
//
// Plays on EVERY visit (per the cinematic-flow spec). Respects
// prefers-reduced-motion by skipping straight to "done".
//
// While visible it locks body scroll; once "done" it unmounts cleanly via
// AnimatePresence and fires `onComplete` so the parent can advance the
// global phase state machine to Landing.
// ---------------------------------------------------------------------------

const PHASE1_MS = 2600; // "I wish to be a light painter"  enter(1.2s) + hold
const PHASE2_MS = 2200; // Name + role — simple fade-in hold

export default function Intro({ onComplete }) {
  const { config } = useSiteSettings();
  const speed = Number(config?.animations?.introSpeed) || 1;

  // 'p1' | 'p2' | 'done'
  const [phase, setPhase] = useState(() => {
    if (typeof window === 'undefined') return 'p1';
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return prefersReduced ? 'done' : 'p1';
  });

  // Advance phases — each phase's hold scales with the introSpeed multiplier
  // so the user can slow the whole intro down (introSpeed > 1) or rush it
  // (< 1) from the editor without redeploying.
  useEffect(() => {
    if (phase === 'done') {
      onComplete?.();
      return;
    }
    if (phase === 'p1') {
      const t = setTimeout(() => setPhase('p2'), PHASE1_MS * speed);
      return () => clearTimeout(t);
    }
    if (phase === 'p2') {
      const t = setTimeout(() => setPhase('done'), PHASE2_MS * speed);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete, speed]);

  // Lock page scroll while the intro is on screen.
  useEffect(() => {
    if (phase === 'done') return;
    const { body, documentElement: html } = document;
    const prevBody = body.style.overflow;
    const prevHtml = html.style.overflow;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';
    return () => {
      body.style.overflow = prevBody;
      html.style.overflow = prevHtml;
    };
  }, [phase]);

  return (
    <AnimatePresence>
      {phase !== 'done' && (
        <motion.div
          key="intro-overlay"
          aria-hidden="true"
          initial={{ opacity: 1 }}
          // Overlay simply fades out; the name/role elements inside carry
          // `layoutId` and migrate to the Landing position via shared
          // layout animation — that IS Phase 3 now.
          exit={{
            opacity: 0,
            transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] },
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{ backgroundColor: '#050505' }}
        >
          {/* Subtle vignette — darkens the edges so the text pops. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 0%, rgba(0,0,0,0.55) 85%, rgba(0,0,0,0.9) 100%)',
            }}
          />

          <AnimatePresence mode="wait">
            {phase === 'p1' && <PhaseOne key="p1" />}
            {phase === 'p2' && <PhaseTwo key="p2" />}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Phase 1 — Focus-pull reveal of the tagline.
// ---------------------------------------------------------------------------
function PhaseOne() {
  const { PROFILE } = useContent();
  const text =
    (PROFILE.introTagline && PROFILE.introTagline.trim()) ||
    (PROFILE.tagline && PROFILE.tagline.trim()) ||
    'I wish to be a light painter';
  const scale = Number(PROFILE.introTaglineScale) || 1;
  const tracking = PROFILE.introTaglineTracking || '0.01em';
  return (
    <motion.p
      initial={{ opacity: 0, filter: 'blur(25px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(12px)', transition: { duration: 0.6, ease: 'easeIn' } }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      style={{
        fontSize: `calc(clamp(1.5rem, 4.2vw, 2.75rem) * ${scale})`,
        letterSpacing: tracking,
      }}
      className="
        relative z-10
        font-sans font-light
        text-white/90
        text-center px-6
        leading-[1.15]
        [text-shadow:0_1px_24px_rgba(0,0,0,0.4)]
        select-none
      "
    >
      {text}
    </motion.p>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 — Brand name in a handwritten script. Static, sized to match the
// Phase 1 tagline so the two screens feel typographically twinned.
// ---------------------------------------------------------------------------

function PhaseTwo() {
  const { PROFILE } = useContent();

  // Keep the easing/duration for the layout morph consistent with Landing's
  // matching motion.* elements so the handoff feels like one continuous
  // movement rather than two separate animations stitched together.
  const MORPH_EASE = [0.4, 0, 0.2, 1];
  const MORPH_DURATION = 1.1;

  const nameText =
    (PROFILE.introName && PROFILE.introName.trim()) ||
    PROFILE.name ||
    'Natthawut Niyomrot';
  const nameScale = Number(PROFILE.introNameScale) || 1;
  const nameTracking = PROFILE.introNameTracking || '0.005em';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      className="relative z-10 text-center px-6 select-none"
    >
      <motion.h1
        layoutId={LAYOUT_ID_BRAND_NAME}
        transition={{ duration: MORPH_DURATION, ease: MORPH_EASE }}
        style={{
          fontSize: `calc(clamp(2rem, 5.6vw, 3.75rem) * ${nameScale})`,
          letterSpacing: nameTracking,
        }}
        className="
          font-hand font-normal
          text-white
          leading-[1.1]
          [text-shadow:0_1px_24px_rgba(255,235,200,0.14)]
        "
      >
        {nameText}
      </motion.h1>

      <motion.p
        layoutId={LAYOUT_ID_BRAND_ROLE}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 0.55, y: 0 }}
        transition={{ duration: MORPH_DURATION, ease: MORPH_EASE, delay: 0.5 }}
        className="
          mt-4 sm:mt-5
          font-sans font-light
          text-white/60
          text-[clamp(0.72rem,1.3vw,0.85rem)]
          tracking-[0.3em] uppercase
        "
      >
        {PROFILE.role || 'Director / Cinematographer'}
      </motion.p>
    </motion.div>
  );
}
