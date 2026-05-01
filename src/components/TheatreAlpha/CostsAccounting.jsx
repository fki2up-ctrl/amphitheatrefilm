// ---------------------------------------------------------------------------
// CostsAccounting — financial dashboard.
//   • Currency + tax-rate settings panel.
//   • Monthly aggregation cards.
//   • Upcoming-payments list (from billing_cycle_days).
//   • Excel + PDF export of the currently-selected month.
// ---------------------------------------------------------------------------

import { useMemo, useState, useEffect } from 'react';
import { aggregateByMonth, upcomingPayments, formatMoney, monthKey } from '../../lib/finance';
import ExportButtons from './ExportButtons';

export default function CostsAccounting({ jobs, settings, onSaveSettings }) {
  const months = useMemo(
    () => aggregateByMonth(jobs, settings.tax_rate_pct),
    [jobs, settings.tax_rate_pct],
  );

  // Default to current month if available, otherwise latest month with data.
  const currentKey = monthKey(new Date());
  const initialKey =
    months.find((m) => m.key === currentKey)?.key ||
    months[months.length - 1]?.key ||
    currentKey;

  const [selectedKey, setSelectedKey] = useState(initialKey);
  useEffect(() => { setSelectedKey(initialKey); /* eslint-disable-next-line */ }, [months.length]);

  const selected = months.find((m) => m.key === selectedKey);
  const upcoming = useMemo(() => upcomingPayments(jobs), [jobs]);

  const sym = settings.currency_symbol || '฿';

  return (
    <div className="h-full flex flex-col overflow-y-auto pretty-scroll">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 sticky top-0 bg-ink-950/80 backdrop-blur-md z-10">
        <div>
          <h2 className="text-sm tracking-widest2 uppercase text-white/85">Costs &amp; Accounting</h2>
          <p className="text-[10px] text-white/40 mt-0.5">
            Tax rate: {settings.tax_rate_pct}%   ·   Currency: {settings.currency_code}
          </p>
        </div>
        <ExportButtons
          jobs={selected?.jobs || []}
          settings={settings}
          monthLabel={selected?.label}
        />
      </header>

      <div className="px-4 py-4 space-y-6">
        <SettingsPanel settings={settings} onSave={onSaveSettings} />

        {/* Month picker */}
        <section>
          <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-2">Month</p>
          {months.length === 0 ? (
            <p className="text-xs text-white/50">No jobs yet — add one in Production Schedule.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {months.map((m) => {
                const active = m.key === selectedKey;
                return (
                  <button key={m.key} type="button" onClick={() => setSelectedKey(m.key)}
                    className={[
                      'px-2.5 py-1.5 rounded-md text-xs border transition-colors',
                      active
                        ? 'bg-white/10 text-white border-white/30'
                        : 'border-white/10 text-white/65 hover:text-white hover:border-white/30',
                    ].join(' ')}>
                    {m.label}
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected-month summary */}
        {selected && (
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SummaryCard label="Gross income" value={formatMoney(selected.gross, sym)} accent="text-white" />
            <SummaryCard label={`Withholding tax (${settings.tax_rate_pct}%)`} value={`− ${formatMoney(selected.tax, sym)}`} accent="text-amber-300" />
            <SummaryCard label="Net income" value={formatMoney(selected.net, sym)} accent="text-emerald-300" />
          </section>
        )}

        {/* Selected-month rows */}
        {selected && selected.jobs.length > 0 && (
          <section>
            <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-2">Breakdown — {selected.label}</p>
            <div className="rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-white/5 text-white/55 uppercase tracking-widest2 text-[10px]">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">Job</th>
                    <th className="text-left px-3 py-2">Client</th>
                    <th className="text-right px-3 py-2">Gross</th>
                    <th className="text-right px-3 py-2">Tax</th>
                    <th className="text-right px-3 py-2">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {selected.jobs.map((j) => {
                    const gross = Number(j.amount) || 0;
                    const tax = Math.round(gross * (settings.tax_rate_pct / 100) * 100) / 100;
                    const net = Math.round((gross - tax) * 100) / 100;
                    return (
                      <tr key={j.id} className="border-t border-white/5 hover:bg-white/5">
                        <td className="px-3 py-2 text-white/65">
                          {new Date(j.start_at).toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}
                        </td>
                        <td className="px-3 py-2 text-white">{j.title}</td>
                        <td className="px-3 py-2 text-white/65">{j.client || '—'}</td>
                        <td className="px-3 py-2 text-right text-white">{formatMoney(gross, sym)}</td>
                        <td className="px-3 py-2 text-right text-amber-300">{formatMoney(tax, sym)}</td>
                        <td className="px-3 py-2 text-right text-emerald-300">{formatMoney(net, sym)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Upcoming payments */}
        <section>
          <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-2">Upcoming payments (next 60 days)</p>
          {upcoming.length === 0 ? (
            <p className="text-xs text-white/50">Nothing due in the next 60 days.</p>
          ) : (
            <ul className="space-y-1.5">
              {upcoming.map((j) => (
                <li key={j.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-white/10 bg-ink-900/40 text-xs">
                  <div className="min-w-0">
                    <p className="text-white truncate">{j.title}</p>
                    <p className="text-white/45 text-[10px]">
                      {j.client || '—'} · due {new Date(j.due_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-white/85 shrink-0">{formatMoney(j.amount, sym)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, accent = 'text-white' }) {
  return (
    <div className="rounded-lg border border-white/10 bg-ink-900/40 px-4 py-3">
      <p className="text-[10px] tracking-widest2 uppercase text-white/45">{label}</p>
      <p className={`mt-1 text-xl font-display ${accent}`}>{value}</p>
    </div>
  );
}

function SettingsPanel({ settings, onSave }) {
  const [form, setForm] = useState({
    currency_code: settings.currency_code,
    currency_symbol: settings.currency_symbol,
    tax_rate_pct: settings.tax_rate_pct,
  });
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    setForm({
      currency_code: settings.currency_code,
      currency_symbol: settings.currency_symbol,
      tax_rate_pct: settings.tax_rate_pct,
    });
  }, [settings.currency_code, settings.currency_symbol, settings.tax_rate_pct]);

  const dirty =
    form.currency_code !== settings.currency_code ||
    form.currency_symbol !== settings.currency_symbol ||
    Number(form.tax_rate_pct) !== Number(settings.tax_rate_pct);

  const save = async () => {
    try {
      setBusy(true);
      await onSave({
        currency_code: form.currency_code.trim() || 'THB',
        currency_symbol: form.currency_symbol.trim() || '฿',
        tax_rate_pct: Number(form.tax_rate_pct) || 0,
      });
      setSavedAt(Date.now());
    } catch (e) {
      alert(`Save failed: ${e.message || e}`);
    } finally { setBusy(false); }
  };

  const inputCls =
    'w-full px-2.5 py-1.5 rounded-md bg-ink-900/80 border border-white/10 text-white text-sm focus:outline-none focus:border-white/40';

  return (
    <section className="rounded-lg border border-white/10 bg-ink-900/40 px-4 py-3">
      <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-2">Settings</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-[10px] tracking-widest2 uppercase text-white/45 mb-1">Currency code</span>
          <input className={inputCls} maxLength={6} value={form.currency_code}
            onChange={(e) => setForm((p) => ({ ...p, currency_code: e.target.value.toUpperCase() }))} />
        </label>
        <label className="block">
          <span className="block text-[10px] tracking-widest2 uppercase text-white/45 mb-1">Symbol</span>
          <input className={inputCls} maxLength={3} value={form.currency_symbol}
            onChange={(e) => setForm((p) => ({ ...p, currency_symbol: e.target.value }))} />
        </label>
        <label className="block">
          <span className="block text-[10px] tracking-widest2 uppercase text-white/45 mb-1">Tax rate (%)</span>
          <input type="number" step="0.01" min="0" max="100" className={inputCls} value={form.tax_rate_pct}
            onChange={(e) => setForm((p) => ({ ...p, tax_rate_pct: e.target.value }))} />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        {savedAt > 0 && Date.now() - savedAt < 2500 && (
          <span className="text-[10px] text-emerald-300">Saved</span>
        )}
        <button type="button" onClick={save} disabled={!dirty || busy}
          className="px-3 py-1.5 rounded-md bg-white text-ink-950 hover:bg-white/90 text-xs disabled:opacity-40">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </div>
    </section>
  );
}
