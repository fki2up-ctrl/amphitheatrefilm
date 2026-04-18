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
      style={{ aspectRatio: '1.43 / 1' }}
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

      {/* meta — hero-style title with subtitle sized to fit the card */}
      <div className="absolute inset-x-0 bottom-0 p-3 sm:p-4 md:p-5">
        <h3 className="text-balance text-white font-medium leading-[1.1] tracking-tight text-[clamp(0.95rem,2.4vw,1.55rem)] line-clamp-2">
          {project.title}
        </h3>
        {project.subtitle && (
          <p className="mt-1 sm:mt-2 text-white/65 leading-snug text-[clamp(0.72rem,1.4vw,0.9rem)] line-clamp-2">
            {project.subtitle}
          </p>
        )}
      </div>
    </motion.button>
  );
}
