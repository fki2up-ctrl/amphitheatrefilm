import { useEffect, useState } from 'react';

// Observes a scroll container and returns the id of the section most in view.
export default function useActiveSection(sectionIds, rootRef) {
  const [active, setActive] = useState(sectionIds[0]);

  useEffect(() => {
    const root = rootRef?.current ?? null;
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry with the largest intersection ratio that is intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        root,
        // Trigger when a section crosses the middle of the viewport.
        rootMargin: '-40% 0px -50% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [sectionIds, rootRef]);

  return active;
}
