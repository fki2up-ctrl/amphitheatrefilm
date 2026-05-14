import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { resolveEmbed } from '../lib/embed';
import CinematicPlayer from './CinematicPlayer';

// ---------------------------------------------------------------------------
// Stagger orchestration for the side-panel text elements.
// ---------------------------------------------------------------------------
const panelContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.2 } },
};

const panelChild = {
  hidden: { opacity: 0, y: 12 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

// ---------------------------------------------------------------------------
// VideoModal — cinematic project detail overlay.
//
// Layout:
//   Desktop (≥1024 px): 65 % video | 35 % metadata side-panel
//   Mobile  (<1024 px): stacked — video on top, metadata below
//
// When a project has no metadata (directorNote, credits, releaseUrl all
// empty) the side-panel is hidden and the video takes 100 % width, matching
// the original simple-modal behaviour.
// ---------------------------------------------------------------------------

export default function VideoModal({ project, onClose }) {
  // Close on ESC and lock body scroll while open.
  useEffect(() => {
    if (!project) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [project, onClose]);

  const info = project ? resolveEmbed(project.url) : null;

  const hasMetadata =
    project &&
    ((project.directorNote && project.directorNote.trim()) ||
     (Array.isArray(project.credits) && project.credits.length > 0) ||
     (project.releaseUrl && project.releaseUrl.trim()));

  return (
    <AnimatePresence>
      {project && info && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[80] bg-black/90 flex items-center justify-center"
          onClick={onClose}
          style={{
            top: -1,
            left: -1,
            right: -1,
            bottom: -1,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Close button — always top-right */}
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10 w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/80 hover:text-white hover:border-white/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Main content wrapper — split or full-width */}
          <motion.div
            key="content"
            initial={{ opacity: 0, y: 60, scale: 0.75 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              transition: {
                y:       { type: 'spring', stiffness: 180, damping: 24, mass: 0.8 },
                scale:   { type: 'spring', stiffness: 180, damping: 22, mass: 0.8 },
                opacity: { duration: 0.3, ease: 'easeOut' },
              },
            }}
            exit={{
              opacity: 0,
              scale: 0.88,
              y: 24,
              filter: 'blur(20px)',
              transition: { duration: 0.28, ease: [0.4, 0, 1, 1] },
            }}
            onClick={(e) => e.stopPropagation()}
            className={[
              'relative w-full',
              hasMetadata ? 'max-w-[1400px]' : 'max-w-6xl',
            ].join(' ')}
            style={{
              willChange: 'filter, transform, opacity',
              transform: 'translateZ(0)',
              isolation: 'isolate',
              maxHeight: '92vh',
              padding: 'clamp(16px, 3vw, 32px)',
            }}
          >
            <div
              className={[
                hasMetadata
                  ? 'flex flex-col lg:flex-row gap-0 lg:gap-0 rounded-xl overflow-hidden ring-1 ring-white/10 shadow-2xl bg-ink-950'
                  : '',
              ].join(' ')}
              style={hasMetadata ? { maxHeight: '85vh' } : undefined}
            >
              {/* ---- Video (left / top) ---- */}
              <div
                className={[
                  hasMetadata
                    ? 'lg:w-[65%] shrink-0'
                    : 'w-full',
                ].join(' ')}
              >
                <PlayerFrame info={info} title={project.title} hasPanel={hasMetadata} aspectRatio={project.videoAspectRatio || '16/9'} />
                {info.kind === 'unknown' && (
                  <div className="mt-4 text-center text-sm text-white/60">
                    Could not embed this URL.{' '}
                    <a
                      href={project.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline hover:text-white"
                    >
                      Open it in a new tab
                    </a>
                    .
                  </div>
                )}
              </div>

              {/* ---- Metadata side-panel (right / bottom) ---- */}
              {hasMetadata && (
                <MetadataPanel project={project} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// MetadataPanel — right side on desktop, below on mobile.
// ---------------------------------------------------------------------------
function MetadataPanel({ project }) {
  const credits = Array.isArray(project.credits) ? project.credits.filter(c => c.role || c.name) : [];

  return (
    <motion.div
      className="lg:w-[35%] overflow-y-auto pretty-scroll border-t lg:border-t-0 lg:border-l border-white/10"
      style={{ maxHeight: '85vh' }}
      variants={panelContainer}
      initial="hidden"
      animate="show"
    >
      <div className="p-5 sm:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <motion.div variants={panelChild}>
          <p className="text-[10px] tracking-widest2 uppercase text-white/45 mb-1">
            {project.categoryLabel}
          </p>
          <h3 className="font-display text-xl sm:text-2xl leading-tight text-white">
            {project.title}
          </h3>
          {project.subtitle && (
            <p className="mt-1 text-sm text-white/55">
              {project.subtitle}
            </p>
          )}
        </motion.div>

        {/* Divider */}
        <motion.div variants={panelChild}>
          <div className="h-px bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
        </motion.div>

        {/* Director's Note */}
        {project.directorNote && project.directorNote.trim() && (
          <motion.div variants={panelChild}>
            <p className="text-[13px] leading-relaxed text-white/75 whitespace-pre-line">
              {project.directorNote}
            </p>
          </motion.div>
        )}

        {/* Credits */}
        {credits.length > 0 && (
          <motion.div variants={panelChild}>
            <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-3">
              Credits
            </p>
            <div className="space-y-1.5">
              {credits.map((c, i) => (
                <div key={i} className="flex items-baseline gap-3 text-[13px]">
                  <span className="text-white/40 shrink-0 min-w-[80px]">{c.role}</span>
                  <span className="text-white/85">{c.name}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* External link */}
        {project.releaseUrl && project.releaseUrl.trim() && (
          <motion.div variants={panelChild}>
            <a
              href={project.releaseUrl}
              target="_blank"
              rel="noreferrer"
              className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs border border-white/15 text-white/75 hover:text-white hover:border-white/50 transition-all hover:shadow-[0_0_16px_rgba(255,255,255,0.08)]"
            >
              View Official Release
              <ExternalLink className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </a>
          </motion.div>
        )}

      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// PlayerFrame — renders the correct player for the embed kind.
// ---------------------------------------------------------------------------
function PlayerFrame({ info, title, hasPanel, aspectRatio = '16/9' }) {
  // Direct video files (Backblaze B2, raw .mp4/.webm) — CinematicPlayer
  // so the native controls are replaced by our custom closed-UI bar.
  // No hardcoded aspect ratio — the component reads the video's intrinsic
  // dimensions on loadedmetadata and adapts automatically.
  if (info.kind === 'direct') {
    return (
      <CinematicPlayer
        src={info.embedUrl}
        className={[
          hasPanel ? '' : 'mx-auto rounded-xl shadow-2xl ring-1 ring-white/10',
        ].join(' ')}
      />
    );
  }

  // Instagram: always 9:16 (platform enforces portrait chrome).
  if (info.kind === 'instagram') {
    const ratio = aspectRatio !== '16/9' ? aspectRatio : '9/16';
    return (
      <div
        className={[
          'bg-white overflow-hidden',
          hasPanel ? '' : 'mx-auto rounded-xl shadow-2xl',
        ].join(' ')}
        style={{
          aspectRatio: ratio.replace('/', ' / '),
          width: hasPanel ? '100%' : `min(480px, 100%, calc(85vh * ${evalRatio(ratio)}))`,
        }}
      >
        <iframe
          src={info.embedUrl}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          scrolling="no"
          className="w-full h-full border-0 block"
        />
      </div>
    );
  }

  // YouTube / Vimeo — use the editor-specified ratio.
  return (
    <div
      className={[
        'overflow-hidden bg-black',
        hasPanel ? '' : 'mx-auto rounded-xl shadow-2xl ring-1 ring-white/10',
      ].join(' ')}
      style={{
        aspectRatio: aspectRatio.replace('/', ' / '),
        width: hasPanel ? '100%' : `min(100%, calc(85vh * ${evalRatio(aspectRatio)}))`,
      }}
    >
      <iframe
        src={info.embedUrl}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="w-full h-full border-0 block"
      />
    </div>
  );
}

// '16/9' → 16/9 (number) for width calculations.
function evalRatio(r) {
  const [w, h] = String(r).split('/').map(Number);
  return (w && h) ? w / h : 16 / 9;
}
