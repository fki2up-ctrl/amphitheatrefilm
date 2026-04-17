import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { useContent } from '../store/content';
import { resolveEmbed } from '../lib/embed';

// Derive a reasonable poster image when none is supplied.
function autoPoster(url) {
  const yt = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`;
  return '';
}

// Full-width hero showreel shown above the project grid when PROFILE
// .featuredVideo is set. Click → plays the embed inline (YouTube / Vimeo /
// Instagram auto-detected). Hidden entirely if no URL is configured.
export default function FeaturedVideo({ onOpen }) {
  const { PROFILE } = useContent();
  const [playing, setPlaying] = useState(false);

  const url = PROFILE.featuredVideo;
  if (!url) return null;

  const info = resolveEmbed(url);
  const poster = PROFILE.featuredVideoPoster || autoPoster(url);
  const title = PROFILE.featuredVideoTitle || 'Featured';

  // Instagram iframes carry their own chrome — for them we route the click
  // to the global VideoModal instead of playing inline (keeps the hero clean).
  const inlineSupported = info.kind === 'youtube' || info.kind === 'vimeo';

  const handleClick = () => {
    if (inlineSupported) {
      setPlaying(true);
    } else if (onOpen) {
      // Fabricate a project-like object for the VideoModal.
      onOpen({
        id: 'featured',
        url,
        title,
        subtitle: '',
        categoryLabel: 'Featured',
      });
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      className="mb-12 sm:mb-16"
    >
      <div
        className="relative w-full overflow-hidden rounded-xl bg-ink-800 ring-1 ring-white/10 cursor-pointer group"
        style={{ aspectRatio: '16 / 9' }}
        onClick={!playing ? handleClick : undefined}
      >
        {!playing ? (
          <>
            {poster && (
              <img
                src={poster}
                alt={title}
                loading="lazy"
                onError={(e) => {
                  const src = e.currentTarget.src;
                  if (src.includes('maxresdefault')) {
                    e.currentTarget.src = src.replace('maxresdefault', 'hqdefault');
                  }
                }}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1400ms] group-hover:scale-[1.02]"
              />
            )}
            {/* Darken for legibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-ink-950/10 to-transparent" />

            {/* Centre play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full border border-white/40 bg-white/10 backdrop-blur-md flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:bg-white/20">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-white text-white translate-x-[1px]" />
              </div>
            </div>

            {/* Title badge */}
            {title && (
              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <p className="text-[10px] tracking-widest2 uppercase text-white/55">
                  Featured
                </p>
                <h2 className="mt-1 text-white text-lg sm:text-2xl leading-tight">
                  {title}
                </h2>
              </div>
            )}
          </>
        ) : (
          <iframe
            src={info.embedUrl + (info.embedUrl.includes('?') ? '&' : '?') + 'autoplay=1'}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            className="absolute inset-0 w-full h-full border-0"
          />
        )}
      </div>
    </motion.section>
  );
}
