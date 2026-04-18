import { motion } from 'framer-motion';
import ProjectCard from './ProjectCard';
import { useContent } from '../store/content';

// Renders the full catalogue grouped by category. Each project card gets its
// own DOM id so the sidebar can smooth-scroll directly to it.
export default function ProjectGrid({ onOpen }) {
  const { CATEGORIES } = useContent();
  return (
    <div className="space-y-20 sm:space-y-28">
      {CATEGORIES.map((cat) => (
        <section
          key={cat.id}
          id={cat.id}
          className="scroll-mt-24 sm:scroll-mt-28"
        >
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7 }}
            className="flex items-end justify-between gap-6 mb-8 sm:mb-10"
          >
            <div>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl leading-tight">
                {cat.label}
              </h2>
            </div>
            <span className="hidden sm:block text-xs text-white/40 pb-1">
              {cat.projects.length} works
            </span>
          </motion.header>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
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
