// ---------------------------------------------------------------------------
// CinematicCarousel — a 5-card horizontally-scrolling, focused project
// carousel for the Landing hero page.
//
// Layout (back → front z-order, left → right):
//   L2 · L1 · [CENTER] · R1 · R2
//
// - CENTER card: full size, fully opaque, cinematic title overlay.
// - L1 / R1: 75% scale, 55% opacity — immediately adjacent.
// - L2 / R2: 75% scale, 30% opacity — partially clipped at screen edge.
// - L2 left edge + R2 right edge: soft gradient mask to bleed into bg.
//
// Interaction:
//   - Drag / swipe left or right → advances focus card.
//   - Click any visible card → opens that project (onOpen prop).
//   - Dot indicator strip below for quick jump.
//
// Data: reads `FAVORITES` from useContent(). Returns null when empty.
// ---------------------------------------------------------------------------

import { useState, useRef } from 'react';
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion';
import { Play } from 'lucide-react';
import { useContent } from '../store/content';
import {
  optimizeCloudinaryUrl,
  cloudinaryPlaceholderUrl,
} from '../utils/cloudinary';

// ─── constants ───────────────────────────────────────────────────────────────

const THUMB_W        = 800;   // cloudinary optimisation width
const CENTER_W       = 220;   // px — center card width (mobile-tuned)
const SIDE_SCALE     = 0.72;  // scale applied to L1/R1/L2/R2
const SIDE_W         = CENTER_W * SIDE_SCALE;
const GAP            = 10;    // px gap between cards
const DRAG_THRESHOLD = 45;    // px offset to trigger advance

// Offset of each slot (0 = center) relative to the center card's left edge.
// Slots: -2, -1, 0, +1, +2
function slotX(slot) {
  if (slot === 0) return 0;
  const dir = slot > 0 ? 1 : -1;
  const abs = Math.abs(slot);
  // slot ±1: center card half + gap + half of side card
  if (abs === 1) return dir * (CENTER_W / 2 + GAP + SIDE_W / 2);
  // slot ±2: slot ±1 position + side card width + gap
  return dir * (CENTER_W / 2 + GAP + SIDE_W + GAP + SIDE_W / 2);
}

// ─── single card ─────────────────────────────────────────────────────────────

function CarouselCard({ project, slot, onOpen }) {
  const isCenter = slot === 0;
  const [loaded, setLoaded] = useState(false);

  const rawSrc      = project.thumbnail || '';
  const optimized   = optimizeCloudinaryUrl(rawSrc, THUMB_W);
  const placeholder = cloudinaryPlaceholderUrl(rawSrc);

  // Visual properties derived from slot position
  const opacity   = isCenter ? 1 : Math.abs(slot) === 1 ? 0.55 : 0.28;
  const zIndex    = isCenter ? 10 : Math.abs(slot) === 1 ? 5 : 1;
  const width     = isCenter ? CENTER_W : SIDE_W;

  return (
    <motion.div
      layout
      style={{
        position:   'absolute',
        left:       '50%',
        top:        0,
        width,
        x:          slotX(slot) - width / 2,
        opacity,
        zIndex,
        aspectRatio: '5/4',
      }}
      animate={{ opacity, x: slotX(slot) - width / 2 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
    >
      {/* Edge fade mask for outermost cards */}
      {slot === -2 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-20 pointer-events-none rounded-2xl"
          style={{
            background: 'linear-gradient(to right, rgba(0,0,0,0.92) 0%, transparent 60%)',
          }}
        />
      )}
      {slot === 2 && (
        <div
          aria-hidden="true"
          className="absolute inset-0 z-20 pointer-events-none rounded-2xl"
          style={{
            background: 'linear-gradient(to left, rgba(0,0,0,0.92) 0%, transparent 60%)',
          }}
        />
      )}

      <motion.button
        onClick={() => onOpen && onOpen(project)}
        whileTap={{ scale: 0.96 }}
        className="group relative w-full h-full overflow-hidden rounded-2xl bg-black/60 border border-white/10 shadow-[0_8px_40px_rgba(0,0,0,0.7)] text-left"
        style={{ touchAction: 'pan-y' }}
      >
        {/* LQIP blur-up */}
        {placeholder && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center scale-[1.04] transition-opacity duration-500"
            style={{
              backgroundImage:    `url(${placeholder})`,
              backgroundPosition: project.imagePosition || '50% 50%',
              filter:             'blur(8px)',
              opacity:            loaded ? 0 : 1,
            }}
          />
        )}

        {/* Thumbnail */}
        <img
          src={optimized}
          alt={project.title}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={(e) => {
            const src = e.currentTarget.src;
            if (src.includes('maxresdefault'))
              e.currentTarget.src = src.replace('maxresdefault', 'hqdefault');
          }}
          className="absolute inset-0 w-full h-full object-cover transition-[transform,opacity] duration-700 group-hover:scale-[1.03]"
          style={{
            objectPosition: project.imagePosition || '50% 50%',
            opacity:        !placeholder || loaded ? 1 : 0,
          }}
        />

        {/* Cinematic gradient for text legibility — only on center card */}
        {isCenter && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
        )}

        {/* Play chip */}
        <div
          className={[
            'absolute top-2.5 right-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center transition-opacity duration-300',
            isCenter
              ? 'w-9 h-9 opacity-90 group-hover:opacity-100'
              : 'w-7 h-7 opacity-60',
          ].join(' ')}
        >
          <Play className={`fill-white text-white translate-x-[1px] ${isCenter ? 'w-3.5 h-3.5' : 'w-2.5 h-2.5'}`} />
        </div>

        {/* Meta — title + subtitle, only on center card */}
        {isCenter && (
          <div className="absolute inset-x-0 bottom-0 px-3.5 pb-4">
            <p className="text-white font-semibold text-[13px] leading-[1.2] tracking-[-0.01em] line-clamp-2 [text-shadow:0_1px_6px_rgba(0,0,0,0.8)]">
              {project.title}
            </p>
            {project.subtitle && (
              <p className="mt-1 text-white/65 text-[11px] leading-snug line-clamp-1">
                {project.subtitle}
              </p>
            )}
          </div>
        )}
      </motion.button>
    </motion.div>
  );
}

