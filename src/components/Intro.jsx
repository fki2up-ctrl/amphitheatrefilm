import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Cinematic 3-phase intro.
//   Phase 1 (1.5s) — "I wish to be a light painter"  (focus pull: blur → sharp)
//   Phase 2 (1.5s) — "Amphitheatre Film"              (weight + letter-spacing
//                                                      tightening, light leak)
//   Phase 3 (1.0s) — Dolly-in fade-out (scale 1 → 1.1, opacity 1 → 0)
//
// Plays once per browser session via sessionStorage.introPlayed.
// Respects prefers-reduced-motion by skipping straight to "done".
//
// While visible it locks body scroll; once "done" it unmounts cleanly via
// AnimatePresence.
// ---------------------------------------------------------------------------

const SESSION_KEY = 'introPlayed';

const PHASE1_MS = 2600; // "I wish to be a light painter"  enter(1.2s) + hold
const PHASE2_MS = 2200; // "Amphitheatre Film" — simple fade-in hold
const PHASE3_MS = 1000; // dolly-in fade-out

// Heavyweight cinematic ease (Framer-recommended for "premium" feel).
const DOLLY_EASE = [0.43, 0.13, 0.23, 0.96];

export default function Intro({ onComplete }) {
  // 'p1' | 'p2' | 'done'  — undefined on first paint while we decide.
  const [phase, setPhase] = useState(() => {
    if (typeof window === 'undefined') return 'p1';
    try {
      if (sessionStorage.getItem(SESSION_KEY) === '1') return 'done';
    } catch { /* sessionStorage blocked — still play */ }
    const prefersReduced =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return prefersReduced ? 'done' : 'p1';
  });

  // Advance phases.
  useEffect(() => {
    if (phase === 'done') {
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch {}
      onComplete?.();
      return;
    }
    if (phase === 'p1') {
      const t = setTimeout(() => setPhase('p2'), PHASE1_MS);
      return () => clearTimeout(t);
    }
    if (phase === 'p2') {
      const t = setTimeout(() => setPhase('done'), PHASE2_MS);
      return () => clearTimeout(t);
    }
  }, [phase, onComplete]);

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
          initial={{ opacity: 1, scale: 1 }}
          // Phase 3 plays as the overlay exits — dolly-in + fade.
          exit={{
            opacity: 0,
            scale: 1.1,
            transition: { duration: PHASE3_MS / 1000, ease: DOLLY_EASE },
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
  return (
    <motion.p
      initial={{ opacity: 0, filter: 'blur(25px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(12px)', transition: { duration: 0.6, ease: 'easeIn' } }}
      transition={{ duration: 1.2, ease: 'easeOut' }}
      className="
        relative z-10
        font-sans font-light
        text-white/90
        text-center px-6
        text-[clamp(1.5rem,4.2vw,2.75rem)]
        leading-[1.15] tracking-[0.01em]
        [text-shadow:0_1px_24px_rgba(0,0,0,0.4)]
        select-none
      "
    >
      I wish to be a light painter
    </motion.p>
  );
}

// ---------------------------------------------------------------------------
// Phase 2 — Brand name in a handwritten script. Static, sized to match the
// Phase 1 tagline so the two screens feel typographically twinned.
// ---------------------------------------------------------------------------

function PhaseTwo() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.4, ease: 'easeIn' } }}
      transition={{ duration: 0.9, ease: 'easeOut' }}
      className="relative z-10 text-center px-6 select-none"
    >
      <h1
        className="
          font-hand font-medium
          text-white
          text-[clamp(1.5rem,4.2vw,2.75rem)]
          leading-[1.1] tracking-[0.005em]
          [text-shadow:0_1px_24px_rgba(255,235,200,0.14)]
        "
      >
        Natthawut Niyomrot
      </h1>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 0.55, y: 0 }}
        transition={{ duration: 1.0, ease: 'easeOut', delay: 0.5 }}
        className="
          mt-4 sm:mt-5
          font-sans font-light
          text-white/60
          text-[clamp(0.72rem,1.3vw,0.85rem)]
          tracking-[0.3em] uppercase
        "
      >
        Director / Cinematographer
      </motion.p>
    </motion.div>
  );
}
