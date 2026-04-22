// ---------------------------------------------------------------------------
// TypographySection — the editor drawer panel that lets the user swap fonts
// for each of the three semantic roles (body / display / brand).
//
// Architecture:
//   • Reads / writes fontSettings on the content store (store/content.jsx).
//   • The store applies every change to :root CSS custom properties, which
//     Tailwind's font-* utilities resolve, so the whole site repaints live.
//   • Picking a font that isn't preloaded triggers a single Google Fonts
//     <link> injection via lib/fontLoader.js.
//   • "Save" commits the current settings to Supabase's site_settings row.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useRef, useState } from 'react';
import { Type, Cloud, CloudOff, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react';
import { useContent } from '../store/content';
import {
  FONT_CATALOG,
  FONT_CATEGORY_LABELS,
  TRACKING_PRESETS,
  findFontByFamily,
  findFontById,
} from '../data/fontCatalog';
import { ensureFontLoaded } from '../lib/fontLoader';

// The three roles driven by this panel, in the order they're presented.
const ROLES = [
  {
    key:     'brand',
    label:   'Brand',
    hint:    'Handwritten signature used in the intro sequence.',
    sample:  'Natthawut Niyomrot',
    sampleSize: 'text-2xl',
  },
  {
    key:     'display',
    label:   'Display',
    hint:    'Section headings across the site and modal titles.',
    sample:  'Short Films',
    sampleSize: 'text-2xl',
  },
  {
    key:     'body',
    label:   'Body',
    hint:    'Navigation, project cards, paragraphs, editor text.',
    sample:  'Cinematic storytelling, crafted frame by frame.',
    sampleSize: 'text-sm',
  },
];

// Dropdown option list, grouped by category (sans / serif / script). Memoised
// at module scope since the catalog is static.
const CATEGORY_ORDER = ['sans', 'serif', 'script'];
const GROUPED_CATALOG = CATEGORY_ORDER.map((cat) => ({
  key:   cat,
  label: FONT_CATEGORY_LABELS[cat],
  items: FONT_CATALOG.filter((f) => f.category === cat),
}));

// localStorage keys for the collapsed/expanded UI state so the editor
// remembers your preference across sessions.
const PANEL_OPEN_KEY = 'amphitheatre:editor:typographyOpen:v1';
const ROLE_OPEN_KEY  = 'amphitheatre:editor:typographyRole:v1';

function loadBool(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === '1') return true;
    if (raw === '0') return false;
    return fallback;
  } catch { return fallback; }
}
function storeBool(key, value) {
  try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* ignore */ }
}
function loadStr(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function storeStr(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export default function TypographySection() {
  const { fontSettings, setFontSettings, saveFontSettings, hasSupabase } = useContent();

  // Panel open/closed state (the "category" collapse) — default closed so
  // the editor isn't visually busy on open. Persisted across reloads.
  const [panelOpen, setPanelOpen] = useState(() => loadBool(PANEL_OPEN_KEY, false));
  useEffect(() => { storeBool(PANEL_OPEN_KEY, panelOpen); }, [panelOpen]);

  // Which role card is currently expanded inside the panel. Only one open
  // at a time so the UI stays compact. Empty string = all collapsed.
  const [openRole, setOpenRole] = useState(() => loadStr(ROLE_OPEN_KEY, 'brand'));
  useEffect(() => { storeStr(ROLE_OPEN_KEY, openRole); }, [openRole]);

  // Track what was last committed (to Supabase OR accepted from Supabase on
  // mount) so we can show a dirty indicator on the Save button. Initialised
  // from the current settings — any user change flips the dirty flag.
  const initialSnapshotRef = useRef(JSON.stringify(fontSettings));
  const [cleanSnapshot, setCleanSnapshot] = useState(() => initialSnapshotRef.current);

  // If fontSettings updates from a source OTHER than the UI (the cloud fetch
  // in content store), sync the clean snapshot so the user doesn't see a
  // false "unsaved" badge on first load.
  useEffect(() => {
    // Once the Supabase round-trip finishes, the store replaces fontSettings
    // with the cloud row. Consider that a clean baseline.
    const snap = JSON.stringify(fontSettings);
    // Only promote to clean if we haven't been edited yet (i.e. the cleanSnapshot
    // still matches the initial snapshot). This prevents a slow cloud response
    // from wiping out the user's mid-edit changes.
    if (cleanSnapshot === initialSnapshotRef.current && snap !== initialSnapshotRef.current) {
      setCleanSnapshot(snap);
      initialSnapshotRef.current = snap;
    }
  }, [fontSettings, cleanSnapshot]);

  const isDirty = useMemo(
    () => JSON.stringify(fontSettings) !== cleanSnapshot,
    [fontSettings, cleanSnapshot]
  );

  // 'idle' | 'saving' | 'saved' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError,  setSaveError]  = useState(null);

  const handleSave = async () => {
    setSaveStatus('saving');
    setSaveError(null);
    const res = await saveFontSettings();
    if (res.ok) {
      setSaveStatus('saved');
      setCleanSnapshot(JSON.stringify(fontSettings));
      initialSnapshotRef.current = JSON.stringify(fontSettings);
      setTimeout(() => setSaveStatus((s) => (s === 'saved' ? 'idle' : s)), 2400);
    } else {
      setSaveStatus('error');
      setSaveError(res.error || 'Save failed.');
    }
  };

  // Pre-warm fonts that are currently selected on mount — if the user lands
  // on the editor with a non-default font in their cloud settings, this
  // fetches the Google Fonts stylesheet so the preview renders in the
  // correct face immediately.
  useEffect(() => {
    for (const role of ['body', 'display', 'brand']) {
      const entry = findFontByFamily(fontSettings[role].family);
      if (entry) ensureFontLoaded(entry.googleParam);
    }
     
  }, []);

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02]">
      {/* Category header — always clickable; chevron rotates when open. */}
      <div className="flex items-center gap-2 p-2.5">
        <button
          type="button"
          onClick={() => setPanelOpen((o) => !o)}
          className="flex-1 flex items-center gap-2 text-left px-2 py-1 text-white/85 hover:text-white"
          aria-expanded={panelOpen}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${panelOpen ? '' : '-rotate-90'}`}
          />
          <Type className="w-3.5 h-3.5 text-white/60" />
          <span className="text-[11px] tracking-widest2 uppercase text-white/70">
            Typography
          </span>
          {isDirty && (
            <span
              className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-amber-300"
              title="Unsaved font changes"
            />
          )}
          <span className="ml-2 text-[10px] text-white/35 hidden sm:inline">
            · {ROLES.length} roles
          </span>
        </button>

        {panelOpen && (
          <SaveButton
            onClick={handleSave}
            status={saveStatus}
            isDirty={isDirty}
            hasSupabase={hasSupabase}
          />
        )}
      </div>

      {panelOpen && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/5">
          <p className="text-[11px] text-white/40 pt-1">
            Pick fonts for each role — changes apply live across the whole site.
          </p>

          {saveStatus === 'error' && saveError && (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-200/90">
              <AlertCircle className="w-3.5 h-3.5 mt-[1px] shrink-0" />
              <span className="break-words">{saveError}</span>
            </div>
          )}

          <div className="space-y-2">
            {ROLES.map((role) => (
              <RoleCard
                key={role.key}
                role={role}
                settings={fontSettings[role.key]}
                expanded={openRole === role.key}
                onToggle={() => setOpenRole(openRole === role.key ? '' : role.key)}
                onChange={(next) => {
                  setFontSettings((fs) => ({ ...fs, [role.key]: { ...fs[role.key], ...next } }));
                }}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// RoleCard — one of the three (Brand / Display / Body) font-role cards.

function RoleCard({ role, settings, expanded, onToggle, onChange }) {
  const current = findFontByFamily(settings.family);
  const weights = current?.weights ?? [400];

  // When the user picks a new font, we may need to:
  //   1. Clamp the weight to an available one (the new font might not ship
  //      the currently-selected weight).
  //   2. Lazy-load the Google Fonts CSS so the preview updates immediately.
  const handleFontChange = async (id) => {
    const next = findFontById(id);
    if (!next) return;

    // Fire-and-forget load; CSS var swap happens instantly so the browser
    // falls back through the stack while the font downloads.
    ensureFontLoaded(next.googleParam);

    const safeWeight = next.weights.includes(settings.weight)
      ? settings.weight
      : next.weights[Math.floor(next.weights.length / 2)] || next.weights[0];

    onChange({ family: next.family, weight: safeWeight });
  };

  const fontLabel = current?.name ?? 'Custom';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
      {/* Collapsed header — clicking toggles the controls drawer. Always
          shows the live preview so you can scan all three roles at a glance. */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/[0.03] transition-colors"
        aria-expanded={expanded}
      >
        <ChevronDown
          className={`w-3.5 h-3.5 text-white/50 shrink-0 transition-transform ${expanded ? '' : '-rotate-90'}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-sm text-white/85">{role.label}</div>
            <div className="text-[10.5px] text-white/40">
              {fontLabel} · {settings.weight}
            </div>
          </div>
          <div
            className="text-[15px] text-white/90 leading-tight truncate mt-0.5"
            style={{
              fontFamily:    settings.family,
              fontWeight:    settings.weight,
              letterSpacing: settings.tracking,
            }}
          >
            {role.sample}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-3 border-t border-white/5">
          <div className="text-[10.5px] text-white/40 leading-snug">
            {role.hint}
          </div>

          {/* Larger preview only shown when the card is expanded. */}
          <div
            className={`${role.sampleSize} text-white/90 leading-tight truncate py-1 border-b border-white/5`}
            style={{
              fontFamily:    settings.family,
              fontWeight:    settings.weight,
              letterSpacing: settings.tracking,
            }}
          >
            {role.sample}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Control label="Font family">
              <select
                value={current?.id ?? ''}
                onChange={(e) => handleFontChange(e.target.value)}
                className={selectClass}
              >
                {!current && (
                  <option value="" disabled>
                    Custom ({settings.family.split(',')[0].replace(/"/g, '')})
                  </option>
                )}
                {GROUPED_CATALOG.map((group) => (
                  <optgroup key={group.key} label={group.label}>
                    {group.items.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </Control>

            <Control label="Weight">
              <select
                value={weights.includes(settings.weight) ? settings.weight : weights[0]}
                onChange={(e) => onChange({ weight: Number(e.target.value) })}
                className={selectClass}
                disabled={weights.length <= 1}
              >
                {weights.map((w) => (
                  <option key={w} value={w}>
                    {w} {WEIGHT_LABELS[w] ? `· ${WEIGHT_LABELS[w]}` : ''}
                  </option>
                ))}
              </select>
            </Control>

            <Control label="Letter spacing">
              <select
                value={matchTrackingId(settings.tracking)}
                onChange={(e) => {
                  const preset = TRACKING_PRESETS.find((t) => t.id === e.target.value);
                  if (preset) onChange({ tracking: preset.value });
                }}
                className={selectClass}
              >
                {TRACKING_PRESETS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Control>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveButton — mirrors the visual language of the main editor's Save button
// so the panel feels native to the drawer.

function SaveButton({ onClick, status, isDirty, hasSupabase }) {
  let icon, label, className;

  if (status === 'saving') {
    icon = <Loader2 className="w-3.5 h-3.5 animate-spin" />;
    label = 'Saving…';
    className = 'border-white/15 text-white/80 cursor-wait';
  } else if (status === 'saved') {
    icon = <Check className="w-3.5 h-3.5" />;
    label = 'Saved';
    className = 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10';
  } else if (status === 'error') {
    icon = <AlertCircle className="w-3.5 h-3.5" />;
    label = 'Retry';
    className = 'border-rose-400/40 text-rose-200 bg-rose-500/10 hover:bg-rose-500/15';
  } else if (!hasSupabase) {
    icon = <CloudOff className="w-3.5 h-3.5" />;
    label = 'No cloud';
    className = 'border-amber-400/30 text-amber-200/80 bg-amber-500/5 cursor-not-allowed';
  } else if (isDirty) {
    icon = <Cloud className="w-3.5 h-3.5" />;
    label = (
      <>
        Save fonts
        <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-amber-300 align-middle" />
      </>
    );
    className = 'border-white/20 text-white hover:border-white/40 bg-white/5';
  } else {
    icon = <Cloud className="w-3.5 h-3.5" />;
    label = 'Up to date';
    className = 'border-white/10 text-white/50 cursor-default';
  }

  const disabled =
    status === 'saving' ||
    !hasSupabase ||
    (!isDirty && status === 'idle');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] transition-colors ${className}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers.

function Control({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[10px] text-white/45 mb-1">{label}</span>
      {children}
    </label>
  );
}

const selectClass =
  'w-full bg-ink-800/80 border border-white/10 rounded-md px-2.5 py-2 text-xs text-white/90 focus:outline-none focus:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const WEIGHT_LABELS = {
  100: 'Thin',
  200: 'ExtraLight',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'SemiBold',
  700: 'Bold',
  800: 'ExtraBold',
  900: 'Black',
};

function matchTrackingId(value) {
  const found = TRACKING_PRESETS.find((t) => t.value === value);
  return found?.id ?? 'normal';
}
