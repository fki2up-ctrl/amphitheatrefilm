// ---------------------------------------------------------------------------
// MobileFeaturedCards — mobile-only swipeable carousel of pinned/favorite
// projects, rendered between the 4:5 BackgroundVideo and the bottom nav on
// the Landing page.
//
// Only visible at < md breakpoint. Desktop visitors see nothing.
// The carousel uses Framer Motion drag gestures for natural finger swiping.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play } from 'lucide-react';
import { useContent } from '../store/content';
import {
  optimizeCloudinaryUrl,
  cloudinaryPlaceholderUrl,
} from '../utils/cloudinary';

const CARD_THUMB_WIDTH = 600;

function FavoriteCard({ project, onOpen }) {
  const rawSrc      = project.thumbnail || '';
  const optimized   = optimizeCloudinaryUrl(rawSrc, CARD_THUMB_WIDTH);
  const placeholder = cloudinaryPlaceholderUrl(rawSrc);
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.button
      onClick={() => onOpen && onOpen(project)}
      whileTap={{ scale: 0.97 }}
      className="relative w-[180px] mx-auto overflow-hidden rounded-2xl bg-black/60 border border-white/15 shadow-[0_8px_32px_rgba(0,0,0,0.6)] text-left shrink-0"
      style={{ aspectRatio: '9/16' }}
    >
      {/* LQIP blur-up placeholder */}
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
          if (src.includes('maxresdefault')) {
            e.currentTarget.src = src.replace('maxresdefault', 'hqdefault');
          }
        }}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        style={{
          objectPosition: project.imagePosition || '50% 50%',
          opacity: !placeholder || loaded ? 1 : 0,
        }}
      />

      {/* Play chip */}
      <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/15 backdrop-blur-md border border-white/20 flex items-center justify-center">
        <Play className="w-3 h-3 fill-white text-white translate-x-[1px]" />
      </div>
    </motion.button>
  );
}

export default function MobileFeaturedCards({ onOpen }) {
  const { FAVORITES } = useContent();
  const [activeIdx, setActiveIdx] = useState(0);

  // Nothing to show — no layout shift, invisible.
  if (!FAVORITES || FAVORITES.length === 0) return null;

  const count = FAVORITES.length;
  const safeIdx = Math.min(activeIdx, count - 1);

  const goTo = (i) => setActiveIdx(Math.max(0, Math.min(i, count - 1)));

  // Drag gesture — swipe left/right to change card.
  const handleDragEnd = (_e, info) => {
    const threshold = 40;
    if (info.offset.x < -threshold) goTo(safeIdx + 1);
    else if (info.offset.x > threshold) goTo(safeIdx - 1);
  };

  return (
    <div className="w-full px-4 flex flex-col gap-2.5">
      {/* Card carousel */}
      <div className="relative w-full overflow-hidden rounded-2xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={safeIdx}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -32 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.12}
            onDragEnd={handleDragEnd}
            className="w-full cursor-grab active:cursor-grabbing"
          >
            <FavoriteCard project={FAVORITES[safeIdx]} onOpen={onOpen} />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Indicator dots — only when more than 1 card */}
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
                  ? 'w-5 bg-white/80'
                  : 'w-1.5 bg-white/25 hover:bg-white/40',
              ].join(' ')}
            />
          ))}
        </div>
      )}
    </div>
  );
}
