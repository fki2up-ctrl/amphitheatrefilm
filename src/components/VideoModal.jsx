import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ExternalLink } from 'lucide-react';
import { resolveEmbed } from '../lib/embed';

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

  return (
    <AnimatePresence>
      {project && info && (
        <motion.div
          key="overlay"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(20px)' }}
          exit={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4 sm:p-8"
          onClick={onClose}
          style={{ WebkitBackdropFilter: 'blur(20px)' }}
        >
          {/* header */}
          <div className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-start justify-between gap-6 text-white/80">
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest2 uppercase text-white/45">
                {project.categoryLabel}
              </p>
              <h3 className="font-display mt-1 text-xl sm:text-2xl leading-tight truncate">
                {project.title}
              </h3>
              {project.subtitle && (
                <p className="mt-0.5 text-xs text-white/55 truncate">
                  {project.subtitle}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={project.url}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full text-xs border border-white/15 hover:border-white/40 hover:text-white text-white/75"
              >
                Open source <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={onClose}
                aria-label="Close"
                className="w-10 h-10 rounded-full border border-white/15 flex items-center justify-center text-white/80 hover:text-white hover:border-white/50 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* player */}
          <motion.div
            key="player"
            // Entry: slide up from bottom + start blurred, become sharp.
            initial={{ opacity: 0, y: 120, filter: 'blur(24px)' }}
            animate={{
              opacity: 1,
              y: 0,
              filter: 'blur(0px)',
              transition: {
                y: { type: 'spring', stiffness: 160, damping: 22, mass: 0.9 },
                opacity: { duration: 0.4, ease: 'easeOut' },
                filter: { duration: 0.55, ease: 'easeOut' },
              },
            }}
            // Exit: blur back out + fade down.
            exit={{
              opacity: 0,
              y: 40,
              filter: 'blur(24px)',
              transition: { duration: 0.35, ease: [0.4, 0, 1, 1] },
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-6xl"
          >
            <PlayerFrame info={info} title={project.title} />
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PlayerFrame({ info, title }) {
  // Instagram's embed iframe ships its own chrome + caption, so we give it a
  // taller / narrower frame and a dark card. YouTube / Vimeo run at 16:9.
  if (info.kind === 'instagram') {
    return (
      <div
        className="mx-auto bg-white rounded-xl overflow-hidden shadow-2xl"
        style={{
          aspectRatio: '9 / 16',
          // Honour aspect ratio: width is either the natural 9:16 of available
          // height (85vh) or the max 480 px cap — whichever is smaller.
          width: 'min(480px, 100%, calc(85vh * 9 / 16))',
        }}
      >
        <iframe
          src={info.embedUrl}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          scrolling="no"
          className="w-full h-full border-0"
        />
      </div>
    );
  }

  return (
    <div
      className="mx-auto rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10"
      style={{
        aspectRatio: '16 / 9',
        // Honour aspect ratio: clamp width to whichever is smaller — the
        // container's 100 % or the width that produces 85 vh at 16:9. This
        // prevents YouTube from letterboxing the video with black bars.
        width: 'min(100%, calc(85vh * 16 / 9))',
      }}
    >
      <iframe
        src={info.embedUrl}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className="w-full h-full border-0"
      />
    </div>
  );
}
