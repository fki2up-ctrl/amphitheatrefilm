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
} from 'lucide-react';
import { useContent, serializeToProjectsJs, saveProjectsJs } from '../store/content';

// ---------------------------------------------------------------------------
// Editor drawer — an in-browser UI to edit every piece of site content.
// Changes persist to localStorage automatically. "Export" produces the
// equivalent projects.js source for permanent commits.
//
// Access is gated by a password. We never store the password in source —
// only its SHA-256 hash. Unlock state lives in sessionStorage so it survives
// within a tab but clears when the tab closes. (Reminder: any client-side
// password is obfuscation, not real security. For true access control you'd
// need a server.)
// ---------------------------------------------------------------------------

const PASSWORD_HASH_SHA256 =
  '2e38a37c249c989efb748093d616f9dfe8ad2a1047c8615295e919e93748b093';
const UNLOCK_KEY = 'amphitheatre:editor-unlocked:v1';

async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function Editor({ open, onClose }) {
  const c = useContent();
  const [exportOpen, setExportOpen] = useState(false);
  // 'idle' | 'saving' | 'saved' | 'unsupported' | 'error'
  const [saveStatus, setSaveStatus] = useState('idle');
  const [saveError, setSaveError] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [gitInfo, setGitInfo] = useState(null);

  const doSave = async () => {
    setSaveStatus('saving');
    setSaveError('');
    setGitInfo(null);
    const source = serializeToProjectsJs(c.state);
    const result = await saveProjectsJs(source);
    if (result.ok) {
      setSaveStatus('saved');
      setGitInfo(result.git || null);
      setTimeout(() => setSaveStatus('idle'), 3200);
    } else if (result.notSupported) {
      // Production build (no dev endpoint) — fall back to Export modal.
      setSaveStatus('unsupported');
      setExportOpen(true);
      setTimeout(() => setSaveStatus('idle'), 2200);
    } else {
      setSaveStatus('error');
      setSaveError(result.error || 'Save failed');
    }
  };

  // Save writes directly to src/data/projects.js via the dev endpoint.
  // No password re-prompt — the editor is already unlocked.
  const handleSave = () => doSave();
  const [unlocked, setUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(UNLOCK_KEY) === '1';
    } catch {
      return false;
    }
  });

  const lock = () => {
    try {
      sessionStorage.removeItem(UNLOCK_KEY);
    } catch { /* ignore */ }
    setUnlocked(false);
    onClose();
  };

  const handleUnlock = () => {
    try {
      sessionStorage.setItem(UNLOCK_KEY, '1');
    } catch { /* ignore */ }
    setUnlocked(true);
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
            className="fixed right-0 top-0 bottom-0 z-[91] w-full sm:w-[460px] bg-ink-950 border-l border-white/10 flex flex-col"
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
                {/* Body */}
                <div className="flex-1 overflow-y-auto pretty-scroll px-5 py-5 space-y-8">
                  <ProfileSection c={c} />
                  <FeaturedVideoSection c={c} />
                  <ContactSection c={c} />
                  <BackgroundSection c={c} />
                  <TopicsSection c={c} />

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
                    onClick={lock}
                    title="Lock editor & close"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/40"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Lock
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-ink-950 text-xs font-medium hover:bg-white/90 disabled:opacity-60"
                    >
                      {saveStatus === 'saved' ? (
                        <><Check className="w-3.5 h-3.5" /> Saved</>
                      ) : saveStatus === 'saving' ? (
                        <><SaveIcon className="w-3.5 h-3.5 animate-pulse" /> Saving…</>
                      ) : saveStatus === 'error' ? (
                        <><AlertCircle className="w-3.5 h-3.5" /> Retry</>
                      ) : (
                        <><SaveIcon className="w-3.5 h-3.5" /> Save</>
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
                    className={`px-5 py-2 border-t text-[11px] leading-snug ${
                      gitInfo.pushed
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
              </>
            ) : (
              <PasswordGate onUnlock={handleUnlock} />
            )}
          </motion.aside>

          <ExportModal
            open={exportOpen}
            onClose={() => setExportOpen(false)}
            source={serializeToProjectsJs(c.state)}
          />

          <ConfirmPasswordModal
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirmed={() => {
              setConfirmOpen(false);
              doSave();
            }}
          />
        </>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

function ProfileSection({ c }) {
  const { PROFILE, setProfile } = c;
  return (
    <Section title="Profile" hint="Your photo, name, role, and tagline.">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 shrink-0 rounded-lg overflow-hidden bg-ink-800 ring-1 ring-white/10">
          {PROFILE.photo ? (
            <img src={PROFILE.photo} alt="" className="w-full h-full object-cover" />
          ) : null}
        </div>
        <div className="flex-1">
          <Field
            label="Photo URL"
            value={PROFILE.photo}
            onChange={(v) => setProfile({ photo: v })}
            placeholder="https://…"
          />
        </div>
      </div>
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

      {/* --- Browser tab: title + favicon (logo) ----------------------------- */}
      <div className="pt-3 mt-3 border-t border-white/10">
        <p className="text-[10px] tracking-widest2 uppercase text-white/40 mb-2">
          Browser tab
        </p>
        <Field
          label="Website headline (browser tab title)"
          value={PROFILE.siteTitle || ''}
          onChange={(v) => setProfile({ siteTitle: v })}
          placeholder="My Portfolio — Tagline"
        />
        <div className="flex items-center gap-3 mt-3">
          <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-ink-800 ring-1 ring-white/10 flex items-center justify-center">
            {PROFILE.favicon ? (
              <img
                src={PROFILE.favicon}
                alt="favicon preview"
                className="w-7 h-7 object-contain"
                onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
              />
            ) : null}
          </div>
          <div className="flex-1">
            <Field
              label="Logo / favicon URL"
              value={PROFILE.favicon || ''}
              onChange={(v) => setProfile({ favicon: v })}
              placeholder="/favicon.svg  or  https://…"
              compact
            />
          </div>
        </div>
      </div>
    </Section>
  );
}

function FeaturedVideoSection({ c }) {
  const { PROFILE, setProfile } = c;
  const url = PROFILE.featuredVideo || '';
  const poster = PROFILE.featuredVideoPoster || guessPreviewUrl(url);

  return (
    <Section
      title="Main / Featured video"
      hint="Shown as a big hero banner at the top of the site (desktop & mobile). Leave the URL empty to hide it."
    >
      {poster && url && (
        <div
          className="relative w-full overflow-hidden rounded-md bg-ink-800 ring-1 ring-white/10"
          style={{ aspectRatio: '16 / 9' }}
        >
          <img
            src={poster}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => (e.currentTarget.style.display = 'none')}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/60 to-transparent" />
          <span className="absolute bottom-2 left-3 text-[10px] tracking-widest2 uppercase text-white/70">
            Preview
          </span>
        </div>
      )}
      <Field
        label="Video URL (YouTube, Vimeo, or Instagram)"
        value={url}
        onChange={(v) => setProfile({ featuredVideo: v })}
        placeholder="https://youtu.be/…"
      />
      <Field
        label="Title (optional)"
        value={PROFILE.featuredVideoTitle || ''}
        onChange={(v) => setProfile({ featuredVideoTitle: v })}
        placeholder="e.g. Showreel 2025"
      />
      <Field
        label="Custom poster image (optional — YouTube auto-derives)"
        value={PROFILE.featuredVideoPoster || ''}
        onChange={(v) => setProfile({ featuredVideoPoster: v })}
        placeholder="https://…"
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
  } = c;
  const [open, setOpen] = useState({}); // per-topic open state

  const toggle = (i) => setOpen((o) => ({ ...o, [i]: !o[i] }));

  return (
    <Section
      title="Topics & projects"
      hint="Your categories and every work shown on the grid."
      action={
        <button
          onClick={addTopic}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] text-white/75 hover:text-white hover:border-white/40"
        >
          <Plus className="w-3.5 h-3.5" /> Topic
        </button>
      }
    >
      <div className="space-y-3">
        {state.TOPICS.map((t, ti) => {
          const isOpen = open[ti] ?? ti === 0;
          return (
            <div key={ti} className="rounded-lg border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2 p-2.5">
                <button
                  onClick={() => toggle(ti)}
                  className="flex-1 text-left text-sm text-white/85 hover:text-white px-2 py-1"
                >
                  <span className="text-white/40 mr-2 tabular-nums">
                    {String(ti + 1).padStart(2, '0')}
                  </span>
                  {t.label || 'Untitled topic'}
                  <span className="ml-2 text-[10px] text-white/40">
                    · {t.projects.length} projects
                  </span>
                </button>
                <IconBtn title="Move up" onClick={() => moveTopic(ti, -1)}>
                  <ArrowUp className="w-3.5 h-3.5" />
                </IconBtn>
                <IconBtn title="Move down" onClick={() => moveTopic(ti, +1)}>
                  <ArrowDown className="w-3.5 h-3.5" />
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
                  <Trash2 className="w-3.5 h-3.5" />
                </IconBtn>
              </div>

              {isOpen && (
                <div className="px-3 pb-3 pt-1 space-y-3 border-t border-white/5">
                  <Field
                    label="Topic name"
                    value={t.label}
                    onChange={(v) => updateTopic(ti, { label: v })}
                  />

                  <div className="space-y-2">
                    {t.projects.map((p, pi) => (
                      <div key={pi} className="rounded-md border border-white/10 bg-ink-900/60 p-3 space-y-2">
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
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
                          </div>
                          <div className="flex flex-col gap-1">
                            <IconBtn title="Move up" onClick={() => moveProject(ti, pi, -1)}>
                              <ArrowUp className="w-3 h-3" />
                            </IconBtn>
                            <IconBtn title="Move down" onClick={() => moveProject(ti, pi, +1)}>
                              <ArrowDown className="w-3 h-3" />
                            </IconBtn>
                            <IconBtn title="Delete" onClick={() => removeProject(ti, pi)} danger>
                              <Trash2 className="w-3 h-3" />
                            </IconBtn>
                          </div>
                        </div>
                        <Field
                          label="URL (YouTube, Vimeo, or Instagram)"
                          value={p.url}
                          onChange={(v) => updateProject(ti, pi, { url: v })}
                          compact
                        />
                        <Field
                          label="Custom image URL (optional — YouTube auto-derives)"
                          value={p.image}
                          onChange={(v) => updateProject(ti, pi, { image: v })}
                          compact
                        />
                        <CropPicker
                          src={p.image || guessPreviewUrl(p.url)}
                          position={p.imagePosition || '50% 50%'}
                          onChange={(pos) =>
                            updateProject(ti, pi, { imagePosition: pos })
                          }
                        />
                      </div>
                    ))}

                    <button
                      onClick={() => addProject(ti)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-white/15 text-[11px] text-white/60 hover:text-white hover:border-white/40"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add project to "{t.label}"
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
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

function Section({ title, hint, action, children }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[11px] tracking-widest2 uppercase text-white/50">
            {title}
          </h3>
          {hint && <p className="mt-1 text-[11px] text-white/40">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, textarea, compact }) {
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
    </label>
  );
}

function IconBtn({ children, onClick, title, danger }) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`w-7 h-7 shrink-0 rounded-md border flex items-center justify-center transition-colors ${
        danger
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
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', (e) => {
      if (e.touches[0]) setFromEvent(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging]); // eslint-disable-line react-hooks/exhaustive-deps

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
// Password gate — shown when the Editor is opened but not yet unlocked.
// Verifies the input's SHA-256 against PASSWORD_HASH_SHA256 so the plain
// password never appears in source. Not true security (the hash + logic are
// client-side and inspectable) but a solid casual lock.

function PasswordGate({ onUnlock }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Clear error as the user types.
  useEffect(() => {
    if (error) setError('');
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!value || busy) return;
    setBusy(true);
    try {
      const hash = await sha256Hex(value);
      if (hash === PASSWORD_HASH_SHA256) {
        onUnlock();
      } else {
        setError('Incorrect password.');
      }
    } catch {
      setError('Could not verify password in this browser.');
    } finally {
      setBusy(false);
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
      <h3 className="text-lg mb-1">Protected content</h3>
      <p className="text-[12px] text-white/50 max-w-[300px] leading-relaxed mb-6">
        Enter the editor password to change the profile, topics, or projects
        on this site.
      </p>

      <input
        type="password"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Password"
        className="w-full max-w-[300px] bg-ink-800/80 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors text-center"
      />

      {error && (
        <p className="mt-3 text-[12px] text-red-300/90">{error}</p>
      )}

      <button
        type="submit"
        disabled={!value || busy}
        className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-ink-950 text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <LockOpen className="w-4 h-4" />
        {busy ? 'Checking…' : 'Unlock'}
      </button>

      <p className="mt-8 text-[10px] text-white/30 max-w-[280px] leading-relaxed">
        Note: client-side passwords are a casual lock, not real security. If
        you need strict access control, gate the site behind a host login.
      </p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Confirm-password modal — shown every time the user hits "Save" so an
// unattended unlocked drawer can't be used to overwrite the file.

function ConfirmPasswordModal({ open, onClose, onConfirmed }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Reset fields whenever the modal opens fresh.
  useEffect(() => {
    if (open) {
      setValue('');
      setError('');
      setBusy(false);
    }
  }, [open]);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!value || busy) return;
    setBusy(true);
    try {
      const hash = await sha256Hex(value);
      if (hash === PASSWORD_HASH_SHA256) {
        onConfirmed();
      } else {
        setError('Incorrect password.');
      }
    } catch {
      setError('Could not verify password.');
    } finally {
      setBusy(false);
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
          className="fixed inset-0 z-[105] bg-black/70 flex items-center justify-center p-4"
        >
          <motion.form
            onSubmit={submit}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-ink-900 border border-white/10 rounded-xl p-6 text-center"
          >
            <div className="w-12 h-12 mx-auto rounded-full border border-white/15 flex items-center justify-center mb-4">
              <Lock className="w-4 h-4 text-white/70" />
            </div>
            <h3 className="text-base mb-1">Confirm to save</h3>
            <p className="text-[12px] text-white/55 mb-5 leading-relaxed">
              Re-enter the editor password to write these changes to the site's
              content file.
            </p>
            <input
              type="password"
              autoFocus
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError('');
              }}
              placeholder="Password"
              className="w-full bg-ink-800/80 border border-white/10 rounded-md px-3 py-2.5 text-sm text-white/90 placeholder:text-white/30 focus:outline-none focus:border-white/30 transition-colors text-center"
            />
            {error && (
              <p className="mt-3 text-[12px] text-red-300/90">{error}</p>
            )}
            <div className="mt-5 flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg border border-white/10 text-xs text-white/70 hover:text-white hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!value || busy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-ink-950 text-xs font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? 'Checking…' : 'Confirm & save'}
              </button>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