// ─── main carousel ────────────────────────────────────────────────────────────

export default function CinematicCarousel({ onOpen }) {
  const { FAVORITES } = useContent();
  const [activeIdx, setActiveIdx]  = useState(0);
  const dragStartX                 = useRef(0);
  const isDragging                 = useRef(false);

  if (!FAVORITES || FAVORITES.length === 0) return null;

  const count   = FAVORITES.length;
  const safeIdx = Math.min(activeIdx, count - 1);

  const goTo = (i) => setActiveIdx(Math.max(0, Math.min(i, count - 1)));

  // Map each slot offset [-2…+2] to the project index (wrapping).
  const projectAt = (slot) => {
    const idx = ((safeIdx + slot) % count + count) % count;
    return FAVORITES[idx];
  };

  // ── drag logic ──
  const handlePointerDown = (e) => {
    dragStartX.current = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    isDragging.current = false;
  };

  const handlePointerMove = (e) => {
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? 0;
    if (Math.abs(x - dragStartX.current) > 8) isDragging.current = true;
  };

  const handlePointerUp = (e) => {
    if (!isDragging.current) return;
    const x     = e.clientX ?? e.changedTouches?.[0]?.clientX ?? 0;
    const delta = x - dragStartX.current;
    if (delta < -DRAG_THRESHOLD) goTo(safeIdx + 1);
    else if (delta > DRAG_THRESHOLD) goTo(safeIdx - 1);
    isDragging.current = false;
  };

  const handleCardClick = (slot, project) => {
    if (isDragging.current) return;
    if (slot !== 0) {
      // Side card tap → slide to it
      goTo(((safeIdx + slot) % count + count) % count);
    } else {
      onOpen && onOpen(project);
    }
  };

  // visible slots
  const slots = [-2, -1, 0, 1, 2];

  // Track height = CENTER_W * (4/5)
  const trackH = Math.round(CENTER_W * (4 / 5));

  return (
    <div className="w-full flex flex-col items-center gap-3 select-none">
      {/* ── track (overflow-visible so full-height 9:16 cards are never clipped) ── */}
      <div
        className="relative w-full"
        style={{ height: trackH, overflow: 'visible' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onTouchStart={(e) => handlePointerDown(e.touches[0])}
        onTouchMove={(e) => handlePointerMove(e.touches[0])}
        onTouchEnd={(e) => handlePointerUp(e.changedTouches[0])}
      >
        {slots.map((slot) => {
          const project = projectAt(slot);
          return (
            <div
              key={`${slot}-${safeIdx}`}
              onClick={() => handleCardClick(slot, project)}
              style={{ cursor: 'pointer' }}
            >
              <CarouselCard
                project={project}
                slot={slot}
                onOpen={slot === 0 ? onOpen : () => goTo(((safeIdx + slot) % count + count) % count)}
              />
            </div>
          );
        })}
      </div>

      {/* Screen-edge fades — outside the track so they're not clipped */}
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-16 pointer-events-none z-30"
        style={{ background: 'linear-gradient(to right, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-y-0 right-0 w-16 pointer-events-none z-30"
        style={{ background: 'linear-gradient(to left, rgba(0,0,0,0.85) 0%, transparent 100%)' }}
      />

      {/* ── dot indicators ── */}
      {count > 1 && (
        <div className="flex items-center justify-center gap-1.5">
          {FAVORITES.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to featured project ${i + 1}`}
              className={[
                'h-1 rounded-full transition-all duration-300',
                i === safeIdx
                  ? 'w-6 bg-white/85'
                  : 'w-1.5 bg-white/25 hover:bg-white/45',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
