// ---------------------------------------------------------------------------
// finance.js — pure money utilities for Theatre Alpha.
//
// All amounts are handled as **integer minor units** internally to dodge
// floating-point rounding (e.g. 0.1 + 0.2 ≠ 0.3). Public functions accept
// numeric majors (THB, USD) and return numeric majors rounded to 2 dp.
// ---------------------------------------------------------------------------

const round2 = (n) => Math.round(n * 100) / 100;

/** Tax amount = gross × rate%. */
export function calcTax(gross, taxRatePct) {
  return round2((Number(gross) || 0) * (Number(taxRatePct) || 0) / 100);
}

/** Net = gross − tax. */
export function calcNet(gross, taxRatePct) {
  return round2((Number(gross) || 0) - calcTax(gross, taxRatePct));
}

/** Format a number as money with the given symbol. */
export function formatMoney(amount, symbol = '฿') {
  const n = Number(amount) || 0;
  const formatted = n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

/** YYYY-MM key for grouping. */
export function monthKey(d) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Group jobs by month and compute gross / tax / net totals.
 * @param {Array} jobs   theatre_alpha_jobs rows
 * @param {number} taxRatePct
 * @returns {Array<{key:string, label:string, gross:number, tax:number, net:number, jobs:Array}>}
 */
export function aggregateByMonth(jobs, taxRatePct) {
  const map = new Map();
  for (const j of jobs) {
    const k = monthKey(j.start_at);
    if (!map.has(k)) map.set(k, { key: k, jobs: [], gross: 0 });
    const bucket = map.get(k);
    bucket.jobs.push(j);
    bucket.gross += Number(j.amount) || 0;
  }
  return [...map.values()]
    .map((b) => ({
      ...b,
      gross: round2(b.gross),
      tax:   calcTax(b.gross, taxRatePct),
      net:   calcNet(b.gross, taxRatePct),
      label: new Date(`${b.key}-01T00:00:00`).toLocaleDateString(undefined, {
        year: 'numeric', month: 'long',
      }),
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Project upcoming payment dates from a job's start_at + billing_cycle_days.
 * Returns rows whose payment_status is not 'paid' and whose due date is in
 * the next `withinDays` window.
 */
export function upcomingPayments(jobs, { withinDays = 60 } = {}) {
  const now = new Date();
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  const out = [];
  for (const j of jobs) {
    if (j.payment_status === 'paid') continue;
    const start = new Date(j.start_at);
    const due = new Date(start.getTime() + (j.billing_cycle_days || 30) * 24 * 60 * 60 * 1000);
    if (due >= now && due <= horizon) {
      out.push({ ...j, due_at: due.toISOString() });
    }
  }
  return out.sort((a, b) => new Date(a.due_at) - new Date(b.due_at));
}

/** Color for FullCalendar event background based on payment_status. */
export function statusColor(status) {
  switch (status) {
    case 'paid':      return { bg: '#10b981', border: '#059669' }; // emerald
    case 'invoiced': return { bg: '#3b82f6', border: '#2563eb' }; // blue
    case 'overdue':  return { bg: '#ef4444', border: '#dc2626' }; // red
    case 'unpaid':
    default:         return { bg: '#6b7280', border: '#4b5563' }; // grey
  }
}
