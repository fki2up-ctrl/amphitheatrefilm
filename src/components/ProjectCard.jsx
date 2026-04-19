import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import {
  optimizeCloudinaryUrl,
  cloudinaryPlaceholderUrl,
} from '../utils/cloudinary';

// Rendered thumbnail width (card is ~400–600 px at 2× DPR). We request a
// generous 900 so retina screens stay crisp without wasting bandwidth.
const THUMB_WIDTH = 900;

// Premium "pop-up" spring hover effect + 1.43:1 aspect thumbnail.
export default function ProjectCard({ project, index, onOpen }) {
  const rawSrc      = project.thumbnail || '';
  const optimized   = optimizeCloudinaryUrl(rawSrc, THUMB_WIDTH);
  const placeholder = cloudinaryPlaceholderUrl(rawSrc);

  const [loaded, setLoaded] = useState(false);

  return (
    <motion.button
      id={project.id}
      onClick={() => onOpen(project)}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{
        duration: 0.7,
        delay: Math.min(index, 6) * 0.05,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{
        scale: 1.1,
        zIndex: 30,
        transition: { type: 'spring', stiffness: 260, damping: 20 },
      }}
      whileTap={{ scale: 0.98 }}
      className="group relative block text-left rounded-xl overflow-hidden bg-ink-800 ring-1 ring-white/5 shadow-[0_0_0_0_rgba(0,0,0,0)] hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.08)] transition-shadow duration-500 will-change-transform"
      // `containerType: inline-size` turns this button into a *query container*
      // so the title/subtitle below can scale with the card's own width using
      // the `cqw` unit — keeps text perfectly proportioned whatever column
      // count the grid is at (2 / 3 / 4) and at every intermediate width.
      style={{ aspectRatio: '1.43 / 1', containerType: 'inline-size' }}
    >
      {/* Blur-up LQIP: tiny Cloudinary-blurred still painted as background;
          stays behind the real <img> until it finishes decoding. Noop (empty
          background) for non-Cloudinary sources. */}
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

      <img
        src={optimized}
        alt={project.title}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={(e) => {
          // Fall back to hqdefault for YouTube stills when maxres is missing.
          const src = e.currentTarget.src;
          if (src.includes('maxresdefault')) {
            e.currentTarget.src = src.replace('maxresdefault', 'hqdefault');
          }
        }}
        style={{
          objectPosition: project.imagePosition || '50% 50%',
          opacity:        !placeholder || loaded ? 1 : 0,
        }}
        className="absolute inset-0 w-full h-full object-cover transition-[transform,opacity] duration-[1400ms] group-hover:scale-[1.04]"
      />

      {/* gradient for legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

      {/* play chip */}
      <div className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-1.5 group-hover:translate-y-0 transition-all duration-500">
        <Play className="w-3.5 h-3.5 fill-white text-white translate-x-[1px]" />
      </div>

      {/* meta — title & subtitle sized relative to the CARD width (cqw), so
          they scale continuously between every grid breakpoint rather than
          jumping with the viewport. Padding also uses `cqw` so the stack
          stays proportional from 240 px cards up to 500 px cards. */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ padding: 'clamp(0.6rem, 4cqw, 1.15rem)' }}
      >
        <h3 className="text-balance text-white font-medium leading-[1.1] tracking-tight text-[clamp(0.82rem,5.8cqw,1.35rem)] line-clamp-2">
          {project.title}
        </h3>
        {project.subtitle && (
          <p
            className="text-white/65 leading-snug text-[clamp(0.64rem,3.1cqw,0.85rem)] line-clamp-2"
            style={{ marginTop: 'clamp(0.2rem, 1.2cqw, 0.5rem)' }}
          >
            {project.subtitle}
          </p>
        )}
      </div>
    </motion.button>
  );
}
