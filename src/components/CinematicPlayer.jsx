// ---------------------------------------------------------------------------
// CinematicPlayer — custom closed-UI video player with dynamic aspect ratio.
//
// Sizing contract:
//   • Reads the video's intrinsic videoWidth / videoHeight from `loadedmetadata`.
//   • Landscape (ratio ≥ 1): fills container width → height follows naturally.
//   • Portrait  (ratio < 1): height-capped at 85 vh, width follows → centred.
//   • Before metadata: renders in landscape mode as a safe default.
//
// Zero-Tint rule:
//   NO overlay, dim, or gradient ever touches the video element itself.
//   The only background-gradient is the narrow bar (≈56 px) behind the
//   control icons — it sits below the last video pixel.
//
// Closed-UI rule:
//   No external links, platform logos, or share buttons anywhere.
//
// Auto-hide:
//   Controls fade out 2.5 s after the last mouse movement and re-appear
//   instantly on any mouse activity.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Maximize, Minimize,
  Pause, Play,
  Volume2, VolumeX,
} from 'lucide-react';

// "M:SS" formatter
function fmt(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m  = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

export default function CinematicPlayer({
  src,
  poster,
  className = '',
  style,
}) {
  const videoRef     = useRef(null);
  const containerRef = useRef(null); // inner wrapper — sized to video
  const scrubRef     = useRef(null);
  const hideTimer    = useRef(null);

  const [playing,      setPlaying]      = useState(false);
  const [muted,        setMuted]        = useState(false);
  const [current,      setCurrent]      = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [dragging,     setDragging]     = useState(false);
  const [scrubHover,   setScrubHover]   = useState(false);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [showUI,       setShowUI]       = useState(true);
  // null = not loaded yet; number = videoWidth / videoHeight
  const [intrinsicRatio, setIntrinsicRatio] = useState(null);

  // ── Auto-hide ────────────────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUI(false), 2500);
  }, []);

  const revealUI = useCallback(() => {
    setShowUI(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    scheduleHide();
    return () => clearTimeout(hideTimer.current);
  }, [scheduleHide]);

  // ── Video events ─────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay     = () => setPlaying(true);
    const onPause    = () => setPlaying(false);
    const onTime     = () => setCurrent(v.currentTime);
    const onMeta     = () => {
      setDuration(v.duration);
      if (v.videoWidth && v.videoHeight) {
        setIntrinsicRatio(v.videoWidth / v.videoHeight);
      }
    };
    const onFSChange = () => setFullscreen(!!document.fullscreenElement);

    v.addEventListener('play',             onPlay);
    v.addEventListener('pause',            onPause);
    v.addEventListener('timeupdate',       onTime);
    v.addEventListener('loadedmetadata',   onMeta);
    document.addEventListener('fullscreenchange', onFSChange);

    return () => {
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('loadedmetadata', onMeta);
      document.removeEventListener('fullscreenchange', onFSChange);
    };
  }, []);

  // ── Controls ─────────────────────────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  };

  // ── Scrubber ─────────────────────────────────────────────────────────────
  const getFraction = (clientX) => {
    const rect = scrubRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleScrubClick = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = getFraction(e.clientX) * duration;
    setCurrent(v.currentTime);
  };

  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    const move = (ev) => {
      const v = videoRef.current;
      if (!v || !duration) return;
      v.currentTime = getFraction(ev.clientX) * duration;
      setCurrent(v.currentTime);
    };
    const up = () => {
      setDragging(false);
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup',   up);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup',   up);
  };

  const progress = duration > 0 ? current / duration : 0;

  // ── Sizing ───────────────────────────────────────────────────────────────
  // Portrait = ratio < 1 (e.g. 9:16, 4:5). Default to landscape until we
  // know the real ratio so there's no layout jump on supported browsers that
  // report dimensions synchronously.
  const isPortrait = intrinsicRatio !== null && intrinsicRatio < 1;

  // The <video> element is the sizing driver.
  // Landscape: width fills 100 %, height auto-follows. maxHeight guards against
  //   pathologically tall containers (e.g. squarish in a narrow split-panel).
  // Portrait:  height is capped, width auto-follows.
  const videoStyle = isPortrait
    ? { display: 'block', height: 'auto', maxHeight: '85vh', width: 'auto', maxWidth: '100%' }
    : { display: 'block', width: '100%', height: 'auto', maxHeight: '85vh' };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    // Outer: centres portrait videos; lets landscape fill full width.
    // Receives className/style from the caller (rounded corners, shadow, etc.)
    <div
      className={`flex items-start justify-center overflow-hidden bg-black ${className}`}
      style={style}
      onMouseMove={revealUI}
      onMouseLeave={scheduleHide}
    >
      {/* Inner: shrink-wraps to the video so the control bar
          attaches to the exact bottom edge of the playback area. */}
      <div
        ref={containerRef}
        className="relative"
        // Landscape: fill the flex container; Portrait: auto width.
        style={isPortrait ? {} : { width: '100%' }}
      >
        {/* ── Video — untouched, full brightness, no overlay above it ── */}
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          autoPlay
          playsInline
          loop
          muted={muted}
          controls={false}
          onClick={togglePlay}
          style={videoStyle}
          className="cursor-pointer select-none"
        />

        {/* ── Control bar — gradient behind icons only, never over video ── */}
        <AnimatePresence>
          {(showUI || dragging) && (
            <motion.div
              key="controls"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              // Gradient: 56 px at the bottom, fades to transparent above.
              // It sits in the letterbox / below the last video row — never
              // dimming active picture area.
              className="absolute inset-x-0 bottom-0 px-3 pb-2.5 pt-8 pointer-events-auto"
              style={{
                background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 100%)',
              }}
              onMouseMove={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scrubber */}
              <div
                ref={scrubRef}
                className="w-full mb-2.5 cursor-pointer"
                style={{ paddingTop: 8, paddingBottom: 8 }}
                onClick={handleScrubClick}
                onMouseDown={startDrag}
                onMouseEnter={() => setScrubHover(true)}
                onMouseLeave={() => setScrubHover(false)}
              >
                <div
                  className="relative w-full rounded-full bg-white/25 transition-all duration-150"
                  style={{ height: scrubHover || dragging ? 5 : 2 }}
                >
                  {/* Fill */}
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-white"
                    style={{
                      width: `${progress * 100}%`,
                      transition: dragging ? 'none' : 'width 0.1s linear',
                    }}
                  />
                  {/* Thumb */}
                  {(scrubHover || dragging) && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[11px] h-[11px] rounded-full bg-white shadow"
                      style={{ left: `${progress * 100}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Icon row */}
              <div className="flex items-center gap-3">
                <Btn onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
                  {playing
                    ? <Pause  className="w-[15px] h-[15px] fill-white stroke-none" />
                    : <Play   className="w-[15px] h-[15px] fill-white stroke-none" />}
                </Btn>

                <span
                  className="text-white/70 tabular-nums shrink-0"
                  style={{
                    fontSize: 11,
                    fontVariantNumeric: 'tabular-nums',
                    textShadow: '0 1px 4px rgba(0,0,0,0.85)',
                  }}
                >
                  {fmt(current)} / {fmt(duration)}
                </span>

                <div className="flex-1" />

                <Btn onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
                  {muted
                    ? <VolumeX className="w-[15px] h-[15px]" />
                    : <Volume2 className="w-[15px] h-[15px]" />}
                </Btn>

                <Btn
                  onClick={toggleFullscreen}
                  label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {fullscreen
                    ? <Minimize className="w-[15px] h-[15px]" />
                    : <Maximize className="w-[15px] h-[15px]" />}
                </Btn>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Minimal icon button — no fill, only text shadow for contrast.
function Btn({ onClick, label, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="text-white/80 hover:text-white transition-colors leading-none"
      style={{ textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
    >
      {children}
    </button>
  );
}
