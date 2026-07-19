// ---------------------------------------------------------------------------
// DocumentManager — full Documents & Financials dashboard for AlphaProd.
//
// Features:
//   • Quotation table with status badges + profitability
//   • Split-view document editor (left form + right A4 preview + mindmap)
//   • Searchable/creatable client combobox with Thai language support
//   • Quick client creation modal with ⚙️ trigger
//   • Live A4 document preview with morphing download indicator
//   • Separated VAT% (added) and WHT% (deducted) tax handling
//   • Interactive expense mindmap (reactflow) synced to expenses state
//   • PDF export via html2canvas + jsPDF
//
// Renders as a TheatreAlpha view (left nav already handled by SidebarNav).
// Uses local mock data when Supabase is unavailable (dev mode).
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Plus, X, Trash2, Upload, FileText, Receipt,
  ExternalLink, Check, AlertCircle, Loader2,
  ChevronDown, TrendingUp, TrendingDown, Minus,
  Search, Download, Settings2, GripVertical, Save,
} from 'lucide-react';
import { formatMoney } from '../../lib/finance';
import { generateQtNumber, uploadPOFile } from '../../lib/documents';
import { hasSupabase } from '../../lib/supabase';
import ExpenseMindmap from './ExpenseMindmap';



// ---------------------------------------------------------------------------
// Financial calculations — VAT (added to total) + WHT (deducted for payable)
// ---------------------------------------------------------------------------

function calcLineItemsTotal(items) {
  return items.reduce((sum, it) => sum + (Number(it.qty !== undefined ? it.qty : it.quantity) || 0) * (Number(it.unit_price !== undefined ? it.unit_price : it.price_per_unit) || 0), 0);
}

function calcExpensesTotal(expenses) {
  return expenses.reduce((sum, ex) => sum + (Number(ex.amount) || 0), 0);
}

