import { motion, useScroll, useTransform } from 'framer-motion';

// ---------------------------------------------------------------------------
// StaticGrainOverlay
//
// A fixed, full-screen "film grain" overlay that stays stationary (the
// pattern never animates) while its *opacity* rises as the user scrolls from
// the hero into the project grid. Subtle at rest (~0.05), meaningful once the
// viewer is browsing the work (~0.22).
//
// Grain is generated in-browser via an SVG <feTurbulence> filter encoded as a
// data URI — no external asset, no HTTP request. The pattern tiles via
// background-repeat so it's GPU-cheap.
// ---------------------------------------------------------------------------

// A 200×200 monochrome fractal-noise tile. baseFrequency controls grain size;
// 0.9 is fine-grained "35mm push" territory. Alpha 0.9 in the color-matrix
// keeps mid-tones from blowing out when composited via mix-blend-mode.
const GRAIN_SVG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'>
       <filter id='n'>
         <feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/>
         <feColorMatrix type='matrix' values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.9 0'/>
       </filter>
       <rect width='100%' height='100%' filter='url(#n)'/>
     </svg>`
  );

export default function StaticGrainOverlay() {
  const { scrollY } = useScroll();
  // Map scrollY 0→600px onto opacity 0.15→0.66 (clamped) — 3× the original
  // intensity for a heavier "pushed emulsion" feel.
  const opacity = useTransform(scrollY, [0, 600], [0.15, 0.66], { clamp: true });

  return (
    <motion.div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[5]"
      style={{
        opacity,
        backgroundImage: `url("${GRAIN_SVG}")`,
        backgroundRepeat: 'repeat',
        backgroundSize: '200px 200px',
        // `soft-light` keeps the grain living *on* the image/background
        // without bleaching highlights — closer to real emulsion than
        // `overlay`, which can feel harsh on bright areas.
        mixBlendMode: 'soft-light',
        // Hint the browser we'll be touching opacity frequently.
        willChange: 'opacity',
      }}
    />
  );
}
