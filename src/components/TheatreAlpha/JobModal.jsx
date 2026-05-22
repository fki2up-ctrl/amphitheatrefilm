// ---------------------------------------------------------------------------
// JobModal — create / edit a single theatre_alpha_jobs row.
// Local form state, controlled inputs, no autosave. Delete is destructive
// and confirms via window.confirm.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Trash2, Loader2 } from 'lucide-react';

const STATUSES = ['unpaid', 'invoiced', 'paid', 'overdue'];

// Convert ISO string to local "YYYY-MM-DDTHH:mm" for <input type=datetime-local>.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function fromLocalInput(local) {
  if (!local) return null;
  return new Date(local).toISOString();
}

export default function JobModal({ open, job, defaultStart, onClose, onSave, onDelete, currencySymbol }) {
  const isNew = !job?.id;

  const [form, setForm] = useState(blank(defaultStart));
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState('');

  function blank(start) {
    const startIso = start ? new Date(start).toISOString() : new Date().toISOString();
    const endIso   = new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
    return {
      title: '', client: '',
      start_at: startIso, end_at: endIso,
      amount: 0, billing_cycle_days: 30,
      payment_status: 'unpaid', notes: '',
    };
  }

  useEffect(() => {
    if (!open) return;
    setErr('');
    setForm(job ? { ...job } : blank(defaultStart));
  }, [open, job, defaultStart]);

  if (!open) return null;

  const set = (patch) => setForm((p) => ({ ...p, ...patch }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title?.trim()) { setErr('Title is required'); return; }
    if (new Date(form.end_at) <= new Date(form.start_at)) {
      setErr('End time must be after start time'); return;
    }
    try {
      setBusy(true); setErr('');
      await onSave(form);
      onClose();
    } catch (e2) {
      setErr(e2.message || String(e2));
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    if (!job?.id) return;
    if (!window.confirm(`Delete "${job.title}"? This cannot be undone.`)) return;
    try {
      setBusy(true);
      await onDelete(job.id);
      onClose();
    } catch (e2) {
      setErr(e2.message || String(e2));
      setBusy(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="ta-modal-overlay"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.form
          key="ta-modal-card"
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0,  scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          onSubmit={handleSave}
          className="w-full max-w-md rounded-xl border border-white/15 bg-ink-950 text-white shadow-2xl"
        >
          <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 className="text-sm tracking-widest2 uppercase text-white/85">
              {isNew ? 'New job' : 'Edit job'}
            </h3>
            <button type="button" onClick={onClose}
              className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-white/65 hover:text-white hover:border-white/40">
              <X className="w-3.5 h-3.5" />
            </button>
          </header>

          <div className="px-4 py-4 space-y-3">
            <Field label="Title">
              <input type="text" required autoFocus
                value={form.title}
                onChange={(e) => set({ title: e.target.value })}
                className={inputCls} />
            </Field>

            <Field label="Client">
              <input type="text"
                value={form.client || ''}
                onChange={(e) => set({ client: e.target.value })}
                className={inputCls} />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <input type="datetime-local" required
                  value={toLocalInput(form.start_at)}
                  onChange={(e) => set({ start_at: fromLocalInput(e.target.value) })}
                  className={inputCls} />
              </Field>
              <Field label="End">
                <input type="datetime-local" required
                  value={toLocalInput(form.end_at)}
                  onChange={(e) => set({ end_at: fromLocalInput(e.target.value) })}
                  className={inputCls} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`Amount (${currencySymbol})`}>
                <input type="number" step="0.01" min="0"
                  value={form.amount}
                  onChange={(e) => set({ amount: Number(e.target.value) })}
                  className={inputCls} />
              </Field>
              <Field label="Billing cycle (days)">
                <input type="number" step="1" min="0"
                  value={form.billing_cycle_days}
                  onChange={(e) => set({ billing_cycle_days: Number(e.target.value) })}
                  className={inputCls} />
              </Field>
            </div>

            <Field label="Status">
              <select value={form.payment_status}
                onChange={(e) => set({ payment_status: e.target.value })}
                className={inputCls}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>

            <Field label="Notes">
              <textarea rows={2}
                value={form.notes || ''}
                onChange={(e) => set({ notes: e.target.value })}
                className={inputCls} />
            </Field>

            {err && (
              <p className="text-xs text-red-300 bg-red-500/15 border border-red-500/40 rounded-md px-2 py-1.5">
                {err}
              </p>
            )}
          </div>

          <footer className="flex items-center gap-2 px-4 py-3 border-t border-white/10">
            {!isNew && (
              <button type="button" onClick={handleDelete} disabled={busy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-950/30 border border-red-500/30 text-red-400 hover:bg-red-900/60 hover:border-red-500/60 hover:text-red-200 hover:shadow-[0_0_12px_rgba(239,68,68,0.45)] active:scale-95 text-xs transition-all duration-200 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            )}
            <div className="flex-1" />
            <button type="button" onClick={onClose} disabled={busy}
              className="px-3 py-1.5 rounded-md border border-white/15 text-white/70 hover:text-white hover:border-white/40 text-xs disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-ink-950 hover:bg-white/90 text-xs disabled:opacity-50">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {isNew ? 'Create' : 'Save'}
            </button>
          </footer>
        </motion.form>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}

const inputCls =
  'w-full px-2.5 py-1.5 rounded-md bg-ink-900/80 border border-white/10 text-white text-sm focus:outline-none focus:border-white/40 placeholder-white/30';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] tracking-widest2 uppercase text-white/45 mb-1">{label}</span>
      {children}
    </label>
  );
}
