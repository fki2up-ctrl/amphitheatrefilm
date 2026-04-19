// ---------------------------------------------------------------------------
// BackgroundVideo — a zero-UI fullscreen video that fills the viewport like
// a CSS background-image (object-cover). Designed for the Landing hero so
// the portfolio opens on a living, cinematic canvas.
//
// Supports:
//   • YouTube / youtu.be share links  (via youtube-nocookie.com + aggressive
//                                      player-var config that hides every
//                                      last bit of native YT chrome).
//   • Cloudinary mp4 / webm URLs       (HTML5 <video> via react-player).
//   • Any direct video URL react-player recognises.
//
// Hardening the YouTube embed:
//   1. Host swapped to youtube-nocookie.com (no analytics, no related-videos
//      pulled from your watch history).
//   2. playerVars = { controls:0, autoplay:1, mute:1, loop:1, playlist:<id>,
//      modestbranding:1, rel:0, showinfo:0, iv_load_policy:3, disablekb:1,
//      fs:0, playsinline:1 }.
//      - `playlist: <id>` is required for loop to work on a single video.
//      - `rel:0` keeps the "up next" panel from appearing on pause.
//      - `iv_load_policy:3` disables video annotations.
//      - `disablekb:1` blocks spacebar play/pause when focused.
//   3. The iframe is wrapped in an over-scaled container (default scale 1.35)
//      so the tiny YouTube watermark that plays briefly at the start, and
//      the title/branding that occasionally flashes at the end of a video,
//      both fall outside the visible viewport.
//
// Fade-in:
//   The outer wrapper starts at opacity 0 and transitions to 1 only after
//   react-player reports `onReady`. This eliminates the "black flash → first
//   frame pop" hiccup that makes video heroes feel cheap.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { motion } from 'framer-motion';
import ReactPlayer from 'react-player';
import { parseYouTubeId } from '../lib/embed';

const DEBUG = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

export default function BackgroundVideo({
  url,
  scale    = 1.35,
  muted    = true,
  overlay  = false, // draw a subtle dark gradient on top (caller can also
                    // render their own overlay outside)
  className = '',
  onReady,
}) {
  const [ready, setReady] = useState(false);
  const [errored, setErrored] = useState(false);

  // If no URL is configured, render a visible placeholder in dev so the
  // caller can tell at a glance that PROFILE.featuredVideo isn't set. In
  // production this renders nothing (silent fallback to the layer behind).
  if (!url) {
    if (DEBUG) {
      console.warn('[BackgroundVideo] no url provided — set PROFILE.featuredVideo in the Editor');
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black text-white/40 text-xs pointer-events-none">
          BackgroundVideo: no URL set (PROFILE.featuredVideo is empty)
        </div>
      );
    }
    return null;
  }

  const ytId = parseYouTubeId(url);
  if (DEBUG) {
    // One-time diagnostic so it's obvious in the console whether the URL
    // was recognised as YouTube or sent to react-player's file player.
    console.info('[BackgroundVideo] mounting with url =', url, 'ytId =', ytId);
  }

  // react-player YouTube config: host switch + comprehensive playerVars.
  // The `playlist` trick is required for `loop` to loop a single video.
  const youtubeConfig = ytId
    ? {
        youtube: {
          playerVars: {
            controls:       0,
            autoplay:       1,
            mute:           1,
            loop:           1,
            playlist:       ytId,
            modestbranding: 1,
            rel:            0,
            showinfo:       0,
            iv_load_policy: 3,
            disablekb:      1,
            fs:             0,
            playsinline:    1,
            cc_load_policy: 0,
          },
          // Host swap — react-player exposes this via `embedOptions`.
          embedOptions: {
            host: 'https://www.youtube-nocookie.com',
          },
        },
      }
    : undefined;

  const handleReady = () => {
    if (DEBUG) console.info('[BackgroundVideo] onReady fired');
    setReady(true);
    onReady?.();
  };

  const handleError = (err) => {
    console.error('[BackgroundVideo] playback error:', err);
    setErrored(true);
    // Still flip "ready" so the fade-in overlay lifts rather than hanging
    // on a black screen forever.
    setReady(true);
    onReady?.();
  };

  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden bg-black ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: ready ? 1 : 0 }}
      transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Inner stage — centred, scaled up, sized with the classic
          max(100vw, 177.78vh) / max(100vh, 56.25vw) trick so the 16:9 video
          truly covers the viewport regardless of aspect (portrait, square,
          ultrawide, etc.). */}
      <div
        className="absolute top-1/2 left-1/2"
        style={{
          width:  'max(100vw, 177.78vh)',
          height: 'max(100vh, 56.25vw)',
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <ReactPlayer
          url={url}
          playing
          loop
          muted={muted}
          width="100%"
          height="100%"
          playsinline
          controls={false}
          config={youtubeConfig}
          onReady={handleReady}
          onError={handleError}
          style={{ pointerEvents: 'none' }}
        />

        {DEBUG && errored && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-red-300 text-xs text-center px-6">
            BackgroundVideo: playback error — check the console
          </div>
        )}
      </div>

      {/* Optional dark gradient overlay for text legibility. Callers can opt
          out and render their own; the default is a faint bottom gradient. */}
      {overlay && (
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, rgba(5,8,20,0) 55%, rgba(5,8,20,0.25) 75%, rgba(5,8,20,0.55) 100%)',
          }}
        />
      )}
    </motion.div>
  );
}
