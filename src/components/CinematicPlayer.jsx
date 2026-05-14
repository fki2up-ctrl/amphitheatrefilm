// ---------------------------------------------------------------------------
// CinematicPlayer — fully custom, closed-UI video player.
//
// Rules (strictly enforced):
//   1. NO dark overlay / dim / gradient mask ever touches the video.
//   2. NO external links, logos, or share buttons anywhere.
//   3. Native browser controls are disabled; only our controls render.
//
// Controls bar (auto-hides after 2.5 s of inactivity):
//   [Play/Pause] [──── scrubber ────] [time] [volume] [fullscreen]
//
// Scrubber: h-[3px], expands to h-[6px] on hover.
// Controls fade in/out with Framer Motion (no opacity on the video itself).
// Clicking the video body toggles Play/Pause.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause,
  Volume2, VolumeX,
  Maximize, Minimize,
} from 'lucide-react';

// Format seconds → "M:SS"
function fmt(s) {
  if (!Number.isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, '0');
  return `${m}:${ss}`;
}

export default function CinematicPlayer({ src, poster, className = '', style }) {
  const videoRef    = useRef(null);
  const containerRef = useRef(null);
  const hideTimer   = useRef(null);

  const [playing,    setPlaying]    = useState(false);
  const [muted,      setMuted]      = useState(false);
  const [current,    setCurrent]    = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [dragging,   setDragging]   = useState(false);
  const [scrubHover, setScrubHover] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showUI,     setShowUI]     = useState(true);

  // ── Auto-hide logic ──────────────────────────────────────────────────────
  const scheduleHide = useCallback(() => {
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowUI(false), 2500);
  }, []);

  const revealUI = useCallback(() => {
    setShowUI(true);
    scheduleHide();
  }, [scheduleHide]);

  // Start hide timer once on mount.
  useEffect(() => {
    scheduleHide();
    return () => clearTimeout(hideTimer.current);
  }, [scheduleHide]);

  // ── Video event listeners ────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay    = () => setPlaying(true);
    const onPause   = () => setPlaying(false);
    const onTime    = () => setCurrent(v.currentTime);
    const onLoaded  = () => setDuration(v.duration);
    const onFSChange = () => setFullscreen(!!document.fullscreenElement);

    v.addEventListener('play',             onPlay);
    v.addEventListener('pause',            onPause);
    v.addEventListener('timeupdate',       onTime);
    v.addEventListener('loadedmetadata',   onLoaded);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => {
      v.removeEventListener('play',           onPlay);
      v.removeEventListener('pause',          onPause);
      v.removeEventListener('timeupdate',     onTime);
      v.removeEventListener('loadedmetadata', onLoaded);
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
  const scrubRef = useRef(null);

  const getScrubFraction = (clientX) => {
    const rect = scrubRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleScrubClick = (e) => {
    e.stopPropagation();
    const v = videoRef.current;
    if (!v || !duration) return;
    const frac = getScrubFraction(e.clientX);
    v.currentTime = frac * duration;
    setCurrent(v.currentTime);
  };

  // Drag-scrub across the whole document so fast mouse moves stay tracked.
  const startDrag = (e) => {
    e.preventDefault();
    setDragging(true);
    const move = (ev) => {
      const v = videoRef.current;
      if (!v || !duration) return;
      const frac = getScrubFraction(ev.clientX);
      v.currentTime = frac * duration;
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

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-black group ${className}`}
      style={style}
      onMouseMove={revealUI}
      onMouseLeave={() => scheduleHide()}
    >
      {/* ── The video — untouched, full brightness, no overlay ── */}
      {/* CRITICAL: nothing sits on top of this element except the
          absolutely-positioned control bar which does NOT cover the video
          content area with any tint. */}
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
        className="w-full h-full object-contain cursor-pointer select-none"
        style={{ display: 'block' }}
      />

      {/* ── Control bar — absolute, bottom, NO background over the video ── */}
      <AnimatePresence>
        {(showUI || dragging) && (
          <motion.div
            key="controls"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            // The ONLY "background" is a narrow gradient that sits behind the
            // icons/text row — it is 40px tall and never reaches the video body.
            // The video itself is 100% untouched.
            className="absolute inset-x-0 bottom-0 px-3 pb-2 pt-6"
            style={{
              background:
                'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
              pointerEvents: 'auto',
            }}
            onMouseMove={(e) => e.stopPropagation()} // keep UI visible while interacting
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Scrubber ── */}
            <div
              ref={scrubRef}
              className="w-full mb-2 cursor-pointer"
              style={{ paddingTop: 6, paddingBottom: 6 }} // larger hit target
              onClick={handleScrubClick}
              onMouseDown={startDrag}
              onMouseEnter={() => setScrubHover(true)}
              onMouseLeave={() => setScrubHover(false)}
            >
              {/* Track */}
              <div
                className="relative w-full rounded-full bg-white/20 transition-all duration-150"
                style={{ height: scrubHover || dragging ? 6 : 3 }}
              >
                {/* Fill */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-white"
                  style={{ width: `${progress * 100}%`, transition: dragging ? 'none' : undefined }}
                />
                {/* Thumb — only visible on hover/drag */}
                {(scrubHover || dragging) && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white shadow-md"
                    style={{ left: `${progress * 100}%` }}
                  />
                )}
              </div>
            </div>

            {/* ── Icon row ── */}
            <div className="flex items-center gap-3 select-none">
              {/* Play / Pause */}
              <CtrlBtn onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
                {playing
                  ? <Pause  className="w-4 h-4 fill-white" />
                  : <Play   className="w-4 h-4 fill-white" />}
              </CtrlBtn>

              {/* Time */}
              <span
                className="text-white/70 tabular-nums"
                style={{
                  fontSize: 11,
                  fontVariantNumeric: 'tabular-nums',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}
              >
                {fmt(current)} / {fmt(duration)}
              </span>

              {/* Spacer */}
              <div className="flex-1" />

              {/* Volume */}
              <CtrlBtn onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
                {muted
                  ? <VolumeX className="w-4 h-4" />
                  : <Volume2 className="w-4 h-4" />}
              </CtrlBtn>

              {/* Fullscreen */}
              <CtrlBtn onClick={toggleFullscreen} label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {fullscreen
                  ? <Minimize className="w-4 h-4" />
                  : <Maximize className="w-4 h-4" />}
              </CtrlBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Tiny icon button — no background fill, just a hover ring. 
function CtrlBtn({ onClick, label, children }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      className="text-white/80 hover:text-white transition-colors"
      style={{ lineHeight: 0, textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}
    >
      {children}
    </button>
  );
}
