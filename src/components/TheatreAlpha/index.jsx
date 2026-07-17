// ---------------------------------------------------------------------------
// TheatreAlpha — split-view studio management module.
//   • Left:  vertical nav (Schedule / Costs)
//   • Right: dynamic dashboard
// Owns the jobs+settings state and passes both to children.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import {
  listJobs, createJob, updateJob, deleteJob,
  getSettings, upsertSettings,
} from '../../lib/theatreAlpha';
import SidebarNav from './SidebarNav';
import ProductionSchedule from './ProductionSchedule';
import CostsAccounting from './CostsAccounting';
import DocumentManager from './DocumentManager';
import Settings from './Settings';

export default function TheatreAlpha() {
  const [view, setView] = useState('schedule');         // 'schedule' | 'costs' | 'documents' | 'settings'
  const [jobs, setJobs] = useState([]);
  const [settings, setSettings] = useState({
    currency_code: 'THB', currency_symbol: '฿', tax_rate_pct: 3,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [j, s] = await Promise.all([listJobs(), getSettings()]);
      setJobs(j);
      setSettings(s);
      setError('');
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onCreate = async (input) => {
    const row = await createJob(input);
    setJobs((prev) => [...prev, row].sort(
      (a, b) => new Date(a.start_at) - new Date(b.start_at),
    ));
    return row;
  };

  const onUpdate = async (id, patch) => {
    const row = await updateJob(id, patch);
    setJobs((prev) => prev.map((j) => (j.id === id ? row : j)));
    return row;
  };

  const onDelete = async (id) => {
    await deleteJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const onSaveSettings = async (patch) => {
    const row = await upsertSettings({ ...settings, ...patch });
    setSettings(row);
    return row;
  };

  return (
    <div className="flex h-full min-h-[600px] rounded-xl border border-white/10 bg-ink-950/60 overflow-hidden">
      <SidebarNav view={view} onChange={setView} />

      <div className="flex-1 min-w-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-ink-950/40 z-10">
            <Loader2 className="w-5 h-5 animate-spin text-white/70" />
          </div>
        )}
        {error && (
          <div className="absolute top-3 left-3 right-3 px-3 py-2 rounded-md bg-red-500/15 border border-red-500/40 text-red-200 text-xs z-20">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={view}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="h-full"
          >
            {view === 'schedule' && (
              <ProductionSchedule
                jobs={jobs}
                settings={settings}
                onCreate={onCreate}
                onUpdate={onUpdate}
                onDelete={onDelete}
              />
            )}
            {view === 'costs' && (
              <CostsAccounting
                jobs={jobs}
                settings={settings}
                onSaveSettings={onSaveSettings}
              />
            )}
            {view === 'documents' && (
              <DocumentManager settings={settings} />
            )}
            {view === 'settings' && (
              <Settings
                settings={settings}
                onSaveSettings={onSaveSettings}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
