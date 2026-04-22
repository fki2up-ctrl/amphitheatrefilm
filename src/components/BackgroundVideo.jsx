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

import { parseYouTubeId } from '../lib/embed';
import SmartVideo, { isDirectVideoUrl } from './SmartVideo';

const DEBUG = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

export default function BackgroundVideo({
  url,
  scale    = 1.35,
  muted    = true,
  overlay  = false, // draw a subtle dark gradient on top (caller can also
                    // render their own overlay outside)
  className = '',
  onReady,
  poster,
}) {
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
  const direct = isDirectVideoUrl(url);
  if (DEBUG) {
    console.info('[BackgroundVideo] mounting with url =', url,
      'ytId =', ytId, 'direct =', direct);
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
          embedOptions: {
            host: 'https://www.youtube-nocookie.com',
          },
        },
      }
    : undefined;

  // For direct MP4/WebM: the browser's native `object-fit: cover` (inside
  // SmartVideo) already fills any viewport regardless of the source's aspect
  // ratio (vertical 9:16, square, 21:9, …). We render the stage at 100% so
  // nothing is pre-cropped — `cover` handles overflow symmetrically.
  //
  // For YouTube embeds we still need the 16:9-padded stage + overscale so
  // the chrome/branding falls outside the viewport. react-player doesn't
  // expose an `object-fit` equivalent for iframes.
  // Use dynamic viewport units (dvh/dvw) so the stage keeps covering the
  // viewport correctly as the mobile browser chrome hides/shows, and across
  // orientation changes. Fallback chain: dvh → svh → vh.
  const directStage = {
    width:  'max(100vw, 100dvw)',
    height: 'max(100vh, 100dvh)',
    minWidth:  '100%',
    minHeight: '100%',
    transform: 'translate(-50%, -50%)',
    transformOrigin: 'center center',
  };
  const iframeStage = {
    width:  'max(100vw, 100dvw, 177.78vh, 177.78dvh)',
    height: 'max(100vh, 100dvh, 56.25vw, 56.25dvw)',
    transform: `translate(-50%, -50%) scale(${scale})`,
    transformOrigin: 'center center',
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden bg-black ${className}`}
    >
      <div
        className="absolute top-1/2 left-1/2"
        style={direct ? directStage : iframeStage}
      >
        <SmartVideo
          url={url}
          muted={muted}
          poster={poster}
          playerConfig={youtubeConfig}
          onReady={onReady}
        />
      </div>

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
    </div>
  );
}
