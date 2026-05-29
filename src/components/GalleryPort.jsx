// ---------------------------------------------------------------------------
// GalleryPort — asymmetric "Bento Box" CSS Grid with dense auto-flow.
//
// Layout philosophy:
//   A scattered, editorial film-negative feel created by mixing three card
//   sizes on a 4-column (desktop) / 2-column (mobile) grid with
//   `grid-auto-flow: dense` so the engine back-fills gaps automatically.
//
//   Card types:
//     Hero     — is_favorite projects. col-span-2, row-span-2.
//     Vertical — 9:16 or 4:5 aspect ratio videos. col-span-1, row-span-2.
//     Normal   — everything else. col-span-1, row-span-1.
//
// Data interleaving:
//   Heroes and standards are zipped: [H, S, S, S, H, S, S, S, …]
//   so hero cards are evenly distributed through the grid rather than
//   clumped at the top.
// ---------------------------------------------------------------------------

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useContent } from '../store/content';
import {
  optimizeCloudinaryUrl,
  cloudinaryPlaceholderUrl,
} from '../utils/cloudinary';

// ─── constants ───────────────────────────────────────────────────────────────

const THUMB_W = 900;

// Aspect ratios that qualify as "vertical" content.
const VERTICAL_RATIOS = new Set(['9/16', '4/5', '3/4', '2/3']);

// ─── data helpers ────────────────────────────────────────────────────────────

/** Classify a single project into hero / vertical / normal. */
function classifyProject(p) {
  if (p.is_favorite) return 'hero';
  const ratio = (p.videoAspectRatio || '16/9').replace(/\s/g, '');
  if (VERTICAL_RATIOS.has(ratio)) return 'vertical';
  return 'normal';
}

/**
 * Interleave heroes and standards:
 *   [Hero, Std, Std, Std, Hero, Std, Std, Std, …]
 * If one list runs out, the remainder of the other is appended.
 */
function interleave(heroes, standards) {
  const out = [];
  let hi = 0;
  let si = 0;
  const STRIDE = 3; // number of standards between each hero

  while (hi < heroes.length || si < standards.length) {
    if (hi < heroes.length) out.push(heroes[hi++]);
    for (let n = 0; n < STRIDE && si < standards.length; n++) {
      out.push(standards[si++]);
    }
  }
  return out;
}

// ─── grid item span classes ─────────────────────────────────────────────────

function spanClasses(type) {
  switch (type) {
    case 'hero':     return 'col-span-2 row-span-2';
    case 'vertical': return 'col-span-1 row-span-2';
    default:         return 'col-span-1 row-span-1';
  }
}

// ─── single grid cell ───────────────────────────────────────────────────────

function BentoCell({ project, type, index, onOpen }) {
  const [loaded, setLoaded] = useState(false);

  const rawSrc      = project.thumbnail || '';
  const optimized   = optimizeCloudinaryUrl(rawSrc, THUMB_W);
  const placeholder = cloudinaryPlaceholderUrl(rawSrc);

  // Sequential editorial index — zero-padded to 2 digits.
  const seqLabel = String(index + 1).padStart(2, '0');

  return (
    <motion.button
      onClick={() => onOpen && onOpen(project)}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: 0.6,
        delay: Math.min(index, 8) * 0.04,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={`
        group relative overflow-hidden bg-black text-left
        ${spanClasses(type)}
      `}
      style={{ containerType: 'inline-size' }}
    >
      {/* ─ LQIP blur-up placeholder ─ */}
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

      {/* ─ Thumbnail ─ */}
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
        className="absolute inset-0 w-full h-full object-cover transition-[transform,opacity] duration-[1200ms] group-hover:scale-[1.05]"
        style={{
          objectPosition: project.imagePosition || '50% 50%',
          opacity:        !placeholder || loaded ? 1 : 0,
        }}
      />

      {/* ─ Bottom gradient ─ */}
      <div
        className="absolute inset-0 opacity-80 group-hover:opacity-95 transition-opacity duration-500"
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 35%, transparent 65%)',
        }}
      />

      {/* ─ Editorial sequence number (top-left) ─ */}
      <span
        className="
          absolute top-2.5 left-3
          font-mono text-[10px] tracking-[0.25em] uppercase
          text-white/35 group-hover:text-white/55
          transition-colors duration-300
          select-none pointer-events-none
        "
      >
        {seqLabel}
      </span>

      {/* ─ Play chip (top-right) ─ */}
      <div
        className="
          absolute top-2.5 right-2.5
          w-8 h-8 rounded-full
          bg-white/10 backdrop-blur-md border border-white/15
          flex items-center justify-center
          opacity-0 group-hover:opacity-100
          translate-y-1 group-hover:translate-y-0
          transition-all duration-400
        "
      >
        <Play className="w-3 h-3 fill-white text-white translate-x-[1px]" />
      </div>

      {/* ─ Meta overlay (bottom) ─ */}
      <div
        className="absolute inset-x-0 bottom-0"
        style={{ padding: 'clamp(0.5rem, 3.5cqw, 1rem)' }}
      >
        <h3
          className="
            text-white font-medium leading-[1.12]
            tracking-[-0.01em] line-clamp-2
            text-[clamp(0.72rem,5cqw,1.15rem)]
          "
        >
          {project.title}
        </h3>
        {project.subtitle && (
          <p
            className="
              text-white/50 leading-snug line-clamp-1
              text-[clamp(0.58rem,2.8cqw,0.78rem)]
            "
            style={{ marginTop: 'clamp(0.15rem, 1cqw, 0.35rem)' }}
          >
            {project.subtitle}
          </p>
        )}
      </div>

      {/* ─ Hero badge (small, subtle) ─ */}
      {type === 'hero' && (
        <span
          className="
            absolute top-2.5 left-3 mt-4
            font-mono text-[8px] tracking-[0.3em] uppercase
            text-amber-400/50
            select-none pointer-events-none
          "
        >
          featured
        </span>
      )}
    </motion.button>
  );
}

// ─── main component ──────────────────────────────────────────────────────────

export default function GalleryPort({ onOpen, filterCategoryId }) {
  const { ALL_PROJECTS, CATEGORIES } = useContent();

  // Optionally filter to a single category.
  const pool = useMemo(() => {
    if (!filterCategoryId) return ALL_PROJECTS;
    return ALL_PROJECTS.filter((p) => p.categoryId === filterCategoryId);
  }, [ALL_PROJECTS, filterCategoryId]);

  // Classify, separate, interleave.
  const items = useMemo(() => {
    const classified = pool.map((p) => ({
      ...p,
      _gridType: classifyProject(p),
    }));
    const heroes    = classified.filter((c) => c._gridType === 'hero');
    const standards = classified.filter((c) => c._gridType !== 'hero');
    return interleave(heroes, standards);
  }, [pool]);

  if (items.length === 0) {
    return (
      <div className="text-center text-sm text-white/40 py-24">
        No projects to display.
      </div>
    );
  }

  return (
    <section aria-label="Project Gallery">
      {/* The 1px gap + bg-neutral-900 container creates the film-negative
          border effect between black cells. */}
      <div
        className="
          grid
          grid-cols-2      md:grid-cols-4
          auto-rows-[130px] md:auto-rows-[220px]
          gap-[1px]
          bg-neutral-900
        "
        style={{ gridAutoFlow: 'row dense' }}
      >
        {items.map((item, i) => (
          <BentoCell
            key={item.id || i}
            project={item}
            type={item._gridType}
            index={i}
            onOpen={onOpen}
          />
        ))}
      </div>
    </section>
  );
}
