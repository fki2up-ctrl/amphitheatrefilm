import { motion } from 'framer-motion';
import ProjectCard from './ProjectCard';
import { useContent } from '../store/content';

// Renders the catalogue. When `filterCategoryId` is omitted (or falsy), ALL
// categories are shown stacked vertically — the long-scroll "hybrid: All"
// view. When a real category id is passed, only that topic's grid renders
// without its section header (the parent shows GalleryHeader instead).
export default function ProjectGrid({ onOpen, filterCategoryId }) {
  const { CATEGORIES } = useContent();

  // Resolve which categories to show and whether we're in single-view mode.
  const isSingleView = Boolean(filterCategoryId);
  const categories = isSingleView
    ? CATEGORIES.filter((c) => c.id === filterCategoryId)
    : CATEGORIES;

  // If the user routed to a category that no longer exists (e.g. deleted in
  // the editor after Landing was shown), fall back gracefully to empty.
  if (isSingleView && categories.length === 0) {
    return (
      <div className="text-center text-sm text-white/45 py-24">
        This category has no projects yet.
      </div>
    );
  }

  return (
    <div className={isSingleView ? '' : 'space-y-20 sm:space-y-28'}>
      {categories.map((cat) => (
        <section
          key={cat.id}
          id={cat.id}
          className="scroll-mt-24 sm:scroll-mt-28"
        >
          {!isSingleView && (
            <motion.header
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.7 }}
              className="flex items-end justify-between gap-6 mb-8 sm:mb-10"
            >
              <div>
                <h2
                  className="font-display leading-tight"
                  style={{ fontSize: 'calc(var(--site-topic-size, 56px) * 0.8)' }}
                >
                  {cat.label}
                </h2>
              </div>
            </motion.header>
          )}

          <div className="site-grid grid grid-cols-2 gap-[var(--site-card-gap,20px)]">
            {cat.projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                index={i}
                project={{ ...p, categoryId: cat.id, categoryLabel: cat.label }}
                onOpen={onOpen}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
