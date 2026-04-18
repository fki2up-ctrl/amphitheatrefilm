import { useCallback, useEffect, useMemo, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import Sidebar from './components/Sidebar';
import MobileNav from './components/MobileNav';
import ProjectGrid from './components/ProjectGrid';
import FeaturedVideo from './components/FeaturedVideo';
import VideoModal from './components/VideoModal';
import useActiveSection from './hooks/useActiveSection';
import { useContent } from './store/content';
import Editor from './components/Editor';

export default function App() {
  const { CATEGORIES, ALL_PROJECTS, SITE_ASSETS, PROFILE } = useContent();

  // Keep <title> and favicon in sync with the editable PROFILE values.
  useEffect(() => {
    if (PROFILE.siteTitle) document.title = PROFILE.siteTitle;
  }, [PROFILE.siteTitle]);

  useEffect(() => {
    if (!PROFILE.favicon) return;
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = PROFILE.favicon;
  }, [PROFILE.favicon]);

  // --- Modal ---------------------------------------------------------------
  const [openProject, setOpenProject] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // --- Active highlight ----------------------------------------------------
  // Observe every project card; derive the active category from that.
  const projectIds = useMemo(() => ALL_PROJECTS.map((p) => p.id), [ALL_PROJECTS]);
  const observedProjectId = useActiveSection(projectIds, null);

  // Click-lock: keep the clicked item highlighted through smooth scroll until
  // the user scrolls on their own.
  const [lockedProjectId, setLockedProjectId] = useState(null);
  const activeProjectId = lockedProjectId ?? observedProjectId;
  const activeCategoryId = useMemo(() => {
    const p = ALL_PROJECTS.find((x) => x.id === activeProjectId);
    return p?.categoryId ?? CATEGORIES[0]?.id;
  }, [activeProjectId, ALL_PROJECTS, CATEGORIES]);

  useEffect(() => {
    if (!lockedProjectId) return;
    const release = () => setLockedProjectId(null);
    const opts = { passive: true };
    window.addEventListener('wheel', release, opts);
    window.addEventListener('touchstart', release, opts);
    window.addEventListener('keydown', release);
    return () => {
      window.removeEventListener('wheel', release);
      window.removeEventListener('touchstart', release);
      window.removeEventListener('keydown', release);
    };
  }, [lockedProjectId]);

  // --- Navigation ----------------------------------------------------------
  const scrollToId = useCallback((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const handleSelectProject = useCallback(
    (id) => {
      setLockedProjectId(id);
      scrollToId(id);
    },
    [scrollToId]
  );

  const handleNavigateCategory = useCallback(
    (id) => scrollToId(id),
    [scrollToId]
  );

  const bg = SITE_ASSETS.background;

  return (
    <div
      className="relative min-h-screen text-white"
      style={{
        backgroundColor: bg.color,
        backgroundImage: bg.image ? `url(${bg.image})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      }}
    >
      {/* Darkening overlay when a bg image is used */}
      {bg.image && bg.overlay && (
        <div
          aria-hidden
          className="fixed inset-0 pointer-events-none z-0"
          style={{ backgroundColor: bg.overlay }}
        />
      )}

      <MobileNav
        activeCategoryId={activeCategoryId}
        onNavigateCategory={handleNavigateCategory}
        onSelectProject={handleSelectProject}
      />
      <Sidebar
        activeProjectId={activeProjectId}
        activeCategoryId={activeCategoryId}
        onSelectProject={handleSelectProject}
        onOpenEditor={() => setEditorOpen(true)}
      />

      <main className="relative z-10 lg:ml-[280px]">
        <div className="px-4 sm:px-8 lg:px-12 pt-32 sm:pt-28 lg:pt-16 pb-24">
          <FeaturedVideo onOpen={setOpenProject} />
          <ProjectGrid onOpen={setOpenProject} />
        </div>
      </main>

      <VideoModal project={openProject} onClose={() => setOpenProject(null)} />
      <Editor open={editorOpen} onClose={() => setEditorOpen(false)} />
      <Analytics />
    </div>
  );
}