function calcTotals(lineItems, discountPct = 0, vatPct = 0, whtPct = 0) {
  const subtotal = calcLineItemsTotal(lineItems);
  const discount = Math.round(subtotal * (discountPct / 100) * 100) / 100;
  const afterDiscount = subtotal - discount;
  const vat = Math.round(afterDiscount * (vatPct / 100) * 100) / 100;
  const grandTotal = Math.round((afterDiscount + vat) * 100) / 100;
  const wht = Math.round(afterDiscount * (whtPct / 100) * 100) / 100;
  const netPayable = Math.round((grandTotal - wht) * 100) / 100;
  return { subtotal, discount, afterDiscount, vat, grandTotal, wht, netPayable };
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  draft: { label: 'Draft', bg: 'bg-gray-500/15', text: 'text-gray-300', border: 'border-gray-500/30', dot: 'bg-gray-400' },
  quoted: { label: 'Quoted', bg: 'bg-blue-500/15', text: 'text-blue-300', border: 'border-blue-500/30', dot: 'bg-blue-400' },
  po_received: { label: 'PO Received', bg: 'bg-amber-500/15', text: 'text-amber-300', border: 'border-amber-500/30', dot: 'bg-amber-400' },
  invoiced: { label: 'Invoiced', bg: 'bg-purple-500/15', text: 'text-purple-300', border: 'border-purple-500/30', dot: 'bg-purple-400' },
  paid: { label: 'Paid', bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-400' },
};

function StatusBadge({ status }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] tracking-widest2 uppercase border ${c.bg} ${c.text} ${c.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// DocumentManager — main export
// ---------------------------------------------------------------------------

export default function DocumentManager({ settings, jobs = [], clients = [], profiles = [], onUpdateJob, onCreateJob, onDeleteJob }) {
  const sym = settings?.currency_symbol || '฿';
  const [selectedId, setSelectedId] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // Note: projects are now passed as `jobs`.
  const projects = jobs;

  const selected = useMemo(
    () => projects.find((p) => p.id === selectedId) || null,
    [projects, selectedId],
  );

  const openEditor = (id) => { setSelectedId(id); setEditorOpen(true); };

  const openNew = async () => {
    const seq = projects.length + 1;
    const now = new Date();
    
    // We create a draft on the backend right away, or we could just open it empty.
    // For simplicity, we'll create it.
    const newProject = await onCreateJob({
      qt_number: generateQtNumber(seq, now),
      project_name: 'New Quotation',
      status: 'draft',
      discount_pct: 0, vat_pct: 7, wht_pct: 3,
    });
    
    setSelectedId(newProject.id);
    setEditorOpen(true);
  };



  // Metrics
  const metrics = useMemo(() => {
    let totalRevenue = 0, totalExpenses = 0, totalProfit = 0, paidCount = 0, openCount = 0;
    for (const p of projects) {
      const { netPayable } = calcTotals(p.doc_line_items || p.line_items || [], p.discount_pct, p.vat_pct, p.wht_pct);
      const expTotal = calcExpensesTotal(p.doc_expenses || p.expenses || []);
      totalRevenue += netPayable;
      totalExpenses += expTotal;
      totalProfit += netPayable - expTotal;
      if (p.status === 'paid') paidCount++; else openCount++;
    }
    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100,
      paidCount, openCount, count: projects.length,
    };
  }, [projects]);

  const groupedProjects = useMemo(() => {
    const groups = {};
    for (const p of projects) {
      const d = new Date(p.issue_date || p.created_at || new Date());
      const monthYear = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[monthYear]) groups[monthYear] = { monthYear, projects: [], revenue: 0, expenses: 0, profit: 0, date: d };
      
      const { netPayable } = calcTotals(p.doc_line_items || p.line_items || [], p.discount_pct, p.vat_pct, p.wht_pct);
      const expTotal = calcExpensesTotal(p.doc_expenses || p.expenses || []);
      groups[monthYear].projects.push(p);
      groups[monthYear].revenue += netPayable;
      groups[monthYear].expenses += expTotal;
      groups[monthYear].profit += (netPayable - expTotal);
    }
    return Object.values(groups).sort((a, b) => b.date - a.date);
  }, [projects]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="text-sm tracking-widest2 uppercase text-white/85">Documents & Financials</h2>
          <p className="text-[10px] text-white/40 mt-0.5">Quotations · Invoices · Receipts · Profitability</p>
        </div>
        <button type="button" onClick={openNew} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-ink-950 hover:bg-white/90 text-xs font-medium">
          <Plus className="w-3.5 h-3.5" /> New Quotation
        </button>
      </header>

      <div className="shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3 px-4 py-3 border-b border-white/5">
        <MetricCard label="Total Revenue" value={formatMoney(metrics.totalRevenue, sym)} accent="text-white" />
        <MetricCard label="Total Expenses" value={formatMoney(metrics.totalExpenses, sym)} accent="text-amber-300" />
        <MetricCard label="Net Profit" value={formatMoney(metrics.totalProfit, sym)}
          accent={metrics.totalProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}
          icon={metrics.totalProfit >= 0 ? TrendingUp : TrendingDown} />
        <MetricCard label="Quotations" value={`${metrics.count}`} sub={`${metrics.paidCount} paid · ${metrics.openCount} open`} accent="text-white" />
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-y-auto pretty-scroll">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-ink-950/95 backdrop-blur-sm z-10">
              <tr className="text-[10px] tracking-widest2 uppercase text-white/50 border-b border-white/8">
                <th className="text-left px-4 py-2.5 font-medium">QT Number</th>
                <th className="text-left px-4 py-2.5 font-medium">Project</th>
                <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">Client</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-right px-4 py-2.5 font-medium">Net Payable</th>
                <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">Profit</th>
                <th className="w-10" />
              </tr>
            </thead>
            {groupedProjects.map((group) => (
              <tbody key={group.monthYear}>
                <tr className="bg-white/[0.03] border-b border-t border-white/10">
                  <td colSpan={4} className="px-4 py-3 font-semibold text-white text-xs tracking-wide uppercase">{group.monthYear}</td>
                  <td className="px-4 py-3 text-right text-white/70 font-mono text-xs">{formatMoney(group.revenue, sym)}</td>
                  <td className={`px-4 py-3 text-right font-mono text-xs hidden md:table-cell ${group.profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                    {formatMoney(group.profit, sym)}
                  </td>
                  <td />
                </tr>
                {group.projects.map((p) => {
                  const { netPayable } = calcTotals(p.doc_line_items || p.line_items || [], p.discount_pct, p.vat_pct, p.wht_pct);
                  const expTotal = calcExpensesTotal(p.doc_expenses || p.expenses || []);
                  const profit = netPayable - expTotal;
                  const client = clients.find((c) => c.id === p.client_id);
                  const isSelected = p.id === selectedId;
                  return (
                    <tr key={p.id} onClick={() => openEditor(p.id)}
                      className={`group cursor-pointer border-b transition-colors ${isSelected ? 'bg-white/[0.04] border-white/10' : 'border-white/5 hover:bg-white/[0.02]'}`}>
                      <td className="px-4 py-3 font-medium text-white">{p.qt_number}</td>
                      <td className="px-4 py-3 text-white/70 truncate max-w-[200px]">{p.project_name || p.reference_name || '(untitled)'}</td>
                      <td className="px-4 py-3 text-white/50 truncate max-w-[150px] hidden sm:table-cell">{client?.company_name || '—'}</td>
                      <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-3 text-right text-white font-mono">{formatMoney(netPayable, sym)}</td>
                      <td className={`px-4 py-3 text-right font-mono hidden md:table-cell ${profit >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                        {formatMoney(profit, sym)}
                      </td>
                      <td className="px-4 py-3 text-center">
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
            {projects.length === 0 && (
              <tbody><tr><td colSpan={7} className="px-4 py-12 text-center text-white/30">No quotations yet.</td></tr></tbody>
            )}
          </table>
        </div>

        <div className="shrink-0 w-[420px] border-l border-white/10 overflow-y-auto pretty-scroll hidden lg:block">
          <ProfitabilityPanel metrics={metrics} sym={sym} />
        </div>
      </div>

      <AnimatePresence>
        {editorOpen && selected && (
          <DocumentEditor
            key={selected.id}
            p={selected}
            clients={clients}
            profiles={profiles}
            settings={settings}
            onUpdate={async (patch, lineItems, expenses) => { await onUpdateJob(selected.id, patch, lineItems, expenses); }}
            onClose={() => setEditorOpen(false)}
            onDelete={async () => {
              if (window.confirm('Are you sure you want to delete this quotation? This action cannot be undone.')) {
                await onDeleteJob(selected.id);
                setEditorOpen(false);
              }
            }}
            sym={sym}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MetricCard
// ---------------------------------------------------------------------------

function MetricCard({ label, value, sub, accent = 'text-white', icon: Icon }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] px-3 py-2.5">
      <p className="text-[9px] tracking-widest2 uppercase text-white/40">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        {Icon && <Icon className={`w-3.5 h-3.5 ${accent}`} />}
        <p className={`text-lg font-display font-medium ${accent} leading-none`}>{value}</p>
      </div>
      {sub && <p className="text-[10px] text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Global ProfitabilityPanel
// ---------------------------------------------------------------------------

function ProfitabilityPanel({ metrics, sym }) {
  const margin = metrics.totalRevenue > 0 ? Math.round((metrics.totalProfit / metrics.totalRevenue) * 100) : 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <p className="text-[10px] tracking-widest2 uppercase text-white/40">Global Profitability</p>
        <h3 className="text-base text-white mt-1 leading-tight">All Quotations</h3>
        <p className="text-[10px] text-white/40 mt-0.5">{metrics.count} total documents</p>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-widest2">
          <span className="text-white/40">Total Margin</span>
          <span className={metrics.totalProfit >= 0 ? 'text-emerald-300' : 'text-red-300'}>{margin}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${metrics.totalProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(Math.abs(margin), 100)}%` }} />
        </div>
      </div>
      <div className="space-y-2 text-sm pt-4">
        <Row label="Total Net Payable" value={formatMoney(metrics.totalRevenue, sym)} bold />
        <Row label="Total Expenses" value={`−${formatMoney(metrics.totalExpenses, sym)}`} accent="text-amber-300" />
        <div className="border-t border-white/8 pt-2 mt-2">
          <Row label="Total Net Profit" value={formatMoney(metrics.totalProfit, sym)}
            accent={metrics.totalProfit >= 0 ? 'text-emerald-300' : 'text-red-300'} bold />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent = 'text-white/80', bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-white/50 ${bold ? 'font-medium text-white/70' : ''}`}>{label}</span>
      <span className={`font-mono ${accent} ${bold ? 'font-semibold' : ''}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ClientCombobox — searchable, creatable with Thai IME safety.
// ---------------------------------------------------------------------------

function ClientCombobox({ clients, value, onChange, onCreateClient }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [composing, setComposing] = useState(false);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const selectedClient = clients.find((c) => c.id === value);
  const displayName = selectedClient?.company_name || '';

  useEffect(() => { if (!open) setQuery(displayName); }, [displayName, open]);

  useEffect(() => {
    const handleClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setQuery(displayName); }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [displayName]);

  const filterQuery = composing ? '' : query;
  const filtered = useMemo(() => {
    if (!filterQuery.trim()) return clients;
    const q = filterQuery.toLowerCase();
    return clients.filter((c) => c.company_name.toLowerCase().includes(q));
  }, [clients, filterQuery]);

  const exactMatch = clients.some((c) => c.company_name.toLowerCase() === query.trim().toLowerCase());

  const selectClient = (id) => {
    onChange(id); setOpen(false);
    setQuery(clients.find((cl) => cl.id === id)?.company_name || '');
  };

  const createAndSelect = () => {
    if (!query.trim()) return;
    const nc = onCreateClient(query.trim());
    onChange(nc.id); setOpen(false); setQuery(nc.company_name);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
        <input ref={inputRef} type="text"
          value={open ? query : displayName}
          onFocus={() => { setOpen(true); setQuery(displayName); }}
          onChange={(e) => setQuery(e.target.value)}
          onCompositionStart={() => setComposing(true)}
          onCompositionEnd={(e) => { setComposing(false); setQuery(e.target.value); }}
          placeholder="Search or add client…"
          className="w-full pl-8 pr-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors"
          autoComplete="off" />
      </div>
      <AnimatePresence>
        {open && (
          <motion.ul initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-30 mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-white/15 bg-ink-900 shadow-2xl shadow-black/40 pretty-scroll">
            {filtered.map((c) => (
              <li key={c.id}>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => selectClient(c.id)}
                  className={['w-full text-left px-3 py-2 text-xs hover:bg-white/8 transition-colors', c.id === value ? 'bg-white/5 text-white' : 'text-white/70'].join(' ')}>
                  <span className="block truncate">{c.company_name}</span>
                  {c.tax_id && <span className="block text-[10px] text-white/30 mt-0.5">{c.tax_id}</span>}
                </button>
              </li>
            ))}
            {query.trim() && !exactMatch && (
              <li>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={createAndSelect}
                  className="w-full text-left px-3 py-2.5 text-xs text-amber-300 hover:bg-amber-500/10 border-t border-white/5 transition-colors">
                  <Plus className="w-3 h-3 inline mr-1.5 -mt-0.5" />
                  Add "<span className="font-medium">{query.trim()}</span>" as new client
                </button>
              </li>
            )}
            {filtered.length === 0 && (!query.trim() || exactMatch) && (
              <li className="px-3 py-3 text-[11px] text-white/30 text-center">No clients found</li>
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickClientModal — triggered by ⚙️ icon next to combobox
// ---------------------------------------------------------------------------

function QuickClientModal({ onAddClient, onClose }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [taxId, setTaxId] = useState('');
  const inputCls = 'w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors';
  const labelCls = 'block text-[10px] tracking-widest2 uppercase text-white/40 mb-1';

  const handleCreate = () => {
    if (!name.trim()) return;
    const nc = onAddClient({ company_name: name.trim(), address, tax_id: taxId });
    onClose(nc.id);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onClose(null)} />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="relative w-full max-w-md mx-4 rounded-xl border border-white/15 bg-ink-950 shadow-2xl shadow-black/50 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm text-white font-medium">Quick Add Client</h3>
          <button onClick={() => onClose(null)} className="text-white/40 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Company Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. บริษัท สยาม จำกัด"
              className={inputCls} autoFocus
              onCompositionStart={() => { }} onCompositionEnd={() => { }} />
          </div>
          <div>
            <label className={labelCls}>Address</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 ถ.สุขุมวิท กรุงเทพฯ"
              className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Tax ID</label>
            <input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="0105560000000"
              className={inputCls} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={() => onClose(null)} className="px-3 py-1.5 rounded-md border border-white/10 text-white/50 text-xs hover:bg-white/5">Cancel</button>
          <button onClick={handleCreate} className="px-3 py-1.5 rounded-md bg-white text-ink-950 text-xs font-medium hover:bg-white/90">
            <Plus className="w-3 h-3 inline mr-1 -mt-0.5" /> Create Client
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// DocTypeTabs — horizontal row of document type buttons
// Each tab: click to preview, hover/hold to reveal Download PDF action
// ---------------------------------------------------------------------------

const DOC_TYPES = [
  { key: 'quotation', label: 'Quotation', statusVal: 'draft', color: 'amber' },
  { key: 'purchase_order', label: 'Purchase Order', statusVal: 'po', color: 'blue' },
  { key: 'invoice', label: 'Invoice', statusVal: 'invoiced', color: 'purple' },
  { key: 'receipt', label: 'Receipt', statusVal: 'paid', color: 'emerald' },
];

function DocTypeTabs({ activeType, onSelect, onDownload, pdfBusy, hasPO }) {
  const [hoverKey, setHoverKey] = useState(null);

  const colorMap = {
    amber: { bg: 'bg-amber-500/15', border: 'border-amber-400/40', text: 'text-amber-300', hoverBg: 'hover:bg-amber-500/10' },
    blue: { bg: 'bg-blue-500/15', border: 'border-blue-400/40', text: 'text-blue-300', hoverBg: 'hover:bg-blue-500/10' },
    purple: { bg: 'bg-purple-500/15', border: 'border-purple-400/40', text: 'text-purple-300', hoverBg: 'hover:bg-purple-500/10' },
    emerald: { bg: 'bg-emerald-500/15', border: 'border-emerald-400/40', text: 'text-emerald-300', hoverBg: 'hover:bg-emerald-500/10' },
  };

  const tabs = DOC_TYPES.filter(dt => dt.key !== 'purchase_order' || hasPO);

  return (
    <div className="flex items-center gap-1.5 mb-4 px-1">
      {tabs.map(dt => {
        const isActive = activeType === dt.key;
        const isHover = hoverKey === dt.key;
        const c = colorMap[dt.color];

        return (
          <motion.button
            key={dt.key}
            type="button"
            disabled={pdfBusy && isHover}
            onClick={() => {
              if (isHover && isActive) {
                onDownload(dt.statusVal, dt.label);
              } else {
                onSelect(dt.key);
              }
            }}
            onMouseEnter={() => setHoverKey(dt.key)}
            onMouseLeave={() => setHoverKey(null)}
            layout
            className={[
              'flex-1 relative rounded-lg border px-2 py-2 text-center transition-all duration-200 disabled:opacity-40',
              isActive ? `${c.bg} ${c.border}` : 'bg-white/[0.03] border-white/8 hover:border-white/15',
            ].join(' ')}
          >
            <AnimatePresence mode="wait">
              {isHover && isActive ? (
                <motion.span
                  key="dl"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className={`flex items-center justify-center gap-1 text-[10px] font-medium ${c.text}`}
                >
                  <Download className="w-3 h-3" />
                  <span className="hidden sm:inline">PDF</span>
                </motion.span>
              ) : (
                <motion.span
                  key="label"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className={`text-[10px] tracking-wide uppercase ${isActive ? c.text : 'text-white'
                    }`}
                >
                  {dt.label}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DocumentPreview — live A4 paper with WHT display
// ---------------------------------------------------------------------------

const PREVIEW_FONT_HREF = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap';

function usePreviewFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${PREVIEW_FONT_HREF}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = PREVIEW_FONT_HREF;
    document.head.appendChild(link);
  }, []);
}

function DocumentPreview({ project, client, profile, lineItems, discountPct, vatPct, whtPct, refName, sym, overrideDocType, issueDate }) {
  usePreviewFont();

  const { subtotal, discount, vat, grandTotal, wht, netPayable } = calcTotals(lineItems, discountPct, vatPct, whtPct);
  // Default to issueDate (from props), fallback to project.issue_date, then created_at
  const date = new Date(issueDate || project.issue_date || project.created_at || Date.now());
  const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  // Use override if provided, otherwise fall back to project status
  const docTitleMap = { quotation: 'QUOTATION', purchase_order: 'PURCHASE ORDER', invoice: 'INVOICE', receipt: 'RECEIPT' };
  const signatureLeftMap = { quotation: 'ผู้เสนอราคา', purchase_order: 'ผู้สั่งซื้อ', invoice: 'ผู้วางบิล', receipt: 'ผู้รับเงิน' };
  const statusToKey = { draft: 'quotation', po: 'purchase_order', invoiced: 'invoice', paid: 'receipt' };
  const activeKey = overrideDocType || statusToKey[project.status] || 'quotation';
  const docTitle = docTitleMap[activeKey] || 'QUOTATION';
  const leftSignatureLabel = signatureLeftMap[activeKey] || 'ผู้เสนอราคา';

  // Doc number prefix
  const prefixMap = { quotation: 'QT', purchase_order: 'PO', invoice: 'INV', receipt: 'REC' };
  const prefix = prefixMap[activeKey] || 'QT';
  const docNumber = project.qt_number ? project.qt_number.replace(/^QT/, prefix) : `${prefix}-001`;

  const fmtNum = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="bg-white text-gray-900 shadow-2xl shadow-black/30 rounded-sm overflow-hidden"
      style={{ fontFamily: '"Inter", "Noto Sans Thai", "DM Sans", ui-sans-serif, system-ui, sans-serif', aspectRatio: '1 / 1.414', fontSize: '1.923cqi' }}>
      <div className="h-full flex flex-col p-[6%]">
        {/* Header */}
        <div className="flex items-start justify-between mb-[5%]">
          <div>
            <h1 className="text-[1.8em] font-bold tracking-tight text-gray-900 leading-none">{profile?.company_name || 'AMPHITHEATRE Film Production'}</h1>
            {profile?.address && <p className="text-[0.8em] text-gray-500 mt-[0.5em] max-w-[280px] leading-snug">{profile.address}</p>}
            <p className="text-[0.75em] text-gray-500 mt-[0.2em]">
              {profile?.tax_id ? `Tax ID: ${profile.tax_id}` : ''}
              {profile?.email ? ` • ${profile.email}` : ''}
              {profile?.phone ? ` • ${profile.phone}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[1.6em] font-semibold tracking-[0.08em] text-gray-700">{docTitle}</p>
            <p className="text-[0.85em] text-gray-400 mt-[0.2em] font-mono">{docNumber}</p>
          </div>
        </div>

        {/* Client + Details */}
        <div className="grid grid-cols-2 gap-[4%] mb-[4%] pb-[3%] border-b border-gray-200">
          <div>
            <p className="text-[0.75em] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-[0.4em]">Bill To</p>
            <p className="text-[1.1em] font-semibold text-gray-800 leading-snug">{client?.company_name || '—'}</p>
            {client?.address && <p className="text-[0.85em] text-gray-500 mt-[0.2em] leading-snug">{client.address}</p>}
            {client?.tax_id && <p className="text-[0.8em] text-gray-400 mt-[0.15em] font-mono">{client.tax_id}</p>}
          </div>
          <div className="text-right">
            <p className="text-[0.75em] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-[0.4em]">Details</p>
            <p className="text-[0.9em] text-gray-700">{dateStr}</p>
            <p className="text-[0.9em] text-gray-700 mt-[0.2em] leading-snug">{refName || '—'}</p>
          </div>
        </div>

        {/* Line items */}
        <div className="flex-1 min-h-0">
          <table className="w-full text-[0.85em]">
            <thead>
              <tr className="border-b-2 border-gray-800 text-[0.8em] font-semibold uppercase tracking-[0.1em] text-gray-500">
                <th className="text-left py-[0.6em] pr-1">Description</th>
                <th className="text-center py-[0.6em] w-[10%]">Qty</th>
                <th className="text-center py-[0.6em] w-[12%]">Unit</th>
                <th className="text-right py-[0.6em] w-[16%]">Price</th>
                <th className="text-right py-[0.6em] w-[18%]">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((it, i) => {
                const amount = (Number(it.qty || it.quantity) || 0) * (Number(it.unit_price || it.price_per_unit) || 0);
                return (
                  <tr key={it.id || i} className="border-b border-gray-100">
                    <td className="py-[0.5em] pr-1 text-gray-700">{it.description || it.service_name || '—'}</td>
                    <td className="py-[0.5em] text-center text-gray-600">{it.qty || it.quantity}</td>
                    <td className="py-[0.5em] text-center text-gray-500">{it.unit_name}</td>
                    <td className="py-[0.5em] text-right text-gray-600 font-mono">{fmtNum(it.unit_price || it.price_per_unit)}</td>
                    <td className="py-[0.5em] text-right text-gray-800 font-mono font-medium">{fmtNum(amount)}</td>
                  </tr>
                );
              })}
              {lineItems.length === 0 && (
                <tr><td colSpan={5} className="py-[2em] text-center text-gray-300 italic">No line items</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Totals & Footer Info */}
        <div className="mt-auto pt-[3%] border-t border-gray-200">
          <div className="flex justify-between items-end">
            <div className="w-[45%] text-[0.75em]">
              {profile?.bank_details && (
                <div className="mb-[1em]">
                  <p className="font-semibold text-gray-800 mb-[0.2em]">การชำระเงิน / Payment</p>
                  <p className="text-gray-600 whitespace-pre-line leading-relaxed">{profile.bank_details}</p>
                </div>
              )}
              <div className="border border-blue-600/30 border-dashed rounded p-[0.8em] text-gray-600 leading-relaxed bg-blue-50/30">
                <p className="font-semibold text-gray-800 mb-[0.3em]">Term of Conditions</p>
                <p>1. สินค้าหรือบริการในรายการนี้ไม่รับคืนหรือเปลี่ยนแปลงหลังจากรับสินค้าหรือบริการ</p>
                <p>2. กรุณาชำระเงินภายใน 30 วัน มิฉะนั้นจำเป็นต้องคิดดอกเบี้ย 1.5% ต่อเดือน</p>
                <p>3. หลังจากชำระเงินแล้วกรุณานำส่งใบสำคัญจ่ายตามที่อยู่และอีเมลที่ระบุไว้ข้างต้น</p>
              </div>
            </div>
            
            <div className="w-[48%] space-y-[0.3em] text-[0.9em]">
              <TotalRow label="Subtotal" value={`${sym}${fmtNum(subtotal)}`} />
              {discount > 0 && <TotalRow label={`Discount (${discountPct}%)`} value={`−${sym}${fmtNum(discount)}`} light />}
              {vat > 0 && <TotalRow label={`VAT (${vatPct}%)`} value={`${sym}${fmtNum(vat)}`} light />}
              <div className="border-t-2 border-gray-800 pt-[0.4em] mt-[0.4em]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 text-[1.1em]">Grand Total</span>
                  <span className="font-bold text-gray-900 text-[1.2em] font-mono">{sym}{fmtNum(grandTotal)}</span>
                </div>
              </div>
              {wht > 0 && (
                <>
                  <TotalRow label={`WHT (${whtPct}%)`} value={`−${sym}${fmtNum(wht)}`} light />
                  <div className="border-t border-gray-300 pt-[0.3em] mt-[0.2em]">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-700 text-[1em]">Net Payable</span>
                      <span className="font-semibold text-gray-700 text-[1.1em] font-mono">{sym}{fmtNum(netPayable)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Signature Blocks */}
        <div className="mt-[4%] pt-[3%] grid grid-cols-2 gap-[15%] text-center text-[0.85em] font-semibold text-gray-800">
          <div>
            <p className="mb-[3.5em]">{leftSignatureLabel}</p>
            <div className="flex flex-col items-center justify-end h-[4em] mb-[0.5em] relative">
              {profile?.signature_url && (
                <img src={profile.signature_url} alt="Signature" className="absolute bottom-1 max-h-full max-w-full object-contain" />
              )}
            </div>
            <p className="font-normal">( {profile?.seller_name || '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} )</p>
          </div>
          <div>
            <p className="mb-[3.5em]">ผู้อนุมัติ</p>
            <div className="flex flex-col items-center justify-end h-[4em] mb-[0.5em]">
              <div className="w-full border-b border-gray-400 border-dashed mb-2" />
            </div>
            <p className="font-normal">( {'\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0'} )</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TotalRow({ label, value, light }) {
  return (
    <div className="flex items-center justify-between">
      <span className={light ? 'text-gray-500' : 'text-gray-700'}>{label}</span>
      <span className={`font-mono ${light ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>{value}</span>
    </div>
  );
}

// Convert ISO string to local "YYYY-MM-DD" for <input type=date>.
function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromLocalInput(local) {
  if (!local) return null;
  // Use T00:00:00 to assume midnight in the local timezone
  return new Date(local + 'T00:00:00').toISOString();
}

// ---------------------------------------------------------------------------
// DocumentEditor — split-view (left form + right preview & mindmap)
// ---------------------------------------------------------------------------

function DocumentEditor({ p, clients, profiles, settings, onUpdate, onClose, onDelete, sym }) {
  const [clientId, setClientId] = useState(p.client_id || '');
  const [refName, setRefName] = useState(p.project_name || p.reference_name || '');
  const [status, setStatus] = useState(p.status || 'draft');
  const [discountPct, setDiscountPct] = useState(p.discount_pct || 0);
  const [vatPct, setVatPct] = useState(p.vat_pct !== undefined ? p.vat_pct : 7);
  const [whtPct, setWhtPct] = useState(p.wht_pct || 0);
  const [issueDate, setIssueDate] = useState(p.issue_date || (p.created_at ? p.created_at.slice(0, 10) : new Date().toISOString().slice(0, 10)));
  const [startAt, setStartAt] = useState(toLocalInput(p.start_at));
  const [endAt, setEndAt] = useState(toLocalInput(p.end_at));
  const [poNumber, setPoNumber] = useState(p.po_number || '');
  const [poFileUrl, setPoFileUrl] = useState(p.po_file_url || null);
  const [lineItems, setLineItems] = useState(p.doc_line_items || p.line_items || []);
  const [expenses, setExpenses] = useState(p.doc_expenses || p.expenses || []);
  const [clientModalOpen, setClientModalOpen] = useState(false);

  // --- Resizable panel ---
  const [panelWidth, setPanelWidth] = useState(() => window.innerWidth * 0.96);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(null);

  // --- Resizable Mindmap (Middle Pane) ---
  const [mindmapWidth, setMindmapWidth] = useState(() => (window.innerWidth * 0.96) * 0.43);
  const [mindmapDragging, setMindmapDragging] = useState(false);
  const mindmapDragRef = useRef(null);

  // --- Resizable Form (Left Pane) ---
  const [formWidth, setFormWidth] = useState(() => (window.innerWidth * 0.96) * 0.25);
  const [formDragging, setFormDragging] = useState(false);
  const formDragRef = useRef(null);

  useEffect(() => {
    if (!dragging && !mindmapDragging && !formDragging) return;
    const onMove = (e) => {
      const x = e.clientX ?? e.touches?.[0]?.clientX;
      if (x == null) return;
      if (dragging) {
        const newW = Math.max(600, Math.min(window.innerWidth * 0.98, window.innerWidth - x));
        setPanelWidth(newW);
      } else if (mindmapDragging) {
        // Handle is between Mindmap and Preview.
        // It controls the width of the Mindmap.
        const panelLeft = window.innerWidth - panelWidth;
        const mindmapLeft = panelLeft + formWidth;
        const newW = x - mindmapLeft;
        setMindmapWidth(Math.max(300, Math.min(panelWidth - formWidth - 300, newW)));
      } else if (formDragging) {
        const panelLeft = window.innerWidth - panelWidth;
        const newW = x - panelLeft;
        setFormWidth(Math.max(300, Math.min(panelWidth - mindmapWidth - 300, newW)));
      }
    };
    const onUp = () => { setDragging(false); setMindmapDragging(false); setFormDragging(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging, mindmapDragging, formDragging, panelWidth, formWidth, mindmapWidth]);

  // --- Auto-scale on Window Resize ---
  const layoutRef = useRef({ panel: window.innerWidth * 0.96, form: (window.innerWidth * 0.96) * 0.25, mindmap: (window.innerWidth * 0.96) * 0.43 });
  useEffect(() => {
    layoutRef.current = { panel: panelWidth, form: formWidth, mindmap: mindmapWidth };
  }, [panelWidth, formWidth, mindmapWidth]);

  useEffect(() => {
    const handleResize = () => {
      const newPanelWidth = window.innerWidth * 0.96;
      const oldPanelWidth = layoutRef.current.panel;
      if (oldPanelWidth && newPanelWidth !== oldPanelWidth) {
        const scale = newPanelWidth / oldPanelWidth;
        setPanelWidth(newPanelWidth);
        setFormWidth(layoutRef.current.form * scale);
        setMindmapWidth(layoutRef.current.mindmap * scale);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --- Manual Save Tracking ---
  const currentStateStr = JSON.stringify({
    client_id: clientId, project_name: refName, status,
    discount_pct: discountPct, vat_pct: vatPct, wht_pct: whtPct,
    issue_date: issueDate,
    start_at: fromLocalInput(startAt),
    end_at: fromLocalInput(endAt),
    po_number: poNumber, po_file_url: poFileUrl,
    line_items: lineItems, expenses,
  });
  const [initialStateStr, setInitialStateStr] = useState(currentStateStr);
  const isDirty = currentStateStr !== initialStateStr;
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
    setIsSaving(true);
    try {
      await onUpdate({
        client_id: clientId, project_name: refName, status,
        discount_pct: discountPct, vat_pct: vatPct, wht_pct: whtPct,
        issue_date: issueDate || null,
        start_at: fromLocalInput(startAt),
        end_at: fromLocalInput(endAt),
        po_number: poNumber, po_file_url: poFileUrl,
      }, lineItems, expenses);
      setInitialStateStr(currentStateStr);
    } catch (err) {
      console.error('[Save Error]', err);
      alert('Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  const { subtotal, discount, vat, grandTotal, wht, netPayable } = calcTotals(lineItems, discountPct, vatPct, whtPct);
  const expTotal = calcExpensesTotal(expenses);
  const profit = netPayable - expTotal;
  const client = clients.find((c) => c.id === clientId);

  // PDF
  const previewRef = useRef(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  // --- Preview doc type ---
  const statusToDocKey = { draft: 'quotation', po: 'purchase_order', invoiced: 'invoice', paid: 'receipt' };
  const [previewDocType, setPreviewDocType] = useState(statusToDocKey[status] || 'quotation');

  const handleDownloadPDF = async (docStatusVal, docLabel) => {
    const el = previewRef.current;
    if (!el || pdfBusy) return;
    setPdfBusy(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { default: jsPDF } = await import('jspdf');
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height / canvas.width) * pdfW;
      const finalW = imgH > pdfH ? (canvas.width / canvas.height) * pdfH : pdfW;
      const finalH = imgH > pdfH ? pdfH : imgH;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, finalW, finalH);
      const label = docLabel || 'Document';
      pdf.save(`${p.qt_number}-${label}.pdf`);
    } catch (err) {
      console.error('[PDF export]', err);
    } finally {
      setPdfBusy(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-white/30 transition-colors';
  const labelCls = 'block text-[10px] tracking-widest2 uppercase text-white/40 mb-1';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }} className="fixed inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="relative ml-auto h-full bg-ink-950 border-l border-white/10 flex flex-col overflow-hidden"
        style={{ width: panelWidth }}>

        {/* Resize handle */}
        <div
          ref={dragRef}
          onMouseDown={() => setDragging(true)}
          onTouchStart={() => setDragging(true)}
          className={[
            'absolute left-0 top-0 bottom-0 w-2 z-30 cursor-col-resize flex items-center justify-center group transition-colors',
            dragging ? 'bg-white/10' : 'hover:bg-white/5',
          ].join(' ')}
        >
          <div className={[
            'w-0.5 h-10 rounded-full transition-colors',
            dragging ? 'bg-white/30' : 'bg-white/10 group-hover:bg-white/20',
          ].join(' ')} />
        </div>

        {/* Header */}
        <header className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div>
            <p className="text-[10px] tracking-widest2 uppercase text-white/40">{p.qt_number}</p>
            <h2 className="text-sm text-white">{refName || 'New Quotation'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!isDirty || isSaving}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-[11px] transition-colors ${isDirty
                  ? 'border-blue-500 bg-blue-500/20 text-blue-200 hover:bg-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.2)]'
                  : 'border-white/10 text-white/40'
                }`}
            >
              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              {isSaving ? 'Saving...' : (isDirty ? 'Save Changes' : 'Saved')}
            </button>

            <button
              type="button"
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors text-[11px]"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>

            <button onClick={onClose} className="w-8 h-8 ml-2 rounded-full border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* SPLIT VIEW */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">

          {/* ====== LEFT PANE — Editor Form ====== */}
          <div
            className="shrink-0 min-w-0 border-b lg:border-b-0 lg:border-r border-white/10 bg-[#141416] overflow-y-auto pretty-scroll relative flex flex-col"
            style={{ width: formWidth }}
          >
            <div className="px-5 py-5 space-y-5">

              {/* Meta */}
              <section className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls + ' !mb-0'}>Client</label>
                    <button type="button" onClick={() => setClientModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] text-white/30 hover:text-white/60 transition-colors">
                      <Settings2 className="w-3 h-3" /> <Plus className="w-2.5 h-2.5" />
                    </button>
                  </div>
                  <ClientCombobox clients={clients} value={clientId} onChange={setClientId} onCreateClient={(name) => alert('Please add clients via Settings.')} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Project Name</label>
                    <input type="text" value={refName} onChange={(e) => setRefName(e.target.value)}
                      placeholder="e.g. TVC Spring Campaign" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Document Date</label>
                    <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className={inputCls + ' text-white/80'} />
                  </div>
                  <div>
                    <label className={labelCls}>Event Start</label>
                    <input type="date" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputCls + ' text-white/80'} />
                  </div>
                  <div>
                    <label className={labelCls}>Event End</label>
                    <input type="date" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={inputCls + ' text-white/80'} />
                  </div>
                  <div className="sm:col-span-3">
                    <label className={labelCls}>Status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls + ' appearance-none'}>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <option key={k} value={k}>{v.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>

              {/* Line Items */}
              <EditorSection title="Line Items" hint="Services billed to the client">
                <LineItemsEditor items={lineItems} onChange={setLineItems} sym={sym} />
              </EditorSection>

              {/* Totals — separated VAT + WHT */}
              <section className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-4 space-y-2">
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div>
                    <label className={labelCls}>Discount %</label>
                    <input type="number" min="0" max="100" step="0.5"
                      value={discountPct} onChange={(e) => setDiscountPct(Number(e.target.value) || 0)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>VAT %</label>
                    <input type="number" min="0" max="100" step="0.5"
                      value={vatPct} onChange={(e) => setVatPct(Number(e.target.value) || 0)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>WHT %</label>
                    <input type="number" min="0" max="100" step="0.5"
                      value={whtPct} onChange={(e) => setWhtPct(Number(e.target.value) || 0)} className={inputCls} />
                  </div>
                </div>
                <Row label="Subtotal" value={formatMoney(subtotal, sym)} />
                {discount > 0 && <Row label={`Discount (${discountPct}%)`} value={`−${formatMoney(discount, sym)}`} accent="text-amber-300" />}
                {vat > 0 && <Row label={`VAT (${vatPct}%)`} value={formatMoney(vat, sym)} accent="text-white/50" />}
                <div className="border-t border-white/10 pt-2">
                  <Row label="Grand Total" value={formatMoney(grandTotal, sym)} bold accent="text-white" />
                </div>
                {wht > 0 && <Row label={`WHT (${whtPct}%)`} value={`−${formatMoney(wht, sym)}`} accent="text-orange-300" />}
                {wht > 0 && (
                  <div className="border-t border-white/10 pt-2">
                    <Row label="Net Payable" value={formatMoney(netPayable, sym)} bold accent="text-blue-300" />
                  </div>
                )}
              </section>

              {/* PO Upload */}
              <EditorSection title="Purchase Order" hint="Upload the client's PO document to Backblaze B2">
                <POUploadSection poNumber={poNumber} poFileUrl={poFileUrl}
                  onPoNumberChange={setPoNumber}
                  onPoFileUrlChange={(url) => { setPoFileUrl(url); if (status === 'quoted') setStatus('po_received'); }}
                  inputCls={inputCls} labelCls={labelCls} />
              </EditorSection>

              {/* Expenses */}
              <EditorSection title="Production Expenses" hint="Internal costs — also editable on the Mindmap →">
                <ExpensesEditor items={expenses} onChange={setExpenses} sym={sym} />
              </EditorSection>

              {/* Profitability */}
              <section className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-4 space-y-2">
                <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-2">Profitability</p>
                <Row label="Net Payable" value={formatMoney(netPayable, sym)} />
                <Row label="Total Expenses" value={`−${formatMoney(expTotal, sym)}`} accent="text-amber-300" />
                <div className="border-t border-white/10 pt-2">
                  <Row label="Net Profit" value={formatMoney(profit, sym)}
                    accent={profit >= 0 ? 'text-emerald-300' : 'text-red-300'} bold />
                </div>
              </section>
            </div>
          </div>

          {/* ====== MIDDLE PANE — Interactive Expense Mindmap ====== */}
          <div
            className="shrink-0 min-w-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#1a1a1e] flex flex-col relative"
            style={{ width: mindmapWidth }}
          >
            
            {/* Form Resize handle (moved here to avoid scrollbar clash) */}
            <div
              ref={formDragRef}
              onMouseDown={() => setFormDragging(true)}
              onTouchStart={() => setFormDragging(true)}
              className={[
                'absolute left-0 top-0 bottom-0 w-2 z-30 cursor-col-resize flex items-center justify-center group transition-colors -ml-1',
                formDragging ? 'bg-white/10' : 'hover:bg-white/5',
              ].join(' ')}
            >
              <div className={[
                'w-0.5 h-10 rounded-full transition-colors',
                formDragging ? 'bg-white/30' : 'bg-white/10 group-hover:bg-white/20',
              ].join(' ')} />
            </div>

            <div className="w-full flex-1 flex flex-col">
              <ExpenseMindmap
                expenses={expenses}
                projectName={refName || p.qt_number}
                sym={sym}
                onExpensesChange={setExpenses}
                onProjectNameChange={setRefName}
              />
            </div>
          </div>

          {/* ====== RIGHT PANE — Live A4 Preview ====== */}
          <div
            className="shrink-0 lg:flex-1 min-w-0 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#1a1a1e] overflow-y-auto pretty-scroll flex flex-col relative"
          >
            {/* Mindmap Resize handle */}
            <div
              ref={mindmapDragRef}
              onMouseDown={() => setMindmapDragging(true)}
              onTouchStart={() => setMindmapDragging(true)}
              className={[
                'absolute left-0 top-0 bottom-0 w-2 z-30 cursor-col-resize flex items-center justify-center group transition-colors -ml-1',
                mindmapDragging ? 'bg-white/10' : 'hover:bg-white/5',
              ].join(' ')}
            >
              <div className={[
                'w-0.5 h-10 rounded-full transition-colors',
                mindmapDragging ? 'bg-white/30' : 'bg-white/10 group-hover:bg-white/20',
              ].join(' ')} />
            </div>

            <div className="p-4 sm:p-6 lg:p-8 flex-1 flex flex-col items-center pl-6">
              <div className="w-full shrink-0" style={{ containerType: 'inline-size' }}>
                <DocTypeTabs
                  activeType={previewDocType}
                  onSelect={setPreviewDocType}
                  onDownload={handleDownloadPDF}
                  pdfBusy={pdfBusy}
                  hasPO={!!poFileUrl}
                />
                <div ref={previewRef}>
                  <DocumentPreview
                    project={{ ...p, status }}
                    client={client}
                    profile={profiles?.find(pr => pr.is_default) || profiles?.[0]}
                    lineItems={lineItems}
                    discountPct={discountPct}
                    vatPct={vatPct}
                    whtPct={whtPct}
                    issueDate={issueDate}
                    refName={refName}
                    sym={sym}
                    overrideDocType={previewDocType}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Quick Client Modal */}
      <AnimatePresence>
        {clientModalOpen && (
          <QuickClientModal
            onAddClient={onAddClientFull}
            onClose={(newId) => {
              setClientModalOpen(false);
              if (newId) setClientId(newId);
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// EditorSection
// ---------------------------------------------------------------------------

function EditorSection({ title, hint, children }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
        <div className="text-left">
          <p className="text-xs text-white/80">{title}</p>
          {hint && <p className="text-[10px] text-white/30 mt-0.5">{hint}</p>}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-white/40 transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------------------
// LineItemsEditor
// ---------------------------------------------------------------------------

function LineItemsEditor({ items, onChange, sym }) {
  const add = () => onChange([...items, { id: `li-${Date.now()}`, description: '', qty: 1, unit_price: 0, unit_name: 'unit' }]);
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx, key, val) => onChange(items.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));

  const cellCls = 'px-2 py-2 bg-white/5 border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-white/30 transition-colors';

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_50px_60px_72px_28px] gap-1 text-[10px] tracking-widest2 uppercase text-white/35 px-0.5">
          <span>Service</span><span>Qty</span><span>Unit</span><span className="text-right">Price</span><span />
        </div>
      )}
      {items.map((it, i) => (
        <div key={it.id || i} className="grid grid-cols-[1fr_50px_60px_72px_28px] gap-1 items-center">
          <input value={it.description || it.service_name || ''} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Service name" className={cellCls} />
          <input type="number" min="0" step="1" value={it.qty !== undefined ? it.qty : (it.quantity || '')} onChange={(e) => update(i, 'qty', e.target.value)} className={cellCls + ' text-center'} />
          <input value={it.unit_name || ''} onChange={(e) => update(i, 'unit_name', e.target.value)} placeholder="unit" className={cellCls} />
          <input type="number" min="0" step="100" value={it.unit_price !== undefined ? it.unit_price : (it.price_per_unit || '')} onChange={(e) => update(i, 'unit_price', e.target.value)} className={cellCls + ' text-right'} />
          <button type="button" onClick={() => remove(i)} className="w-6 h-6 flex items-center justify-center rounded text-white/20 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white transition-colors mt-1">
        <Plus className="w-3 h-3" /> Add line item
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpensesEditor
// ---------------------------------------------------------------------------

function ExpensesEditor({ items, onChange, sym }) {
  const add = () => onChange([...items, { id: `ex-${Date.now()}`, description: '', category: '', amount: 0, expense_date: new Date().toISOString().slice(0, 10) }]);
  const remove = (idx) => onChange(items.filter((_, i) => i !== idx));
  const update = (idx, key, val) => onChange(items.map((it, i) => (i === idx ? { ...it, [key]: val } : it)));

  const cellCls = 'px-2 py-2 bg-white/5 border border-white/10 rounded-md text-xs text-white focus:outline-none focus:border-white/30 transition-colors';
  const total = calcExpensesTotal(items);

  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <div className="grid grid-cols-[1fr_90px_80px_28px] gap-1 text-[10px] tracking-widest2 uppercase text-white/35 px-0.5">
          <span>Expense</span><span>Date</span><span className="text-right">Amount</span><span />
        </div>
      )}
      {items.map((it, i) => (
        <div key={it.id || i} className="grid grid-cols-[1fr_90px_80px_28px] gap-1 items-center">
          <input value={it.description || it.expense_name || ''} onChange={(e) => update(i, 'description', e.target.value)} placeholder="e.g. Crew, Equipment" className={cellCls} />
          <input type="date" value={it.expense_date || it.date || ''} onChange={(e) => update(i, 'expense_date', e.target.value)} className={cellCls + ' text-white/60'} />
          <input type="number" min="0" step="100" value={it.amount || 0} onChange={(e) => update(i, 'amount', e.target.value)} className={cellCls + ' text-right'} />
          <button type="button" onClick={() => remove(i)} className="w-6 h-6 flex items-center justify-center rounded text-white/20 hover:text-red-400 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between mt-1">
        <button type="button" onClick={add} className="inline-flex items-center gap-1 text-[11px] text-white/40 hover:text-white transition-colors">
          <Plus className="w-3 h-3" /> Add expense
        </button>
        {items.length > 0 && <span className="text-[11px] text-white/40 font-mono">Total: {formatMoney(total, sym)}</span>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// POUploadSection
// ---------------------------------------------------------------------------

function POUploadSection({ poNumber, poFileUrl, onPoNumberChange, onPoFileUrlChange, inputCls, labelCls }) {
  const fileRef = useRef(null);
  const [uploadState, setUploadState] = useState(poFileUrl ? 'success' : 'idle');
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadError, setUploadError] = useState('');

  const handleFile = async (file) => {
    if (!file) return;
    setUploadState('uploading'); setUploadPct(0); setUploadError('');
    try {
      const result = await uploadPOFile(file, (pct) => setUploadPct(pct));
      onPoFileUrlChange(result.url); setUploadState('success');
    } catch (e) {
      setUploadError(e.message || String(e)); setUploadState('error');
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>PO Number</label>
          <input type="text" value={poNumber} onChange={(e) => onPoNumberChange(e.target.value)} placeholder="e.g. PO-2026-0042" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>PO Document</label>
          {uploadState === 'success' && poFileUrl ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-emerald-500/10 border border-emerald-500/30">
              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <a href={poFileUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs text-emerald-300 hover:text-emerald-200 truncate flex items-center gap-1">
                File uploaded <ExternalLink className="w-3 h-3" />
              </a>
              <button type="button" onClick={() => { setUploadState('idle'); onPoFileUrlChange(null); }}
                className="ml-auto text-white/30 hover:text-white/60"><X className="w-3 h-3" /></button>
            </div>
          ) : (
            <div onClick={() => fileRef.current?.click()}
              onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer?.files?.[0]); }}
              onDragOver={(e) => e.preventDefault()}
              className={['relative flex items-center justify-center gap-2 px-3 py-3 rounded-md border border-dashed cursor-pointer transition-colors',
                uploadState === 'uploading' ? 'border-amber-500/40 bg-amber-500/5' :
                  uploadState === 'error' ? 'border-red-500/40 bg-red-500/5' : 'border-white/15 bg-white/[0.02] hover:border-white/30',
              ].join(' ')}>
              {uploadState === 'uploading' ? (
                <><Loader2 className="w-4 h-4 animate-spin text-amber-400" /><span className="text-xs text-amber-300">Uploading… {uploadPct}%</span>
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/5"><div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${uploadPct}%` }} /></div></>
              ) : uploadState === 'error' ? (
                <><AlertCircle className="w-4 h-4 text-red-400" /><span className="text-xs text-red-300">{uploadError || 'Upload failed'}</span></>
              ) : (
                <><Upload className="w-4 h-4 text-white/30" /><span className="text-xs text-white/40">Drop PDF or click to browse</span></>
              )}
              <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
