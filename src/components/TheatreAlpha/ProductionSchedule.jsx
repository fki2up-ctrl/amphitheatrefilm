// ---------------------------------------------------------------------------
// ProductionSchedule — FullCalendar wrapper.
//   • Click a date     → open JobModal for new job.
//   • Click an event   → open JobModal for edit / delete.
//   • Drag/resize event → optimistic update via onUpdate.
// ---------------------------------------------------------------------------

import { useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin    from '@fullcalendar/daygrid';
import timeGridPlugin   from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus } from 'lucide-react';
import JobModal from './JobModal';
import { statusColor } from '../../lib/finance';

export default function ProductionSchedule({ jobs, clients, settings, onCreate, onUpdate, onDelete }) {
  const calRef = useRef(null);
  const [modal, setModal] = useState({ open: false, job: null, defaultStart: null });

  const events = useMemo(() => jobs.map((j) => {
    const c = statusColor(j.status || 'draft');
    const clientName = clients.find(c => c.id === j.client_id)?.company_name;
    const titleStr = j.project_name || j.reference_name || 'Untitled';
    return {
      id: j.id,
      title: clientName ? `${titleStr} — ${clientName}` : titleStr,
      start: j.start_at,
      end:   j.end_at,
      backgroundColor: c.bg,
      borderColor:     c.border,
      textColor: '#fff',
      extendedProps: { job: j },
    };
  }), [jobs, clients]);

  const openNew = (start) => setModal({ open: true, job: null, defaultStart: start || new Date() });
  const openEdit = (job)  => setModal({ open: true, job, defaultStart: null });
  const closeModal = ()   => setModal({ open: false, job: null, defaultStart: null });

  const saveFromModal = async (form) => {
    if (modal.job?.id) {
      await onUpdate(modal.job.id, {
        project_name: form.title, client_id: form.client_id,
        start_at: form.start_at, end_at: form.end_at,
        status: form.payment_status, notes: form.notes,
      });
    } else {
      await onCreate(form);
    }
  };

  const handleDateClick = (info) => openNew(info.date);
  const handleEventClick = (info) => openEdit(info.event.extendedProps.job);

  // Drag-drop / resize → patch start_at + end_at.
  const handleEventChange = async (info) => {
    const job = info.event.extendedProps.job;
    try {
      await onUpdate(job.id, {
        start_at: info.event.start.toISOString(),
        end_at:   (info.event.end || info.event.start).toISOString(),
      });
    } catch (e) {
      info.revert();
      alert(`Failed to reschedule: ${e.message || e}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <h2 className="text-sm tracking-widest2 uppercase text-white/85">Production Schedule</h2>
          <p className="text-[10px] text-white/40 mt-0.5">
            Click a day to add a job. Drag to reschedule.
          </p>
        </div>
        <button type="button" onClick={() => openNew(new Date())}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white text-ink-950 hover:bg-white/90 text-xs">
          <Plus className="w-3.5 h-3.5" /> New job
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-auto px-3 py-3 ta-fc-host">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          height="100%"
          events={events}
          editable
          selectable
          dayMaxEvents={3}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          dateClick={handleDateClick}
          eventClick={handleEventClick}
          eventDrop={handleEventChange}
          eventResize={handleEventChange}
        />
      </div>

      <JobModal
        open={modal.open}
        job={modal.job}
        defaultStart={modal.defaultStart}
        currencySymbol={settings.currency_symbol}
        onClose={closeModal}
        onSave={saveFromModal}
        onDelete={onDelete}
        clients={clients}
      />

      {/* Local FullCalendar dark-theme overrides. Scoped via .ta-fc-host. */}
      <style>{`
        .ta-fc-host .fc { color: #fff; font-size: 12px; }
        .ta-fc-host .fc .fc-toolbar-title { font-size: 14px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.85); }
        .ta-fc-host .fc .fc-button { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.8); padding: 4px 10px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; box-shadow: none; }
        .ta-fc-host .fc .fc-button:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .ta-fc-host .fc .fc-button-primary:not(:disabled).fc-button-active,
        .ta-fc-host .fc .fc-button-primary:not(:disabled):active { background: rgba(255,255,255,0.18); border-color: rgba(255,255,255,0.3); color:#fff; }
        .ta-fc-host .fc-theme-standard td, .ta-fc-host .fc-theme-standard th { border-color: rgba(255,255,255,0.08); }
        .ta-fc-host .fc .fc-col-header-cell { background: rgba(255,255,255,0.03); }
        .ta-fc-host .fc .fc-col-header-cell-cushion { color: rgba(255,255,255,0.6); font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; padding: 6px; }
        .ta-fc-host .fc .fc-daygrid-day-number { color: rgba(255,255,255,0.55); padding: 6px; font-size: 11px; }
        .ta-fc-host .fc .fc-day-today { background: rgba(255,255,255,0.04) !important; }
        .ta-fc-host .fc .fc-day-today .fc-daygrid-day-number { color: #fff; }
        .ta-fc-host .fc-event { cursor: pointer; border-radius: 4px; padding: 1px 4px; }
        .ta-fc-host .fc-event:hover { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}
