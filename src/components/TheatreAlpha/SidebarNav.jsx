// Left navigation rail for Theatre Alpha. Pure presentational.
import { Calendar, Wallet } from 'lucide-react';

const ITEMS = [
  { id: 'schedule', label: 'Production Schedule', icon: Calendar },
  { id: 'costs',    label: 'Costs & Accounting',  icon: Wallet   },
];

export default function SidebarNav({ view, onChange }) {
  return (
    <nav className="shrink-0 w-52 border-r border-white/10 bg-ink-950/80 p-3 space-y-1">
      <p className="px-2 py-1 text-[10px] tracking-widest2 uppercase text-white/40">
        Theatre Alpha
      </p>
      {ITEMS.map(({ id, label, icon: Icon }) => {
        const active = id === view;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={[
              'w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-xs transition-colors',
              active
                ? 'bg-white/10 text-white border border-white/20'
                : 'text-white/65 hover:text-white hover:bg-white/5 border border-transparent',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
