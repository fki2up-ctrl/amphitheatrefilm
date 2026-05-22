import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  X,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Download,
  Copy,
  Check,
  Lock,
  LockOpen,
  Save as SaveIcon,
  AlertCircle,
  Crop,
  RefreshCw,
  ChevronDown,
  GripVertical,
  Cloud,
  CloudOff,
  Loader2,
  Film,
  Sliders,
} from 'lucide-react';
import { useContent, serializeToProjectsJs, saveProjectsJs } from '../store/content';
import { optimizeCloudinaryUrl, isCloudinaryUrl } from '../utils/cloudinary';
import { supabase, hasSupabase } from '../lib/supabase';
import TypographySection from './TypographySection';
import ImageUploader from './ImageUploader';
import VideoUploader from './VideoUploader';
import AssetManagerSection from './AssetManagerSection';
import AssetPicker from './AssetPicker';
import TheatreAlpha from './TheatreAlpha';
import CinematicPlayer from './CinematicPlayer';
import { resolveEmbed } from '../lib/embed';
import { Clapperboard } from 'lucide-react';

// Preview thumbnails in the editor sidebar are small; 400 px is ample even
// at 2× DPR. `previewSrc` returns the optimized Cloudinary URL when possible,
// or the raw input otherwise — safe to pipe any src through.
const previewSrc = (url, width = 400) => optimizeCloudinaryUrl(url || '', width);

// ---------------------------------------------------------------------------
// Editor drawer — an in-browser UI to edit every piece of site content.
// Changes persist to localStorage automatically. "Export" produces the
// equivalent projects.js source for permanent commits.
//
// Access is gated by Supabase Auth (magic-link email login). Only users
// pre-added to the Supabase auth.users table can sign in — public sign-ups
// are disabled in the Supabase dashboard. Sessions persist across reloads
// via the Supabase client's built-in localStorage storage.
// ---------------------------------------------------------------------------

export default function Editor({ open, onClose }) {
  const c = useContent();
  const [exportOpen, setExportOpen] = useState(false);
  // 'idle' | 'saving' | 'saved' | 'unsupported' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');

  const [gitInfo, setGitInfo] = useState(null);

  // --- Supabase Auth session ---------------------------------------------
  // `session` is `null` when signed out and an object containing the user
  // when signed in. The editor drawer renders the magic-link form until
  // the session is populated.
  const [session, setSession] = useState(null);
  const [authLoaded, setAuthLoaded] = useState(!hasSupabase);

  // Top-level Editor view: 'content' (existing site editor) or 'theatre'
  // (Theatre Alpha studio module). Theatre Alpha widens the drawer.
  const [view, setView] = useState('content');

  useEffect(() => {
    if (!hasSupabase) return;
    let mounted = true;

    // Read the current session synchronously (from localStorage if present).
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setAuthLoaded(true);
    });

    // Subscribe to login / logout events so the UI reacts instantly.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const doSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    setGitInfo(null);

    // --- 1. Cloud sync (Supabase) -----------------------------------------
    // When Supabase is configured, this is the primary write path — the
    // deployed site reads from Supabase, so this is what actually updates
    // production. Runs in parallel with the local file-write path below.
    const cloudPromise = c.hasSupabase
      ? c.saveToCloud().catch((err) => ({ ok: false, error: err.message || String(err) }))
      : Promise.resolve({ ok: true, skipped: true });

    // --- 2. Local dev file write + GitHub push (dev-server only) ----------
    const source = serializeToProjectsJs(c.state);
    const localResult = await saveProjectsJs(source);

    const cloudResult = await cloudPromise;

    // Prefer local result for status text because it carries the richest
    // UX (notSupported → Export fallback). But surface cloud errors too.
    if (localResult.ok) {
      setSaveStatus('saved');
      setGitInfo(localResult.git || null);
      setTimeout(() => setSaveStatus('idle'), 3200);
    } else if (localResult.notSupported) {
      // Production build (no dev endpoint). If cloud save succeeded, treat
      // the whole operation as a success — the site reads from Supabase.
      if (cloudResult.ok && !cloudResult.skipped) {
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 3200);
      } else {
        setSaveStatus('unsupported');
        setExportOpen(true);
        setTimeout(() => setSaveStatus('idle'), 2200);
      }
    } else {
      setSaveStatus('error');
      setSaveError(localResult.error || 'Save failed');
    }

    if (!cloudResult.ok && !cloudResult.skipped) {
      // eslint-disable-next-line no-console
      console.warn('[editor] cloud save error:', cloudResult.error);
    }
  };

  const handleSave = doSave;

  // Unlocked = Supabase session present (real auth) OR Supabase isn't
  // configured at all (dev / preview without env vars — drawer opens freely
  // so you can still edit locally).
  const unlocked = !hasSupabase || Boolean(session);

  const signOut = async () => {
    if (hasSupabase) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
    }
    setSession(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Scrim */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[90] bg-black/50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 32 }}
            className={[
              'fixed right-0 top-0 bottom-0 z-[91] bg-ink-950 border-l border-white/10 flex flex-col transition-[width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
              (view === 'theatre' || view === 'topics')
                ? 'w-screen'
                : 'w-full sm:w-[460px]',
            ].join(' ')}
          >
            {/* Header */}
            <header className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div>
                <p className="text-[10px] tracking-widest2 uppercase text-white/45">
                  {unlocked ? 'Content editor' : 'Locked'}
                </p>
                <h2 className="text-lg">
                  {unlocked ? 'Edit your site' : 'Enter password to edit'}
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close editor"
                className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/40"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {unlocked ? (
              <>
                <EditorTabs view={view} onChange={setView} />

                {view === 'theatre' ? (
                  <div className="flex-1 min-h-0 overflow-hidden px-5 py-5">
                    <TheatreAlpha />
                  </div>
                ) : view === 'topics' ? (
                  <div className="flex-1 min-h-0 overflow-hidden">
                    <ProjectsView c={c} />
                  </div>
                ) : (
                  <>
                    {/* Body — Content tab */}
                    <div className="flex-1 overflow-y-auto pretty-scroll px-5 py-5 space-y-8">
                      <TypographySection />
                      <SiteConfigSection c={c} />
                      <AssetManagerSection />
                      <ProfileSection c={c} />
                      <LandingVideoSection c={c} />
                      <ContactSection c={c} />
                      <BackgroundSection c={c} />

                      <p className="pt-4 text-[11px] text-white/40 leading-relaxed">
                        Edits preview live and persist in your browser. Click{' '}
                        <span className="text-white/70">Save</span> to write them
                        directly to{' '}
                        <code className="text-white/60">src/data/projects.js</code>
                        {' '}— no copy-paste needed.{' '}
                        <span className="text-white/70">Export</span> is only for
                        when you need the raw source (e.g. to paste on a machine
                        without the dev server).
                      </p>
                    </div>
                  </>
                )}

                {view === 'content' && (<>
                  {/* Supabase cloud-sync banner — always visible so you can
                    tell at a glance whether cloud sync is wired up. When the
                    env vars are missing (common on first Vercel deploy) it
                    renders in an "unconfigured" state with setup guidance
                    instead of silently hiding. */}
                  <SyncBanner
                    status={c.syncStatus}
                    error={c.syncError}
                    isDirty={c.isDirty}
                    hasSupabase={c.hasSupabase}
                  />

                  {/* Footer actions */}
                  <footer className="flex items-center gap-2 px-5 py-4 border-t border-white/10">
                    <button
                      onClick={() => {
                        if (window.confirm('Discard all edits and restore the original content?')) {
                          c.reset();
                        }
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/40"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset
                    </button>
                    <button
                      onClick={signOut}
                      title={hasSupabase ? 'Sign out & close' : 'Close editor'}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/40"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      {hasSupabase ? 'Sign out' : 'Close'}
                    </button>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => setExportOpen(true)}
                        title="View / copy the projects.js source"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/40"
                      >
                        <Download className="w-3.5 h-3.5" />
                        Export
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        title={c.isDirty ? 'You have unsaved changes' : 'All changes saved'}
                        className="relative inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-ink-950 text-xs font-medium hover:bg-white/90 disabled:opacity-60"
                      >
                        {/* Dirty dot — only while idle; save-in-progress / saved
                          states already communicate status themselves. */}
                        {c.isDirty && saveStatus === 'idle' && (
                          <span
                            aria-label="Unsaved changes"
                            className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-ink-950 animate-pulse"
                          />
                        )}
                        {saveStatus === 'saved' ? (
                          <><Check className="w-3.5 h-3.5" /> Saved</>
                        ) : saveStatus === 'saving' ? (
                          <><SaveIcon className="w-3.5 h-3.5 animate-pulse" /> Saving…</>
                        ) : saveStatus === 'error' ? (
                          <><AlertCircle className="w-3.5 h-3.5" /> Retry</>
                        ) : (
                          <><SaveIcon className="w-3.5 h-3.5" /> {c.isDirty ? 'Save changes' : 'Save'}</>
                        )}
                      </button>
                    </div>
                  </footer>
                  {saveStatus === 'error' && saveError && (
                    <div className="px-5 py-2 bg-red-500/10 border-t border-red-500/20 text-[11px] text-red-200/90">
                      {saveError}
                    </div>
                  )}
                  {gitInfo && (
                    <div
                      className={`px-5 py-2 border-t text-[11px] leading-snug ${gitInfo.pushed
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200/90'
                        : gitInfo.error
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-200/90'
                          : 'bg-white/5 border-white/10 text-white/60'
                        }`}
                    >
                      {gitInfo.pushed ? (
                        <>
                          <span className="font-medium">✓ Synced to GitHub</span>
                          {' — '}
                          {gitInfo.message}
                        </>
                      ) : gitInfo.error ? (
                        <>
                          <span className="font-medium">⚠ GitHub push failed</span>
                          {' — '}
                          <span className="text-amber-200/75">{gitInfo.error}</span>
                        </>
                      ) : (
                        <span className="text-white/60">{gitInfo.message}</span>
                      )}
                    </div>
                  )}
                </>)}
              </>
            ) : (
              <MagicLinkGate authLoaded={authLoaded} />
            )}
          </motion.aside>

          <ExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            source={serializeToProjectsJs(c.state)}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function PremiumSlider({ label, value, onChange, min, max, step, suffix = '' }) {
  return (
    <div className="space-y-1.5 p-2.5 rounded-lg bg-white/[0.01] border border-white/5 hover:bg-white/[0.02] hover:border-white/10 transition-all duration-150">
      <div className="flex justify-between items-center text-[10px] tracking-wider uppercase text-white/45">
        <span>{label}</span>
        <span className="font-mono text-[10px] text-white/70 bg-white/5 px-1.5 py-0.5 rounded">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-[3px] bg-white/10 rounded appearance-none cursor-pointer accent-white focus:outline-none"
      />
    </div>
  );
}

