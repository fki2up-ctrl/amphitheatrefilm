// ---------------------------------------------------------------------------
// ExportButtons — produce monthly Excel (.xlsx) and PDF reports.
// Both contain: Date | Job | Client | Gross | Tax | Net.
// ---------------------------------------------------------------------------

import { useState } from 'react';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { calcTax, calcNet } from '../../lib/finance';

const fmt = (d) => new Date(d).toLocaleDateString(undefined, {
  year: 'numeric', month: 'short', day: '2-digit',
});

function buildRows(jobs, taxRatePct) {
  return jobs
    .slice()
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
    .map((j) => {
      const gross = Number(j.amount) || 0;
      return {
        date:   fmt(j.start_at),
        title:  j.title || '',
        client: j.client || '',
        gross,
        tax:   calcTax(gross, taxRatePct),
        net:   calcNet(gross, taxRatePct),
      };
    });
}

function totals(rows) {
  return rows.reduce(
    (a, r) => ({ gross: a.gross + r.gross, tax: a.tax + r.tax, net: a.net + r.net }),
    { gross: 0, tax: 0, net: 0 },
  );
}

export default function ExportButtons({ jobs, settings, monthLabel }) {
  const [busy, setBusy] = useState(null); // 'xlsx' | 'pdf' | null

  const exportXlsx = async () => {
    setBusy('xlsx');
    try {
      const ExcelJS = (await import('exceljs')).default;
      const rows = buildRows(jobs, settings.tax_rate_pct);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(monthLabel || 'Theatre Alpha');
      ws.columns = [
        { header: 'Date',     key: 'date',   width: 14 },
        { header: 'Job',      key: 'title',  width: 28 },
        { header: 'Client',   key: 'client', width: 24 },
        { header: `Gross (${settings.currency_code})`, key: 'gross', width: 14, style: { numFmt: '#,##0.00' } },
        { header: `Tax (${settings.currency_code})`,   key: 'tax',   width: 12, style: { numFmt: '#,##0.00' } },
        { header: `Net (${settings.currency_code})`,   key: 'net',   width: 14, style: { numFmt: '#,##0.00' } },
      ];
      ws.getRow(1).font = { bold: true };
      rows.forEach((r) => ws.addRow(r));

      const t = totals(rows);
      const totalRow = ws.addRow({ date: 'Total', title: '', client: '', gross: t.gross, tax: t.tax, net: t.net });
      totalRow.font = { bold: true };

      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      downloadBlob(blob, `theatre-alpha-${monthLabel || 'report'}.xlsx`);
    } catch (e) {
      alert(`Excel export failed: ${e.message || e}`);
    } finally {
      setBusy(null);
    }
  };

  const exportPdf = async () => {
    setBusy('pdf');
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTable = (await import('jspdf-autotable')).default;
      const rows = buildRows(jobs, settings.tax_rate_pct);
      const t = totals(rows);

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
      doc.text('Theatre Alpha — Monthly Report', 40, 50);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text(monthLabel || '', 40, 68);
      doc.text(`Currency: ${settings.currency_code}   Tax: ${settings.tax_rate_pct}%`, 40, 82);

      autoTable(doc, {
        startY: 100,
        head: [['Date', 'Job', 'Client', `Gross (${settings.currency_code})`, `Tax (${settings.currency_code})`, `Net (${settings.currency_code})`]],
        body: rows.map((r) => [
          r.date, r.title, r.client,
          r.gross.toFixed(2), r.tax.toFixed(2), r.net.toFixed(2),
        ]),
        foot: [[
          { content: 'Total', colSpan: 3, styles: { halign: 'right', fontStyle: 'bold' } },
          { content: t.gross.toFixed(2), styles: { fontStyle: 'bold' } },
          { content: t.tax.toFixed(2),   styles: { fontStyle: 'bold' } },
          { content: t.net.toFixed(2),   styles: { fontStyle: 'bold' } },
        ]],
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [30, 30, 30], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 30 },
      });

      doc.save(`theatre-alpha-${monthLabel || 'report'}.pdf`);
    } catch (e) {
      alert(`PDF export failed: ${e.message || e}`);
    } finally {
      setBusy(null);
    }
  };

  const btn = 'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-white/15 text-white/80 hover:text-white hover:border-white/40 text-xs disabled:opacity-50';

  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={exportXlsx} disabled={busy !== null} className={btn}>
        {busy === 'xlsx' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileSpreadsheet className="w-3.5 h-3.5" />}
        Excel
      </button>
      <button type="button" onClick={exportPdf} disabled={busy !== null} className={btn}>
        {busy === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
        PDF
      </button>
    </div>
  );
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
