// ---------------------------------------------------------------------------
// SmartVideo — branching video renderer.
//
//   • Direct MP4 / WebM / MOV URLs (e.g. Backblaze B2 via Cloudflare CDN)
//     → native HTML5 <video>, zero extra JS, zero UI chrome, fades in on
//       the `canplaythrough` event so there's no black flash.
//   • Anything else (YouTube / Vimeo / Instagram / …)
//     → delegated to react-player with the caller's playerConfig.
//
// While buffering the layer behind is filled with either a blurred poster
// image (if one is supplied) or a dark skeleton, which fades out once the
// video reports it's ready. This eliminates the "black flash → first frame
// pop" that makes video heroes feel cheap.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import ReactPlayer from 'react-player';

// Match file-extension-style direct video URLs. Query strings / fragments are
// tolerated. Anything else falls through to react-player's URL recognisers.
const DIRECT_VIDEO_RE = /\.(mp4|webm|mov|m4v)(\?|#|$)/i;

export function isDirectVideoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return DIRECT_VIDEO_RE.test(url);
}

export default function SmartVideo({
  url,
  muted     = true,
  loop      = true,
  autoPlay  = true,
  controls  = false,
  poster,
  className = '',
  style,
  onReady,
  playerConfig,
}) {
  const [ready, setReady] = useState(false);
  const videoRef = useRef(null);

  const direct = isDirectVideoUrl(url);

  const handleReady = () => {
    setReady(true);
    onReady?.();
  };

  // Safari is strict: the `autoplay` attribute alone is unreliable when the
  // element is wrapped in framer-motion or mounted after hydration. Calling
  // `.play()` imperatively once the element exists satisfies its gesture
  // heuristic (muted + playsinline are already set on the DOM node, which
  // Safari checks at the moment of the play() call).
  useEffect(() => {
    if (!direct || !autoPlay) return;
    const v = videoRef.current;
    if (!v) return;

    // Belt & suspenders: set the Safari-critical properties imperatively.
    // Some Safari versions don't honor React's prop-based `muted` at the
    // right moment, and old iOS needs `webkit-playsinline` too.
    v.muted = muted;
    v.defaultMuted = muted;
    v.playsInline = true;
    v.setAttribute('playsinline', '');
    v.setAttribute('webkit-playsinline', '');

    const tryPlay = async () => {
      try {
        // Force Safari to (re)load the src before play() — it otherwise
        // treats the element as "not ready" if src was set after mount.
        v.load();
        await v.play();
        // eslint-disable-next-line no-console
        console.info('[SmartVideo] autoplay started:', url);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[SmartVideo] autoplay blocked:', err?.name, err?.message, url);
        // Flip ready so at least the poster / skeleton appears instead of
        // a black hole. User can tap anywhere to recover on iOS.
        handleReady();
      }
    };

    // Defer one frame so Safari sees the fully-attributed element.
    const id = requestAnimationFrame(tryPlay);

    // On iOS, tapping anywhere is a user gesture that resumes playback if
    // the initial autoplay was blocked.
    const onGesture = () => {
      if (v.paused) tryPlay();
    };
    window.addEventListener('touchstart', onGesture, { once: true, passive: true });
    window.addEventListener('click',      onGesture, { once: true });

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('touchstart', onGesture);
      window.removeEventListener('click',      onGesture);
    };
  }, [direct, autoPlay, url, muted]);

  if (!url) return null;

  return (
    <div className={`relative w-full h-full ${className}`} style={style}>
      {/* Skeleton / blur-up placeholder. Shown while the video buffers, fades
          out once `ready` flips. If a poster is supplied we blur it up; else
          a flat dark layer. */}
      {!ready && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-ink-900"
          style={
            poster
              ? {
                  backgroundImage:    `url(${poster})`,
                  backgroundSize:     'cover',
                  backgroundPosition: 'center',
                  filter:             'blur(16px)',
                  transform:          'scale(1.08)',
                }
              : undefined
          }
        />
      )}

      {direct ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 w-full h-full"
        >
          {/* Plain <video> (not motion.video) — Safari's autoplay heuristic
              inspects the element's attributes at the moment play() is
              called, so we keep the element static and let the parent div
              animate opacity. */}
          <video
            ref={videoRef}
            poster={poster}
            autoPlay={autoPlay}
            muted={muted}
            loop={loop}
            controls={controls}
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            preload="auto"
            disableRemotePlayback
            onPlaying={handleReady}
            onLoadedData={handleReady}
            onError={handleReady}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover' }}
          >
            {/* Using a <source> child (instead of `src` attribute) works
                more reliably with Safari's autoplay + preload heuristics. */}
            <source src={url} type={url.endsWith('.webm') ? 'video/webm' : 'video/mp4'} />
          </video>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: ready ? 1 : 0 }}
          transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
          className="absolute inset-0 w-full h-full"
        >
          <ReactPlayer
            url={url}
            playing={autoPlay}
            loop={loop}
            muted={muted}
            width="100%"
            height="100%"
            playsinline
            controls={controls}
            config={playerConfig}
            onReady={handleReady}
            onError={handleReady}
            style={{ pointerEvents: controls ? 'auto' : 'none' }}
          />
        </motion.div>
      )}
    </div>
  );
}