function SiteConfigSection({ c }) {
  const { siteConfig, setSiteConfig, resetSiteConfig, saveSiteConfig, hasSupabase } = c;
  const [panelOpen, setPanelOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // 'idle' | 'saving' | 'saved' | 'error'
  const [err, setErr] = useState('');

  const doSync = async () => {
    setStatus('saving');
    setErr('');
    const res = await saveSiteConfig();
    if (res.ok) {
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2600);
    } else {
      setStatus('error');
      setErr(res.error || 'Save failed');
    }
  };

  const btnClass = {
    idle: 'border-white/20 text-white hover:border-white/40 bg-white/5',
    saving: 'border-white/15 text-white/80 cursor-wait',
    saved: 'border-emerald-400/40 text-emerald-200 bg-emerald-500/10',
    error: 'border-rose-400/40 text-rose-200 bg-rose-500/10 hover:bg-rose-500/15',
  }[status];

  const btnIcon = {
    idle: <Cloud className="w-3.5 h-3.5" />,
    saving: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
    saved: <Check className="w-3.5 h-3.5" />,
    error: <AlertCircle className="w-3.5 h-3.5" />,
  }[status];

  const btnLabel = {
    idle: 'Save Config',
    saving: 'Saving…',
    saved: 'Saved',
    error: 'Retry',
  }[status];

  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.02]">
      {/* Category header */}
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
          <Sliders className="w-3.5 h-3.5 text-white/60" />
          <span className="text-[11px] tracking-widest2 uppercase text-white/70">
            Project Config
          </span>
          <span className="ml-2 text-[10px] text-white/35 hidden sm:inline">
            · Layout & Motion
          </span>
        </button>

        {panelOpen && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={resetSiteConfig}
              className="text-[9px] tracking-widest uppercase text-white/40 hover:text-white/80 px-2 py-1"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={doSync}
              disabled={!hasSupabase || status === 'saving'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[10px] uppercase tracking-wider transition-colors ${btnClass}`}
            >
              {btnIcon}
              <span>{btnLabel}</span>
            </button>
          </div>
        )}
      </div>

      {panelOpen && (
        <div className="px-4 pb-4 pt-2 space-y-4 border-t border-white/5">
          <p className="text-[10px] text-white/40 leading-snug">
            Configure live portfolio layout columns, sizes, spacing, and animations.
          </p>

          {status === 'error' && err && (
            <div className="flex items-start gap-2 rounded-md border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-[11px] text-rose-200/90">
              <AlertCircle className="w-3.5 h-3.5 mt-[1px] shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* LAYOUT GROUP */}
          <div className="space-y-3">
            <h4 className="text-[9px] tracking-widest uppercase text-white/35 font-bold border-b border-white/5 pb-1">
              Layout Columns & Spacing
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PremiumSlider
                label="Sidebar width"
                value={siteConfig.layout.sidebarWidth}
                suffix="px"
                onChange={(v) => setSiteConfig({ layout: { sidebarWidth: Math.round(v) } })}
                min={200}
                max={360}
                step={2}
              />
              <PremiumSlider
                label="Card gap"
                value={siteConfig.layout.cardGap}
                suffix="px"
                onChange={(v) => setSiteConfig({ layout: { cardGap: Math.round(v) } })}
                min={0}
                max={48}
                step={1}
              />
              <PremiumSlider
                label="Grid columns (Mobile)"
                value={siteConfig.layout.gridColsMobile}
                onChange={(v) => setSiteConfig({ layout: { gridColsMobile: Math.round(v) } })}
                min={1}
                max={4}
                step={1}
              />
              <PremiumSlider
                label="Grid columns (Desktop)"
                value={siteConfig.layout.gridCols}
                onChange={(v) => setSiteConfig({ layout: { gridCols: Math.round(v) } })}
                min={2}
                max={6}
                step={1}
              />
              <div className="sm:col-span-2">
                <PremiumSlider
                  label="Right blank space"
                  value={siteConfig.layout.contentPaddingRight}
                  suffix="px"
                  onChange={(v) => setSiteConfig({ layout: { contentPaddingRight: Math.round(v) } })}
                  min={0}
                  max={500}
                  step={4}
                />
              </div>
            </div>
          </div>

          {/* TYPOGRAPHY GROUP */}
          <div className="space-y-3">
            <h4 className="text-[9px] tracking-widest uppercase text-white/35 font-bold border-b border-white/5 pb-1">
              Typography Scaling
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PremiumSlider
                label="Topic title size"
                value={siteConfig.typography.topicSize}
                suffix="px"
                onChange={(v) => setSiteConfig({ typography: { topicSize: Math.round(v) } })}
                min={20}
                max={72}
                step={1}
              />
              <PremiumSlider
                label="Body base size"
                value={siteConfig.typography.bodySize}
                suffix="px"
                onChange={(v) => setSiteConfig({ typography: { bodySize: Math.round(v) } })}
                min={13}
                max={20}
                step={1}
              />
            </div>
          </div>

          {/* MOTION GROUP */}
          <div className="space-y-3">
            <h4 className="text-[9px] tracking-widest uppercase text-white/35 font-bold border-b border-white/5 pb-1">
              Animations & Motion
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <PremiumSlider
                label="Intro transition speed"
                value={siteConfig.animations.introSpeed}
                suffix="x"
                onChange={(v) => setSiteConfig({ animations: { introSpeed: v } })}
                min={0.4}
                max={2.5}
                step={0.05}
              />
            </div>
          </div>

          {!hasSupabase && (
            <p className="text-[9px] text-amber-350/50 leading-snug">
              * Supabase is not connected. Configuration updates will preview live in the current browser session only.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function ProfileSection({ c }) {
  const { PROFILE, setProfile } = c;

  // Parse "X% Y%" into two numbers so the sliders can drive object-position.
  const [rawX, rawY] = (PROFILE.photoPosition || '50% 50%').split(/\s+/);
  const cropX = Number.parseFloat(rawX) || 50;
  const cropY = Number.parseFloat(rawY) || 50;
  const setCrop = (x, y) =>
    setProfile({ photoPosition: `${Math.round(x)}% ${Math.round(y)}%` });

  const mobileH = Number(PROFILE.mobilePhotoHeight) || 180;

  return (
    <Section title="Profile" hint="Your photo, name, role, and tagline.">
      <div className="flex items-start gap-4">
        {/* Larger 4:5 preview — crop edits reflect live */}
        <div
          className="w-24 shrink-0 rounded-lg overflow-hidden bg-ink-800 ring-1 ring-white/10"
          style={{ aspectRatio: '4 / 5' }}
        >
          {PROFILE.photo ? (
            <img
              src={previewSrc(PROFILE.photo, 240)}
              alt=""
              className="w-full h-full object-cover"
              style={{ objectPosition: `${cropX}% ${cropY}%` }}
            />
          ) : null}
        </div>
        <div className="flex-1 space-y-2">
          <Field
            label="Photo URL"
            value={PROFILE.photo}
            onChange={(v) => setProfile({ photo: v })}
            placeholder="https://…"
            hint={isCloudinaryUrl(PROFILE.photo) ? 'Cloudinary — auto-optimized (f_auto, q_auto, w_200+).' : undefined}
          />
          <ImageUploader
            value={PROFILE.photo}
            onChange={(url) => setProfile({ photo: url })}
            compact
            aspect="4 / 5"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SliderField
          label={`Crop horizontal (${Math.round(cropX)}%)`}
          value={cropX}
          onChange={(v) => setCrop(v, cropY)}
          min={0}
          max={100}
          step={1}
        />
        <SliderField
          label={`Crop vertical (${Math.round(cropY)}%)`}
          value={cropY}
          onChange={(v) => setCrop(cropX, v)}
          min={0}
          max={100}
          step={1}
        />
      </div>
      <SliderField
        label={`Mobile portrait height (${mobileH}px)`}
        value={mobileH}
        onChange={(v) => setProfile({ mobilePhotoHeight: Math.round(v) })}
        min={80}
        max={360}
        step={4}
      />
      <Field label="Name" value={PROFILE.name} onChange={(v) => setProfile({ name: v })} />
      <Field label="Role" value={PROFILE.role} onChange={(v) => setProfile({ role: v })} />
      <Field
        label="Tagline"
        value={PROFILE.tagline}
        onChange={(v) => setProfile({ tagline: v })}
        textarea
      />
      <Field
        label="Italicise this word in the tagline (optional)"
        value={PROFILE.taglineEmphasis || ''}
        onChange={(v) => setProfile({ taglineEmphasis: v })}
        placeholder="e.g. kindness"
      />

      {/* --- Intro screen (shown before the background video) ---------------- */}
      <Collapsible title="Intro screen">
        <p className="text-[10px] tracking-widest2 uppercase text-white/40">
          Tagline
        </p>
        <Field
          label="Intro tagline (first line of the cinematic intro)"
          value={PROFILE.introTagline || ''}
          onChange={(v) => setProfile({ introTagline: v })}
          placeholder="I wish to be a light painter"
          textarea
          hint="Shown with a focus-pull reveal before the background video starts. Leave empty to fall back to the main tagline."
        />
        <div className="grid grid-cols-2 gap-3">
          <SliderField
            label="Size"
            value={Number(PROFILE.introTaglineScale) || 1}
            onChange={(v) => setProfile({ introTaglineScale: v })}
            min={0.6}
            max={1.8}
            step={0.05}
          />
          <Field
            label="Letter spacing (em)"
            value={PROFILE.introTaglineTracking || ''}
            onChange={(v) => setProfile({ introTaglineTracking: v })}
            placeholder="0.01em"
            compact
          />
        </div>

        <p className="pt-2 text-[10px] tracking-widest2 uppercase text-white/40">
          Intro screen — Name
        </p>
        <Field
          label="Intro name (optional override)"
          value={PROFILE.introName || ''}
          onChange={(v) => setProfile({ introName: v })}
          placeholder={PROFILE.name || 'Film Natthawut'}
          hint="Leave empty to use your main Name (above). Use this only if you want a different name shown during the cinematic intro."
        />
        <div className="grid grid-cols-2 gap-3">
          <SliderField
            label="Size"
            value={Number(PROFILE.introNameScale) || 1}
            onChange={(v) => setProfile({ introNameScale: v })}
            min={0.6}
            max={1.8}
            step={0.05}
          />
          <Field
            label="Letter spacing (em)"
            value={PROFILE.introNameTracking || ''}
            onChange={(v) => setProfile({ introNameTracking: v })}
            placeholder="0.005em"
            compact
          />
        </div>
      </Collapsible>

      {/* --- Navigation labels ------------------------------------------------ */}
      <div className="pt-3 mt-3 border-t border-white/10">
        <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-2">
          Navigation labels
        </p>
        <Field
          label={"\u201CAll\u201D category pill label"}
          value={PROFILE.allLabel || ''}
          onChange={(v) => setProfile({ allLabel: v })}
          placeholder="All"
          hint={"Shown in the Landing menu, Gallery pills, and mobile nav. Individual category names are edited under Topics & projects below."}
        />
      </div>

      {/* --- Browser tab: title + description + favicon --------------------- */}
      <Collapsible title="Browser tab">
        <Field
          label="Website headline (browser tab title)"
          value={PROFILE.siteTitle || ''}
          onChange={(v) => setProfile({ siteTitle: v })}
          placeholder="My Portfolio — Tagline"
        />
        <Field
          label="Website description (shown in Google results & social shares)"
          value={PROFILE.siteDescription || ''}
          onChange={(v) => setProfile({ siteDescription: v })}
          placeholder="A short sentence describing your work."
          textarea
          hint="Updates the <meta name=&quot;description&quot;> tag live."
        />
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-ink-800 ring-1 ring-white/10 flex items-center justify-center">
            {PROFILE.favicon ? (
              <img
                src={previewSrc(PROFILE.favicon, 64)}
                alt="favicon preview"
                className="w-7 h-7 object-contain"
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
            ) : null}
          </div>
          <div className="flex-1 space-y-2">
            <Field
              label="Logo / favicon URL"
              value={PROFILE.favicon || ''}
              onChange={(v) => setProfile({ favicon: v })}
              placeholder="/favicon.svg  or  https://…"
              compact
            />
            <ImageUploader
              value={PROFILE.favicon}
              onChange={(url) => setProfile({ favicon: url })}
              compact
              aspect="1 / 1"
            />
          </div>
        </div>
      </Collapsible>

    </Section>
  );
}

function LandingVideoSection({ c }) {
  const { PROFILE, setProfile } = c;
  return (
    <Section
      title="Landing background video"
      hint="Plays full-screen behind the landing menu. Supports YouTube, Vimeo, or direct MP4 / WebM URLs."
    >
      <VideoUploader
        value={PROFILE.landingVideo || ''}
        onChange={(url) => setProfile({ landingVideo: url })}
        label="Upload or drop a video"
      />
      <Field
        label="Video URL"
        value={PROFILE.landingVideo || ''}
        onChange={(v) => setProfile({ landingVideo: v })}
        placeholder="https://cdn.amphitheatrefilm.com/hero.mp4"
        hint="For the cleanest, no-logo cinematic look, paste a direct MP4 / WebM URL served from Backblaze B2 via your Cloudflare CDN (e.g. https://video.amphitheatrefilm.com/showreel.mp4). YouTube / Vimeo links still work. Leave empty to fall back to the built-in default."
      />
    </Section>
  );
}

function ContactSection({ c }) {
  const { CONTACT, setContact } = c;
  return (
    <Section title="Contact & socials">
      <Field label="Email" value={CONTACT.email} onChange={(v) => setContact({ email: v })} />
      <Field label="Instagram URL" value={CONTACT.instagram} onChange={(v) => setContact({ instagram: v })} />
      <Field label="Facebook URL" value={CONTACT.facebook} onChange={(v) => setContact({ facebook: v })} />
      <Field label="Linktree URL" value={CONTACT.linktree} onChange={(v) => setContact({ linktree: v })} />
    </Section>
  );
}

function BackgroundSection({ c }) {
  const { BACKGROUND, setBackground } = c;
  return (
    <Section title="Background" hint="A solid colour, or an image with a dim overlay.">
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={BACKGROUND.color}
          onChange={(e) => setBackground({ color: e.target.value })}
          className="w-12 h-10 rounded bg-transparent border border-white/10 cursor-pointer"
        />
        <div className="flex-1">
          <Field label="Colour (hex)" value={BACKGROUND.color} onChange={(v) => setBackground({ color: v })} />
        </div>
      </div>
      <Field
        label="Background image URL (optional)"
        value={BACKGROUND.image || ''}
        onChange={(v) => setBackground({ image: v || null })}
        placeholder="https://…"
      />
      <Field
        label="Overlay colour (on top of image)"
        value={BACKGROUND.overlay}
        onChange={(v) => setBackground({ overlay: v })}
        placeholder="rgba(5,5,7,0.7)"
      />
    </Section>
  );
}

function TopicsSection({ c }) {
  const {
    state,
    addTopic,
    updateTopic,
    removeTopic,
    moveTopic,
    addProject,
    updateProject,
    removeProject,
    moveProject,
    moveProjectTo,
  } = c;
  const [open, setOpen] = useState({}); // per-topic open state

  const toggle = (i) => setOpen((o) => ({ ...o, [i]: !o[i] }));

  return (
    <div className="space-y-2">
      {/* Section header — matches "Content / Theatre Alpha" weight */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-[11px] tracking-widest2 uppercase text-white/55">
            Topics &amp; Projects
          </h3>
          <p className="mt-0.5 text-[11px] text-white/35">
            Your categories and every work shown on the grid.
          </p>
        </div>
        <button
          onClick={addTopic}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/15 text-[11px] text-white/70 hover:text-white hover:border-white/40 hover:bg-white/5 transition-all"
        >
          <Plus className="w-3 h-3" /> New Topic
        </button>
      </div>

      <div className="space-y-3">
        {state.TOPICS.map((t, ti) => {
          const isOpen = open[ti] ?? ti === 0;
          return (
            <TopicCard
              key={ti}
              ti={ti}
              t={t}
              isOpen={isOpen}
              onToggle={() => toggle(ti)}
              onExpand={() => setOpen((o) => ({ ...o, [ti]: true }))}
              updateTopic={updateTopic}
              removeTopic={removeTopic}
              moveTopic={moveTopic}
              updateProject={updateProject}
              removeProject={removeProject}
              moveProject={moveProject}
              moveProjectTo={moveProjectTo}
              addProject={addProject}
            />
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectsView — Studio Console: 3-column master-detail CMS
//   Col 1 (20%): Topic list
//   Col 2 (30%): Project strips for selected topic
//   Col 3 (50%): Inspector — media preview + ghost-input form
// ---------------------------------------------------------------------------

/* Ghost input shared class */
const GHOST = [
  'w-full bg-transparent text-white/90 text-[13px] placeholder:text-white/20',
  'border-0 border-b border-white/10 focus:border-white/40 outline-none',
  'pb-1.5 pt-0.5 transition-colors duration-150',
].join(' ');

function ProjectsView({ c }) {
  const {
    state, addTopic, updateTopic, removeTopic, moveTopic,
    addProject, updateProject, removeProject, moveProject,
  } = c;

  // Col-1: selected topic (null = ALL)
  const [activeTi, setActiveTi] = useState(null);
  // Col-2: selected project
  const [sel, setSel] = useState(null); // { ti, pi }
  // Inspector media tab
  const [mediaTab, setMediaTab] = useState('thumb');
  // Save state
  const [saving, setSaving] = useState(false);
  // Drag ref for col-2 reordering
  const dragRef = useRef(null);

  // Flat project list for col 2
  const listEntries =
    activeTi === null
      ? state.TOPICS.flatMap((t, ti) =>
        t.projects.map((p, pi) => ({ p, ti, pi, topicLabel: t.label }))
      )
      : (state.TOPICS[activeTi]?.projects ?? []).map((p, pi) => ({
        p, ti: activeTi, pi, topicLabel: state.TOPICS[activeTi]?.label,
      }));

  // Selected project data (live from store)
  const selP = sel && state.TOPICS[sel.ti]?.projects[sel.pi]
    ? state.TOPICS[sel.ti].projects[sel.pi]
    : null;

  const up = (patch) => sel && updateProject(sel.ti, sel.pi, patch);

  const handleSave = async () => {
    setSaving(true);
    await c.saveToCloud?.().catch(() => { });
    setSaving(false);
  };

  const handleDragStart = (e, idx) => { dragRef.current = idx; e.dataTransfer.effectAllowed = 'move'; };
  const handleDrop = (e, idx) => {
    e.preventDefault();
    const from = dragRef.current;
    if (from === null || from === idx || activeTi === null) return;
    moveProject(activeTi, from, idx > from ? 1 : -1);
    dragRef.current = null;
  };

  const topicItems = [
    { label: 'ALL', ti: null, count: state.TOPICS.reduce((n, t) => n + t.projects.length, 0) },
    ...state.TOPICS.map((t, ti) => ({ label: t.label || 'Untitled', ti, count: t.projects.length })),
  ];

  return (
    <div className="flex h-full min-h-0 overflow-hidden" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* ═══ COL 1 — TOPICS ═══════════════════════════════════════════════ */}
      <div className="flex flex-col border-r border-white/8" style={{ width: '20%', minWidth: 140 }}>
        <ColHeader>TOPICS</ColHeader>
        <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: 'none' }}>
          {topicItems.map(({ label, ti, count }) => {
            const active = activeTi === ti;
            return (
              <div key={ti ?? 'all'} className="relative">
                {active && (
                  <motion.div
                    layoutId="topic-pill"
                    className="absolute inset-0 bg-white/8"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 380, damping: 36 }}
                  />
                )}
                <button
                  onClick={() => { setActiveTi(ti); setSel(null); }}
                  className={[
                    'relative w-full text-left px-4 py-2.5 text-[11px] tracking-widest uppercase transition-colors',
                    active ? 'text-white' : 'text-white/40 hover:text-white/75',
                  ].join(' ')}
                >
                  <span className="block truncate">{label}</span>
                  <span className="block text-[9px] mt-0.5 text-white/25 normal-case tracking-normal">
                    {count} {count === 1 ? 'project' : 'projects'}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="p-3 border-t border-white/6">
          <button
            onClick={() => { addTopic(); setActiveTi(state.TOPICS.length); }}
            className="w-full text-[10px] tracking-widest uppercase text-white/25 hover:text-white/65 py-2 transition-colors"
          >
            + New Topic
          </button>
        </div>
      </div>

      {/* ═══ COL 2 — PROJECT LIST ══════════════════════════════════════════ */}
      <div className="flex flex-col border-r border-white/8" style={{ width: '30%' }}>
        <ColHeader>
          PROJECT LIST
          {activeTi !== null && (
            <span className="ml-2 text-[9px] text-white/25 font-normal tracking-normal normal-case">
              {state.TOPICS[activeTi]?.label}
            </span>
          )}
        </ColHeader>

        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
          {listEntries.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-[11px] text-white/15 tracking-widest uppercase">
              Empty
            </div>
          ) : (
            listEntries.map(({ p, ti, pi, topicLabel }, idx) => {
              const isSelected = sel?.ti === ti && sel?.pi === pi;
              const thumb = previewSrc(p.image || guessPreviewUrl(p.url), 80);
              return (
                <div
                  key={`${ti}-${pi}`}
                  draggable={activeTi !== null}
                  onDragStart={(e) => handleDragStart(e, idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(e, idx)}
                  onClick={() => { setSel({ ti, pi }); setMediaTab('thumb'); }}
                  className={[
                    'flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-white/4 transition-colors',
                    isSelected ? 'bg-white/10' : 'hover:bg-white/5',
                  ].join(' ')}
                >
                  <div className="w-10 h-10 shrink-0 rounded overflow-hidden bg-white/5">
                    {thumb
                      ? <img src={thumb} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4 text-white/15" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] text-white/85 truncate leading-tight">{p.title || 'Untitled'}</p>
                    <p className="text-[10px] text-white/30 truncate mt-0.5">{p.subtitle || topicLabel}</p>
                  </div>
                  {activeTi !== null && <GripVertical className="w-3.5 h-3.5 text-white/12 shrink-0" />}
                </div>
              );
            })
          )}
        </div>

        {activeTi !== null && (
          <div className="p-4 border-t border-white/6">
            <button
              onClick={() => {
                addProject(activeTi);
                setSel({ ti: activeTi, pi: state.TOPICS[activeTi]?.projects.length ?? 0 });
              }}
              className="w-full text-[10px] tracking-widest uppercase text-white/25 hover:text-white/65 py-2 transition-colors"
            >
              + Add Project
            </button>
          </div>
        )}
      </div>

      {/* ═══ COL 3 — INSPECTOR ═════════════════════════════════════════════ */}
      <div className="flex flex-col flex-1 min-w-0 relative overflow-hidden">
        <ColHeader>INSPECTOR</ColHeader>

        {!selP ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[11px] tracking-widest uppercase text-white/15">Select a project</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>

            {/* SECTION A — Media Preview */}
            <div className="bg-black">
              <div className="w-full bg-black overflow-hidden" style={{ minHeight: 160 }}>
                {mediaTab === 'thumb' ? (
                  <div
                    className="relative w-full"
                    style={{ aspectRatio: (selP.videoAspectRatio || '16/9').replace('/', ' / ') }}
                  >
                    {(selP.image || guessPreviewUrl(selP.url)) ? (
                      <img
                        src={previewSrc(selP.image || guessPreviewUrl(selP.url), 800)}
                        alt=""
                        className="w-full h-full object-cover"
                        style={{ objectPosition: selP.imagePosition || '50% 50%' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white/10">
                        <Film className="w-12 h-12" />
                      </div>
                    )}
                  </div>
                ) : (() => {
                  const info = resolveEmbed(selP.url || '');
                  if (!info || info.kind === 'unknown') return (
                    <div className="flex items-center justify-center py-12 text-white/20 text-xs">No valid video URL</div>
                  );
                  if (info.kind === 'direct') return <CinematicPlayer src={info.embedUrl} className="w-full" />;
                  return (
                    <div className="w-full bg-black" style={{ aspectRatio: (selP.videoAspectRatio || '16/9').replace('/', ' / ') }}>
                      <iframe src={info.embedUrl} title={selP.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen className="w-full h-full border-0 block" />
                    </div>
                  );
                })()}
              </div>

              {/* Segmented toggle */}
              <div className="flex border-t border-white/8">
                {[['thumb', 'THUMBNAIL'], ['video', 'VIDEO PLAYER']].map(([id, lbl]) => (
                  <button
                    key={id}
                    onClick={() => setMediaTab(id)}
                    className={[
                      'flex-1 py-2 text-[10px] tracking-widest uppercase transition-colors',
                      mediaTab === id ? 'text-white bg-white/8' : 'text-white/30 hover:text-white/60',
                    ].join(' ')}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>

            {/* SECTION B — Edit Form */}
            <div className="px-6 py-5 space-y-5">

              <div className="grid grid-cols-2 gap-5">
                <GhostField label="TITLE">
                  <input value={selP.title ?? ''} onChange={(e) => up({ title: e.target.value })} placeholder="Project title" className={GHOST} />
                </GhostField>
                <GhostField label="CLIENT / SUBTITLE">
                  <input value={selP.subtitle ?? ''} onChange={(e) => up({ subtitle: e.target.value })} placeholder="Client or subtitle" className={GHOST} />
                </GhostField>
              </div>

              <GhostField label="VIDEO URL" action={<AssetPicker kind="video" value={selP.url} onPick={(url) => up({ url })} compact />}>
                <input value={selP.url ?? ''} onChange={(e) => up({ url: e.target.value })} placeholder="YouTube / Vimeo / B2 URL" className={GHOST} />
              </GhostField>

              <GhostField label="THUMBNAIL URL" action={<AssetPicker kind="image" value={selP.image} onPick={(url) => up({ image: url })} compact />}>
                <input value={selP.image ?? ''} onChange={(e) => up({ image: e.target.value })} placeholder="Image URL" className={GHOST} />
              </GhostField>

              {/* Aspect Ratio — segmented control */}
              <GhostField label="ASPECT RATIO">
                <div className="flex mt-1.5">
                  {[['16:9', '16/9'], ['4:3', '4/3'], ['21:9', '21/9'], ['9:16', '9/16']].map(([lbl, val]) => {
                    const on = (selP.videoAspectRatio || '16/9') === val;
                    return (
                      <button
                        key={val}
                        onClick={() => up({ videoAspectRatio: val })}
                        className={[
                          'flex-1 py-1.5 text-[10px] tracking-widest uppercase border-y border-r first:border-l first:rounded-l last:rounded-r transition-colors',
                          on ? 'bg-white text-black border-white' : 'bg-transparent text-white/30 border-white/10 hover:text-white/65',
                        ].join(' ')}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </GhostField>

              <GhostField label="DIRECTOR'S NOTE">
                <textarea value={selP.directorNote ?? ''} onChange={(e) => up({ directorNote: e.target.value })} placeholder="Story behind the project…" rows={3} className={GHOST + ' resize-none'} />
              </GhostField>

              {/* Credits */}
              <GhostField label="CREDITS">
                <div className="space-y-2 mt-1">
                  {(selP.credits || []).map((cr, ci) => (
                    <div key={ci} className="flex gap-2 items-end">
                      <input
                        value={cr.role || ''}
                        onChange={(e) => { const n = [...selP.credits]; n[ci] = { ...n[ci], role: e.target.value }; up({ credits: n }); }}
                        placeholder="Role"
                        className={GHOST + ' flex-1'}
                      />
                      <input
                        value={cr.name || ''}
                        onChange={(e) => { const n = [...selP.credits]; n[ci] = { ...n[ci], name: e.target.value }; up({ credits: n }); }}
                        placeholder="Name"
                        className={GHOST + ' flex-[1.5]'}
                      />
                      <button onClick={() => up({ credits: selP.credits.filter((_, j) => j !== ci) })} className="text-white/20 hover:text-red-400 transition-colors pb-2">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => up({ credits: [...(selP.credits || []), { role: '', name: '' }] })} className="text-[10px] tracking-widest uppercase text-white/20 hover:text-white/55 transition-colors">
                    + Add credit
                  </button>
                </div>
              </GhostField>

              <GhostField label="OFFICIAL RELEASE URL">
                <input value={selP.releaseUrl ?? ''} onChange={(e) => up({ releaseUrl: e.target.value })} placeholder="https://…" className={GHOST} />
              </GhostField>

              {/* Framing toggle */}
              <FramingToggle selP={selP} up={up} />

              {/* Image uploader */}
              <ImageUploader value={selP.image} onChange={(url) => up({ image: url })} compact aspect="16/9" />

              {/* Save */}
              <div className="pt-2 pb-24">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full py-3 rounded text-[11px] tracking-widest uppercase font-semibold transition-all"
                  style={{
                    background: saving ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,1)',
                    color: saving ? 'rgba(255,255,255,0.4)' : '#050507',
                  }}
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  onClick={() => { if (window.confirm(`Delete "${selP.title}"?`)) { removeProject(sel.ti, sel.pi); setSel(null); } }}
                  className="w-full mt-2 py-2 text-[10px] tracking-widest uppercase text-red-500/40 hover:text-red-400 transition-colors"
                >
                  Delete project
                </button>
              </div>
            </div>
          </div>
        )}


      </div>
    </div>
  );
}

/* Shared column header */
function ColHeader({ children }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-white/8 shrink-0">
      <span className="text-[10px] tracking-widest uppercase text-white/30 font-semibold flex-1 flex items-center gap-2">
        {children}
      </span>
    </div>
  );
}

/* Ghost input field wrapper */
function GhostField({ label, action, children }) {
  return (
    <div>
      <div className="flex items-center mb-1.5">
        <span className="text-[9px] tracking-widest uppercase text-white/28 flex-1">{label}</span>
        {action && <div className="shrink-0 scale-90 origin-right opacity-60 hover:opacity-100 transition-opacity">{action}</div>}
      </div>
      {children}
    </div>
  );
}

/* Framing toggle — hides CropPicker behind a button */
function FramingToggle({ selP, up }) {
  const [show, setShow] = useState(false);
  if (!selP) return null;
  return (
    <div>
      <button
        onClick={() => setShow((s) => !s)}
        className={[
          'text-[10px] tracking-widest uppercase transition-colors',
          show ? 'text-white/65' : 'text-white/22 hover:text-white/50',
        ].join(' ')}
      >
        <Crop className="inline w-3 h-3 mr-1.5 -mt-0.5" />
        {show ? 'Hide Framing' : 'Adjust Framing'}
      </button>
      {show && (
        <div className="mt-3">
          <CropPicker
            src={previewSrc(selP.image || guessPreviewUrl(selP.url), 600)}
            position={selP.imagePosition || '50% 50%'}
            onChange={(pos) => up({ imagePosition: pos })}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopicCard — one collapsible topic row.
// When collapsed it shows a thin drop zone so projects can be moved into it
// without opening it first. When a drag enters the header it auto-expands.
// ---------------------------------------------------------------------------
function TopicCard({
  ti, t, isOpen, onToggle, onExpand,
  updateTopic, removeTopic, moveTopic,
  updateProject, removeProject, moveProject, moveProjectTo, addProject,
}) {
  const [headerDragOver, setHeaderDragOver] = useState(false);
  const expandTimer = useRef(null);

  const clearExpandTimer = () => {
    if (expandTimer.current) { clearTimeout(expandTimer.current); expandTimer.current = null; }
  };

  // When a project card is dragged over the collapsed header, auto-expand
  // after 600 ms — same pattern as OS folder drag-open.
  const onHeaderDragOver = (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setHeaderDragOver(true);
    if (!isOpen && !expandTimer.current) {
      expandTimer.current = setTimeout(() => { onExpand(); expandTimer.current = null; }, 600);
    }
  };

  const onHeaderDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setHeaderDragOver(false);
    clearExpandTimer();
  };

  const onHeaderDrop = (e) => {
    setHeaderDragOver(false);
    clearExpandTimer();
    const payload = readDragPayload(e.dataTransfer);
    if (!payload) return;
    e.preventDefault();
    // Drop onto the header → append to end of this topic.
    moveProjectTo(payload.ti, payload.pi, ti, t.projects.length);
    onExpand();
  };

  return (
    <div
      className={[
        'rounded-xl border overflow-hidden transition-all duration-200',
        headerDragOver
          ? 'border-emerald-400/50 shadow-[0_0_0_1px_rgba(52,211,153,0.15)] bg-emerald-950/10'
          : 'border-white/10 bg-white/[0.025]',
      ].join(' ')}
    >
      {/* ── Topic header card ─────────────────────────────────────── */}
      <div
        className={[
          'relative flex items-center gap-3 px-4 py-3',
          'border-b transition-colors duration-200',
          headerDragOver ? 'border-emerald-400/20' : isOpen ? 'border-white/8' : 'border-transparent',
        ].join(' ')}
        onDragOver={onHeaderDragOver}
        onDragLeave={onHeaderDragLeave}
        onDrop={onHeaderDrop}
      >
        {/* Numbered badge */}
        <span
          className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] tabular-nums font-medium border border-white/15 text-white/50 bg-white/5"
        >
          {String(ti + 1).padStart(2, '0')}
        </span>

        {/* Collapse toggle — fills most of the row */}
        <button
          onClick={onToggle}
          className="flex-1 flex items-center gap-2.5 text-left group min-w-0"
          aria-expanded={isOpen}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-white/35 transition-transform duration-200 ${isOpen ? 'rotate-0' : '-rotate-90'
              }`}
          />
          <span className="font-medium text-[13px] text-white/85 group-hover:text-white transition-colors truncate">
            {t.label || 'Untitled topic'}
          </span>
          {/* Project count chip */}
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/6 border border-white/10 text-[10px] text-white/45">
            {t.projects.length} {t.projects.length === 1 ? 'project' : 'projects'}
          </span>
          {headerDragOver && !isOpen && (
            <span className="shrink-0 text-[10px] text-emerald-300/90">Drop to add →</span>
          )}
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn title="Move up" onClick={() => moveTopic(ti, -1)}>
            <ArrowUp className="w-3 h-3" />
          </IconBtn>
          <IconBtn title="Move down" onClick={() => moveTopic(ti, +1)}>
            <ArrowDown className="w-3 h-3" />
          </IconBtn>
          <IconBtn
            title="Delete topic"
            onClick={() => {
              if (window.confirm(`Delete "${t.label}" and all its projects?`)) {
                removeTopic(ti);
              }
            }}
            danger
          >
            <Trash2 className="w-3 h-3" />
          </IconBtn>
        </div>
      </div>

      {/* ── Expanded body ──────────────────────────────────────────── */}
      {isOpen && (
        <div className="px-4 py-4 space-y-3">
          <Field
            label="Topic name"
            value={t.label}
            onChange={(v) => updateTopic(ti, { label: v })}
          />

          <ProjectList
            ti={ti}
            topic={t}
            updateProject={updateProject}
            removeProject={removeProject}
            moveProject={moveProject}
            moveProjectTo={moveProjectTo}
            addProject={addProject}
          />
        </div>
      )}

      {/* Collapsed drop zone */}
      {!isOpen && (
        <CollapsedDropZone
          ti={ti}
          topic={t}
          moveProjectTo={moveProjectTo}
          onExpand={onExpand}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CollapsedDropZone — rendered at the bottom of a collapsed TopicCard.
// Invisible until a drag enters it; then shows a highlighted strip so the
// user knows they can drop here to append to this topic.
function CollapsedDropZone({ ti, topic, moveProjectTo, onExpand }) {
  const [active, setActive] = useState(false);

  const onDragOver = (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setActive(true);
  };

  const onDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setActive(false);
  };

  const onDrop = (e) => {
    setActive(false);
    const payload = readDragPayload(e.dataTransfer);
    if (!payload) return;
    e.preventDefault();
    moveProjectTo(payload.ti, payload.pi, ti, topic.projects.length);
    onExpand();
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={[
        'mx-3 mb-3 rounded-lg border border-dashed text-[11px] text-center py-2 transition-all',
        active
          ? 'border-emerald-400/70 text-emerald-200 bg-emerald-500/8'
          : 'border-transparent text-transparent',
      ].join(' ')}
    >
      Drop here → &ldquo;{topic.label}&rdquo;
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag-and-drop — uses the native HTML5 Drag and Drop API (no deps).
//
//   Data on dragstart:  MIME 'application/x-project' ⇒ JSON { ti, pi }
//   Drop targets:
//     - ProjectRow    → drops BEFORE or AFTER depending on mouse-Y midpoint
//     - ProjectList   → drops at the END of the destination topic (covers
//                        empty-topic and past-the-last-item drops)
//
// The move is committed via `moveProjectTo(srcTi, srcPi, dstTi, dstPi)` from
// the content store, which handles same-topic-shift adjustment internally.
// ---------------------------------------------------------------------------

const DRAG_MIME = 'application/x-project';

function readDragPayload(dt) {
  // `getData` returns '' on dragover in most browsers for security reasons;
  // we only rely on it in onDrop. Types-check is used for dragover feedback.
  try {
    return JSON.parse(dt.getData(DRAG_MIME));
  } catch {
    return null;
  }
}

function ProjectList({
  ti, topic, updateProject, removeProject, moveProject, moveProjectTo, addProject,
}) {
  const [dropAtEnd, setDropAtEnd] = useState(false);

  const handleContainerOver = (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    // Only show the "drop at end" indicator when the user is hovering the
    // empty tail region (outside any row). Rows stop propagation themselves.
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropAtEnd(true);
  };

  const handleContainerLeave = (e) => {
    // Only clear when the cursor truly leaves the wrapper (not when it
    // crosses into a child row).
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropAtEnd(false);
  };

  const handleContainerDrop = (e) => {
    setDropAtEnd(false);
    const payload = readDragPayload(e.dataTransfer);
    if (!payload) return;
    e.preventDefault();
    moveProjectTo(payload.ti, payload.pi, ti, topic.projects.length);
  };

  return (
    <div
      onDragOver={handleContainerOver}
      onDragLeave={handleContainerLeave}
      onDrop={handleContainerDrop}
      className="space-y-2"
    >
      {topic.projects.map((p, pi) => (
        <ProjectRow
          key={pi}
          ti={ti}
          pi={pi}
          p={p}
          updateProject={updateProject}
          removeProject={removeProject}
          moveProject={moveProject}
          moveProjectTo={moveProjectTo}
        />
      ))}

      <button
        onClick={() => addProject(ti)}
        className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed text-[11px] transition-all ${dropAtEnd
          ? 'border-emerald-400/70 text-emerald-200 bg-emerald-500/8'
          : 'border-white/12 text-white/45 hover:text-white/80 hover:border-white/30 hover:bg-white/[0.03]'
          }`}
      >
        <Plus className="w-3.5 h-3.5" />
        {dropAtEnd ? `Drop to append → "${topic.label}"` : 'Add project'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectRow — one collapsible, draggable card per project inside a topic.
// Collapsed: shows index, thumb, title/subtitle, a drag handle, and actions.
// Expanded: reveals all editable fields + the crop picker.
// Newly-added projects (empty title/url/image) open expanded by default so
// the user lands on the form ready to type.
// ---------------------------------------------------------------------------

function ProjectRow({
  ti, pi, p, updateProject, removeProject, moveProject, moveProjectTo,
}) {
  const isEmpty = !p.title && !p.url && !p.image;
  const [expanded, setExpanded] = useState(isEmpty);
  const [dragging, setDragging] = useState(false);
  const [dropEdge, setDropEdge] = useState(null); // 'top' | 'bottom' | null

  const thumbSrc = previewSrc(p.image || guessPreviewUrl(p.url), 120);

  // -- Drag source ----------------------------------------------------------
  const handleDragStart = (e) => {
    e.dataTransfer.setData(DRAG_MIME, JSON.stringify({ ti, pi }));
    e.dataTransfer.effectAllowed = 'move';
    setDragging(true);
    setExpanded(false); // tidier "card" while dragging
  };

  const handleDragEnd = () => {
    setDragging(false);
    setDropEdge(null);
  };

  // -- Drop target ----------------------------------------------------------
  const handleDragOver = (e) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.stopPropagation(); // keep the container indicator off while over a row
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const isTop = e.clientY - rect.top < rect.height / 2;
    setDropEdge(isTop ? 'top' : 'bottom');
  };

  const handleDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDropEdge(null);
  };

  const handleDrop = (e) => {
    const payload = readDragPayload(e.dataTransfer);
    setDropEdge(null);
    if (!payload) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const isTop = e.clientY - rect.top < rect.height / 2;
    const dstPi = isTop ? pi : pi + 1;
    moveProjectTo(payload.ti, payload.pi, ti, dstPi);
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`relative rounded-md border bg-ink-900/60 overflow-hidden transition-opacity ${dragging ? 'opacity-40 border-white/20' : 'border-white/10'
        }`}
    >
      {/* Top / bottom drop indicators */}
      {dropEdge === 'top' && (
        <span className="pointer-events-none absolute inset-x-0 -top-px h-0.5 bg-emerald-400" />
      )}
      {dropEdge === 'bottom' && (
        <span className="pointer-events-none absolute inset-x-0 -bottom-px h-0.5 bg-emerald-400" />
      )}

      {/* Collapsed header */}
      <div className="flex items-center gap-1.5 p-2">
        {/* Dedicated drag handle — only this element is draggable, so form
            inputs below stay fully interactive. */}
        <span
          draggable
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          title="Drag to reorder / move between topics"
          aria-label="Drag handle"
          className="shrink-0 w-5 h-7 flex items-center justify-center text-white/35 hover:text-white/80 cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </span>

        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left hover:bg-white/[0.03] rounded px-1 py-1 -my-1 transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse project' : 'Expand project'}
        >
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 text-white/45 transition-transform ${expanded ? 'rotate-0' : '-rotate-90'
              }`}
          />
          <span className="text-[10px] text-white/30 tabular-nums shrink-0 w-5">
            {String(pi + 1).padStart(2, '0')}
          </span>
          <span className="w-10 h-7 rounded shrink-0 bg-ink-800 overflow-hidden ring-1 ring-white/10">
            {thumbSrc ? (
              <img
                src={thumbSrc}
                alt=""
                className="w-full h-full object-cover"
                style={{ objectPosition: p.imagePosition || '50% 50%' }}
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] text-white/85">
              {p.title || (
                <span className="text-white/35 italic">Untitled project</span>
              )}
            </span>
            {p.subtitle && (
              <span className="block truncate text-[10px] text-white/45">
                {p.subtitle}
              </span>
            )}
          </span>
        </button>
        <IconBtn title="Move up" onClick={() => moveProject(ti, pi, -1)}>
          <ArrowUp className="w-3 h-3" />
        </IconBtn>
        <IconBtn title="Move down" onClick={() => moveProject(ti, pi, +1)}>
          <ArrowDown className="w-3 h-3" />
        </IconBtn>
        <IconBtn
          title="Delete"
          onClick={() => {
            if (window.confirm(`Delete "${p.title || 'this project'}"?`)) {
              removeProject(ti, pi);
            }
          }}
          danger
        >
          <Trash2 className="w-3 h-3" />
        </IconBtn>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 border-t border-white/5">
          <Field
            label="Title"
            value={p.title}
            onChange={(v) => updateProject(ti, pi, { title: v })}
            compact
          />
          <Field
            label="Subtitle"
            value={p.subtitle}
            onChange={(v) => updateProject(ti, pi, { subtitle: v })}
            compact
          />
          <Field
            label="URL (YouTube, Vimeo, or Instagram)"
            value={p.url}
            onChange={(v) => updateProject(ti, pi, { url: v })}
            compact
          />
          <AssetPicker
            kind="video"
            value={p.url}
            onPick={(url) => updateProject(ti, pi, { url })}
            compact
          />

          {/* Video aspect ratio — for iframe embeds (YouTube / Vimeo).
              Direct .mp4/.webm files auto-detect from the video element. */}
          <div>
            <p className="text-[10px] text-white/45 mb-1">Video Aspect Ratio</p>
            <div className="flex flex-wrap gap-1">
              {[
                { label: '16:9', value: '16/9' },
                { label: '9:16', value: '9/16' },
                { label: '4:5', value: '4/5' },
                { label: '1:1', value: '1/1' },
                { label: '4:3', value: '4/3' },
              ].map(({ label, value }) => {
                const active = (p.videoAspectRatio || '16/9') === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateProject(ti, pi, { videoAspectRatio: value })}
                    className={`px-2.5 py-1 rounded text-[11px] border transition-colors ${active
                      ? 'border-white/50 text-white bg-white/10'
                      : 'border-white/10 text-white/45 hover:border-white/30 hover:text-white/70'
                      }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
          <Field
            label="Custom image URL (optional — YouTube auto-derives)"
            value={p.image}
            onChange={(v) => updateProject(ti, pi, { image: v })}
            compact
            hint={isCloudinaryUrl(p.image) ? 'Cloudinary — auto-optimized.' : undefined}
          />
          <ImageUploader
            value={p.image}
            onChange={(url) => updateProject(ti, pi, { image: url })}
            compact
            aspect="1.43 / 1"
          />
          <CropPicker
            src={previewSrc(p.image || guessPreviewUrl(p.url), 600)}
            position={p.imagePosition || '50% 50%'}
            onChange={(pos) => updateProject(ti, pi, { imagePosition: pos })}
          />

          {/* ── Cinematic detail fields ────────────────────────────── */}
          <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
            <Field
              label="Director's Note / Background"
              value={p.directorNote}
              onChange={(v) => updateProject(ti, pi, { directorNote: v })}
              compact
              textarea
            />

            {/* Credits repeater */}
            <div>
              <p className="text-[11px] text-white/50 mb-1.5">Credits</p>
              <div className="space-y-1.5">
                {(Array.isArray(p.credits) ? p.credits : []).map((c, ci) => (
                  <div key={ci} className="flex items-center gap-1.5">
                    <input
                      value={c.role || ''}
                      onChange={(e) => {
                        const next = [...p.credits];
                        next[ci] = { ...next[ci], role: e.target.value };
                        updateProject(ti, pi, { credits: next });
                      }}
                      placeholder="Role"
                      className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-white/80 placeholder:text-white/30 focus:border-white/30 outline-none"
                    />
                    <input
                      value={c.name || ''}
                      onChange={(e) => {
                        const next = [...p.credits];
                        next[ci] = { ...next[ci], name: e.target.value };
                        updateProject(ti, pi, { credits: next });
                      }}
                      placeholder="Name"
                      className="flex-[1.5] min-w-0 bg-white/5 border border-white/10 rounded px-2 py-1 text-[12px] text-white/80 placeholder:text-white/30 focus:border-white/30 outline-none"
                    />
                    <IconBtn
                      title="Remove credit"
                      onClick={() => {
                        const next = p.credits.filter((_, j) => j !== ci);
                        updateProject(ti, pi, { credits: next });
                      }}
                      danger
                    >
                      <X className="w-3 h-3" />
                    </IconBtn>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = [...(p.credits || []), { role: '', name: '' }];
                  updateProject(ti, pi, { credits: next });
                }}
                className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-white/55 hover:text-white/80 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add credit
              </button>
            </div>

            <Field
              label="Official Release URL"
              value={p.releaseUrl}
              onChange={(v) => updateProject(ti, pi, { releaseUrl: v })}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export modal
// ---------------------------------------------------------------------------

function ExportModal({ open, onClose, source }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl bg-ink-900 border border-white/10 rounded-xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
              <div>
                <p className="text-[10px] tracking-widest2 uppercase text-white/45">
                  Export
                </p>
                <h3 className="text-base">Paste this into <code className="text-white/70">src/data/projects.js</code></h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white text-ink-950 text-xs font-medium hover:bg-white/90"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy code'}
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/40"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <pre className="flex-1 overflow-auto pretty-scroll p-5 text-[12px] leading-relaxed text-white/85 whitespace-pre-wrap">
              {source}
            </pre>
            <div className="px-5 py-3 border-t border-white/10 text-[11px] text-white/50">
              Replace the <span className="text-white/75">PROFILE</span>,{' '}
              <span className="text-white/75">CONTACT</span>,{' '}
              <span className="text-white/75">BACKGROUND</span>, and{' '}
              <span className="text-white/75">TOPICS</span> blocks in your
              source file with the code above, then commit / deploy.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// UI primitives
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// EditorTabs — top-of-drawer tab switcher between the existing site editor
// ("Content") and the Theatre Alpha studio module. Theatre Alpha gets a
// subtle cinematic glow so it visually invites discovery.
// ---------------------------------------------------------------------------
// Hoisted outside EditorTabs so React sees a stable component identity
// across re-renders — avoids remounting the button on every state change.
function EditorTab({ id, view, onChange, glow, children }) {
  const active = view === id;
  const glowClass = glow === 'amber' ? 'ta-tab-glow' : glow === 'white' ? 'proj-tab-glow' : '';
  return (
    <button
      type="button"
      onClick={() => onChange(id)}
      className={[
        'relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] tracking-widest2 uppercase transition-colors',
        active
          ? 'bg-white/10 border-white/30 text-white'
          : 'border-white/10 text-white/55 hover:text-white hover:border-white/30',
        glowClass,
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function EditorTabs({ view, onChange }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b border-white/10">
      <EditorTab id="topics" view={view} onChange={onChange} glow="white">
        Projects
      </EditorTab>
      <EditorTab id="theatre" view={view} onChange={onChange} glow="amber">
        <Clapperboard className="w-3.5 h-3.5" />
        AlphaPROD.
      </EditorTab>
      <EditorTab id="content" view={view} onChange={onChange}>Design</EditorTab>
      <style>{`
        @keyframes proj-pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.0), 0 0 0 0 rgba(255,255,255,0.0); border-color: rgba(255,255,255,0.25); }
          50%      { box-shadow: 0 0 14px 2px rgba(255,255,255,0.35), 0 0 28px 4px rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.80); }
        }
        .proj-tab-glow {
          animation: proj-pulse-glow 2.4s ease-in-out infinite;
          color: rgba(255,255,255,0.90);
        }
        .proj-tab-glow:hover { color: #fff; }

        @keyframes ta-pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.0), 0 0 0 0 rgba(245,158,11,0.0); border-color: rgba(245,158,11,0.55); }
          50%      { box-shadow: 0 0 14px 2px rgba(245,158,11,0.45), 0 0 28px 4px rgba(245,158,11,0.18); border-color: rgba(245,158,11,0.95); }
        }
        .ta-tab-glow {
          animation: ta-pulse-glow 2.4s ease-in-out infinite;
          color: rgba(245,158,11,0.95);
        }
        .ta-tab-glow:hover { color: #fff; }
      `}</style>
    </div>
  );
}

function Section({ title, hint, action, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-start gap-2 text-left group"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 mt-0.5 text-white/40 group-hover:text-white/75 transition-all duration-200 ${open ? '' : '-rotate-90'}`}
          />
          <div>
            <h3 className="text-[11px] tracking-widest2 uppercase text-white/55 group-hover:text-white/85 transition-colors">
              {title}
            </h3>
            {hint && open && (
              <p className="mt-1 text-[11px] text-white/40">{hint}</p>
            )}
          </div>
        </button>
        {open && action}
      </div>
      {open && <div className="space-y-3">{children}</div>}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, textarea, compact, hint }) {
  const common =
    'w-full bg-ink-800/80 border border-white/10 rounded-md px-3 py-2 text-sm text-white/90 placeholder:text-white/25 focus:outline-none focus:border-white/30 transition-colors';
  return (
    <label className="block">
      <span className={`block ${compact ? 'text-[10px]' : 'text-[11px]'} text-white/45 mb-1`}>
        {label}
      </span>
      {textarea ? (
        <textarea
          rows={2}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={common + ' resize-y'}
        />
      ) : (
        <input
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={common}
        />
      )}
      {hint && (
        <span className="mt-1 block text-[10px] text-emerald-300/70">
          {hint}
        </span>
      )}
    </label>
  );
}

function Collapsible({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="pt-3 mt-3 border-t border-white/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between py-1 text-[10px] tracking-widest2 uppercase text-white/45 hover:text-white/80 transition-colors"
      >
        <span>{title}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

function SliderField({ label, value, onChange, min = 0, max = 1, step = 0.01 }) {
  const num = Number(value);
  const display = Number.isFinite(num) ? num.toFixed(2) : String(value);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] text-white/45">{label}</span>
        <span className="text-[10px] tabular-nums text-white/60">{display}×</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={num}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-white/80"
      />
    </label>
  );
}

// ---------------------------------------------------------------------------
// SyncBanner — thin, always-visible strip under the form that surfaces the
// state of the Supabase connection. Only mounted when `hasSupabase` is true.
//
//   loading  → "Syncing from cloud…"   (initial fetch on mount)
//   saving   → "Syncing to cloud…"     (push in progress)
//   saved    → "Saved to cloud"        (2.6 s success toast)
//   error    → "Cloud sync failed"     (with message)
//   idle     → "Connected to Supabase" (quiet baseline)
// ---------------------------------------------------------------------------
function SyncBanner({ status, error, isDirty, hasSupabase }) {
  // Supabase env vars not provided — usually means the Vercel deployment
  // hasn't had VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY added yet. Show
  // a clear "not connected" state so nothing silently fails.
  if (!hasSupabase) {
    return (
      <div className="px-5 py-2 border-t text-[11px] leading-snug bg-amber-500/10 border-amber-400/20 text-amber-200/90 flex items-start gap-2">
        <CloudOff className="w-3.5 h-3.5 shrink-0 mt-0.5" />
        <span className="flex-1">
          <span className="font-medium block">Cloud sync not configured</span>
          <span className="text-amber-200/70">
            Set <code className="text-amber-100">VITE_SUPABASE_URL</code> and{' '}
            <code className="text-amber-100">VITE_SUPABASE_ANON_KEY</code> in your
            deploy environment (Vercel → Settings → Environment Variables), then
            redeploy. Edits are still saving to your browser in the meantime.
          </span>
        </span>
      </div>
    );
  }

  // When the user has unsaved local edits and we're in the idle state, the
  // banner switches to an amber "needs publishing" tone so the dot on the
  // Save button has matching context here.
  const showDirty = isDirty && (status === 'idle' || status === 'error');

  const palette = showDirty
    ? 'bg-amber-500/10 border-amber-400/20 text-amber-200/90'
    : {
      loading: 'bg-blue-500/10 border-blue-400/20 text-blue-200/90',
      saving: 'bg-blue-500/10 border-blue-400/20 text-blue-200/90',
      saved: 'bg-emerald-500/10 border-emerald-400/20 text-emerald-200/90',
      error: 'bg-red-500/10 border-red-400/20 text-red-200/90',
      idle: 'bg-white/[0.03] border-white/10 text-white/55',
    }[status] || 'bg-white/[0.03] border-white/10 text-white/55';

  const label = showDirty
    ? 'Unsaved changes — hit Save to publish'
    : {
      loading: 'Syncing from cloud…',
      saving: 'Syncing to cloud…',
      saved: 'Saved to cloud',
      error: 'Cloud sync failed',
      idle: 'Connected to Supabase',
    }[status] || 'Connected to Supabase';

  const Icon = status === 'loading' || status === 'saving'
    ? Loader2
    : status === 'error' && !showDirty
      ? CloudOff
      : status === 'saved'
        ? Check
        : Cloud;

  const spin = (status === 'loading' || status === 'saving') ? 'animate-spin' : '';

  return (
    <div className={`px-5 py-2 border-t text-[11px] leading-snug flex items-center gap-2 ${palette}`}>
      <Icon className={`w-3.5 h-3.5 shrink-0 ${spin}`} />
      <span className="font-medium">{label}</span>
      {status === 'error' && error && !showDirty && (
        <span className="text-red-200/70 truncate">— {error}</span>
      )}
    </div>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-7 h-7 shrink-0 rounded-md border flex items-center justify-center transition-colors ${danger
        ? 'border-red-500/20 text-red-300/80 hover:text-red-200 hover:border-red-400/40'
        : 'border-white/10 text-white/60 hover:text-white hover:border-white/40'
        }`}
    >
      {children}
    </button>
  );
}

function guessPreviewUrl(url) {
  const yt = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`;
  return '';
}

// ---------------------------------------------------------------------------
// CropPicker — live 1.43:1 preview (matches the project card) where the user
// can click/drag to reposition the image's focal point. Stores CSS
// object-position (e.g. "30% 70%") so the real card shows the chosen area.

function CropPicker({ src, position, onChange }) {
  const [dragging, setDragging] = useState(false);
  const ref = useRef(null);

  const parse = (pos) => {
    const m = String(pos || '50% 50%').match(/(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)%/);
    return m ? { x: +m[1], y: +m[2] } : { x: 50, y: 50 };
  };
  const { x, y } = parse(position);

  const setFromEvent = (clientX, clientY) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = Math.min(Math.max(((clientX - rect.left) / rect.width) * 100, 0), 100);
    const py = Math.min(Math.max(((clientY - rect.top) / rect.height) * 100, 0), 100);
    onChange(`${Math.round(px)}% ${Math.round(py)}%`);
  };

  const onDown = (e) => {
    e.preventDefault();
    setDragging(true);
    setFromEvent(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e) => setFromEvent(e.clientX, e.clientY);
    const onTouchMove = (e) => {
      if (e.touches[0]) setFromEvent(e.touches[0].clientX, e.touches[0].clientY);
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
    };
  }, [dragging]); // setFromEvent is stable (closes over ref only)

  if (!src) {
    return (
      <div className="text-[11px] text-white/35 italic border border-dashed border-white/10 rounded-md px-3 py-2">
        Add a URL or image to enable cropping.
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-widest2 text-white/40 flex items-center gap-1.5">
          <Crop className="w-3 h-3" /> Framing
          <span className="text-white/25 normal-case tracking-normal ml-1">
            — drag to choose the focal point
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange('50% 50%')}
          title="Reset to centre"
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 text-[10px] text-white/55 hover:text-white hover:border-white/40"
        >
          <RefreshCw className="w-3 h-3" /> Reset
        </button>
      </div>
      <div
        ref={ref}
        onMouseDown={onDown}
        onTouchStart={(e) => {
          if (e.touches[0]) {
            setDragging(true);
            setFromEvent(e.touches[0].clientX, e.touches[0].clientY);
          }
        }}
        className="relative w-full overflow-hidden rounded-md bg-ink-800 ring-1 ring-white/10 cursor-crosshair select-none"
        style={{ aspectRatio: '1.43 / 1' }}
      >
        <img
          src={src}
          alt=""
          draggable={false}
          onError={(e) => (e.currentTarget.style.display = 'none')}
          style={{ objectPosition: `${x}% ${y}%` }}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        />
        {/* Focal point crosshair */}
        <div
          aria-hidden
          className="absolute w-4 h-4 rounded-full border-2 border-white shadow-[0_0_0_2px_rgba(0,0,0,0.6)] pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${x}%`, top: `${y}%` }}
        />
        {/* rule-of-thirds guides */}
        <div aria-hidden className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/10" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/10" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/10" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/10" />
        </div>
      </div>
      <p className="mt-1 text-[10px] text-white/35 tabular-nums">
        {Math.round(x)}% × {Math.round(y)}%
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MagicLinkGate — the login screen shown when no Supabase session is active.
//
// Flow:
//   1. User types their email → clicks "Send magic link".
//   2. Supabase emails a one-time link that redirects back to this origin.
//   3. On return, the supabase client (with `detectSessionInUrl: true`)
//      parses the tokens from the URL hash, stores the session, and fires
//      an `onAuthStateChange` event. The Editor listens for that and flips
//      `unlocked` to true automatically — no extra plumbing needed here.
//
// Only pre-created users (Supabase → Authentication → Users) can log in,
// because we disabled public sign-ups in the dashboard.
// ---------------------------------------------------------------------------

function MagicLinkGate({ authLoaded }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'error'
  const [error, setError] = useState('');

  // While the first `getSession()` call is in flight we don't know whether
  // the user is already signed in — show a subtle skeleton instead of
  // flashing the login form on every page load.
  if (!authLoaded) {
    return (
      <div className="flex-1 flex items-center justify-center text-[12px] text-white/45">
        <Loader2 className="w-4 h-4 animate-spin mr-2" /> Checking session…
      </div>
    );
  }

  if (!hasSupabase) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center text-white/70">
        <CloudOff className="w-6 h-6 mb-3 text-amber-300/80" />
        <h3 className="text-base mb-1">Supabase not configured</h3>
        <p className="text-[12px] text-white/50 max-w-[280px] leading-relaxed">
          Set <code className="text-white/70">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-white/70">VITE_SUPABASE_ANON_KEY</code> in your
          deployment environment, then redeploy.
        </p>
      </div>
    );
  }

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!email || status === 'sending') return;
    setStatus('sending');
    setError('');
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Redirect back to the exact origin the user is on (dev or prod).
        emailRedirectTo: window.location.origin,
        // Don't auto-create accounts for unknown emails. Only users we've
        // pre-added in Supabase can sign in.
        shouldCreateUser: false,
      },
    });
    if (err) {
      setStatus('error');
      setError(err.message || 'Could not send magic link.');
    } else {
      setStatus('sent');
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex-1 flex flex-col items-center justify-center px-8 text-center"
    >
      <div className="w-14 h-14 rounded-full border border-white/15 flex items-center justify-center mb-5">
        <Lock className="w-5 h-5 text-white/70" />
      </div>
      <h3 className="text-lg mb-1">Sign in to edit</h3>
      <p className="text-[12px] text-white/50 max-w-[300px] leading-relaxed mb-6">
        Enter your email and we'll send you a one-time login link. Only
        approved addresses can sign in.
      </p>

      <input
        type="email"
        autoFocus
        autoComplete="email"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === 'error') setStatus('idle');
        }}
        placeholder="you@example.com"
        disabled={status === 'sending' || status === 'sent'}
        className="w-full max-w-[300px] bg-ink-800/80 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors text-center disabled:opacity-60"
      />

      {status === 'error' && error && (
        <p className="mt-3 text-[12px] text-red-300/90 max-w-[300px]">{error}</p>
      )}

      {status === 'sent' ? (
        <div className="mt-5 w-full max-w-[300px] rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-[12px] text-emerald-200/90">
          <Check className="w-4 h-4 inline-block -mt-0.5 mr-1" />
          <span className="font-medium">Magic link sent.</span> Check{' '}
          <span className="text-emerald-100">{email}</span> and click the link
          to finish signing in. You can close this tab — the link opens a
          new one.
        </div>
      ) : (
        <button
          type="submit"
          disabled={!email || status === 'sending'}
          className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-ink-950 text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <LockOpen className="w-4 h-4" />
          {status === 'sending' ? 'Sending…' : 'Send magic link'}
        </button>
      )}

      <p className="mt-8 text-[10px] text-white/30 max-w-[280px] leading-relaxed">
        Secured by Supabase Auth. Links expire after one use and can only
        open this site.
      </p>
    </form>
  );
}
