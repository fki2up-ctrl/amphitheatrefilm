// ---------------------------------------------------------------------------
// PhaseProvider — global state machine for the cinematic user journey.
//
// Phases:
//   'intro'    — Full-screen overlay playing the brand signature sequence.
//                Body scroll is locked. Unmounts via AnimatePresence.
//   'landing'  — Background video + category menu. User picks a category to
//                enter the gallery. This is the "hero" of the experience.
//   'gallery'  — The main portfolio grid. A single category ('All' means
//                long-scroll of everything; a specific id means that topic
//                shown in isolation). Sidebar + top nav are visible here.
//
// Transitions are exposed as actions so any descendant component can drive
// them. AnimatePresence in App.jsx owns the visual crossfade / dive-in.
// ---------------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const ALL = 'all';
export const CATEGORY_ALL = ALL;

const PhaseContext = createContext(null);

const SEEN_KEY = 'amphitheatre:intro:seen';

export function PhaseProvider({ children }) {
  // If the user navigates directly to /galleryport, skip intro/landing and
  // show the gallery immediately. Otherwise check if they've visited before.
  const [phase, setPhase] = useState(() => {
    try {
      const path = window.location.pathname.replace(/\/$/, '');
      if (path === '/galleryport') {
        return 'gallery';
      }
      return localStorage.getItem(SEEN_KEY) ? 'landing' : 'intro';
    } catch {
      return 'intro';
    }
  });

  // When the user clicks a category on Landing, we stash which one was
  // selected so the Gallery can render it. 'all' is the sentinel for the
  // long-scroll view; anything else is a topic id from the content store.
  const [selectedCategory, setSelectedCategory] = useState(ALL);

  // Sync browser back/forward buttons (popstate events) with application phases
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.replace(/\/$/, '');
      if (path === '/galleryport') {
        setPhase('gallery');
      } else {
        setPhase(localStorage.getItem(SEEN_KEY) ? 'landing' : 'intro');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Action: Intro sequence has finished — enter Landing. Mark as seen so
  // future visits skip the intro.
  const completeIntro = useCallback(() => {
    try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* ignore */ }
    setPhase((p) => (p === 'intro' ? 'landing' : p));
  }, []);

  // Action: User picked a category on Landing — enter Gallery. The dive-in
  // visual transition is owned by the Landing component's exit animation.
  const openCategory = useCallback((id) => {
    setSelectedCategory(id || ALL);
    setPhase('gallery');
    try {
      if (window.location.pathname.replace(/\/$/, '') !== '/galleryport') {
        window.history.pushState({ phase: 'gallery' }, '', '/galleryport');
      }
    } catch (e) {
      console.warn('Failed to pushState for galleryport:', e);
    }
  }, []);

  // Action: Take the user back to Landing (e.g. a "Home" button in gallery).
  const returnToLanding = useCallback(() => {
    setPhase('landing');
    try {
      if (window.location.pathname !== '/') {
        window.history.pushState({ phase: 'landing' }, '', '/');
      }
    } catch (e) {
      console.warn('Failed to pushState for home:', e);
    }
  }, []);

  // Action: Jump straight to gallery (e.g. deep links, dev shortcut).
  const skipToGallery = useCallback((id) => {
    setSelectedCategory(id || ALL);
    setPhase('gallery');
    try {
      if (window.location.pathname.replace(/\/$/, '') !== '/galleryport') {
        window.history.pushState({ phase: 'gallery' }, '', '/galleryport');
      }
    } catch (e) {
      console.warn('Failed to pushState for galleryport:', e);
    }
  }, []);

  const value = useMemo(
    () => ({
      phase,
      selectedCategory,
      completeIntro,
      openCategory,
      returnToLanding,
      skipToGallery,
    }),
    [phase, selectedCategory, completeIntro, openCategory, returnToLanding, skipToGallery]
  );

  return <PhaseContext.Provider value={value}>{children}</PhaseContext.Provider>;
}

export function usePhase() {
  const v = useContext(PhaseContext);
  if (!v) throw new Error('usePhase must be used inside <PhaseProvider>');
  return v;
}

