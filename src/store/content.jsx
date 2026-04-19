// ---------------------------------------------------------------------------
// Content store — holds the editable site content in React state, persists it
// to localStorage, and exposes the same-shaped exports (BRAND, CATEGORIES …)
// the components read from. The initial content comes from src/data/projects.js.
//
// Any change made through the in-browser Editor updates this store, which
// re-renders the whole site instantly and saves to localStorage so the edits
// survive reloads. The Editor's "Export" button serialises the state back to
// a projects.js-compatible source for permanent changes.
// ---------------------------------------------------------------------------

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as defaults from '../data/projects';
import { parseYouTubeId } from '../lib/embed';
import { supabase, hasSupabase } from '../lib/supabase';
import { normalizeCloudinaryForStorage } from '../utils/cloudinary';

// Stable UUID for a topic or project row. Native crypto.randomUUID() when
// available (all modern browsers + Node); falls back to a decent-enough
// time+random string for ancient environments.
function genId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

const STORAGE_KEY = 'amphitheatre:content:v1';

// Shape we keep in state — flat & friendly, mirrors the file sections.
function buildInitial() {
  return {
    PROFILE:    { ...defaults.PROFILE },
    CONTACT:    { ...defaults.CONTACT },
    BACKGROUND: { ...defaults.BACKGROUND },
    TOPICS: defaults.TOPICS.map((t) => ({
      id: genId(),
      label: t.label,
      projects: t.projects.map((p) => ({
        id: genId(),
        title:    p.title    ?? '',
        subtitle: p.subtitle ?? '',
        url:      p.url      ?? '',
        image:    '',
        // CSS object-position — e.g. '50% 50%'. Controls which part of the
        // thumbnail image is visible inside the 1.43:1 card crop.
        imagePosition: '50% 50%',
      })),
    })),
  };
}

function loadStored() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.PROFILE || !Array.isArray(parsed.TOPICS)) return null;
    const defaultState = buildInitial();
    // Forward-compat: merge any newly-added default fields into the stored
    // shape so schema additions (e.g. siteTitle, favicon) light up for users
    // who already have earlier local edits. Also back-fill stable IDs on
    // topics & projects saved before the Supabase migration.
    const TOPICS = parsed.TOPICS.map((t) => ({
      id: t.id || genId(),
      label: t.label,
      projects: (t.projects || []).map((p) => ({
        id: p.id || genId(),
        title: p.title ?? '',
        subtitle: p.subtitle ?? '',
        url: p.url ?? '',
        image: p.image ?? '',
        imagePosition: p.imagePosition ?? '50% 50%',
      })),
    }));
    return {
      ...defaultState,
      ...parsed,
      TOPICS,
      PROFILE:    { ...defaultState.PROFILE,    ...parsed.PROFILE },
      CONTACT:    { ...defaultState.CONTACT,    ...parsed.CONTACT },
      BACKGROUND: { ...defaultState.BACKGROUND, ...parsed.BACKGROUND },
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers mirrored from data/projects.js so the store is self-contained.

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'topic';
}

function autoThumbnail(url) {
  const ytId = parseYouTubeId(String(url || ''));
  if (ytId) return `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
  return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1600&auto=format&fit=crop';
}

// ---------------------------------------------------------------------------

const ContentContext = createContext(null);

// Stable serialisation used for the dirty-check. We fingerprint the full
// editable state (TOPICS + PROFILE + CONTACT + BACKGROUND) so any change a
// user makes in the editor flips `isDirty`, regardless of whether that
// particular field currently syncs to Supabase or only to projects.js.
function snapshotOf(s) {
  return JSON.stringify({
    TOPICS: s.TOPICS,
    PROFILE: s.PROFILE,
    CONTACT: s.CONTACT,
    BACKGROUND: s.BACKGROUND,
  });
}

export function ContentProvider({ children }) {
  const [state, setState] = useState(() => loadStored() ?? buildInitial());

  // --- Cloud sync state --------------------------------------------------
  // syncStatus: 'idle' | 'loading' | 'saving' | 'saved' | 'error'
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncError, setSyncError]   = useState(null);

  // --- Dirty tracking ----------------------------------------------------
  // `cleanSnapshot` = serialised state at the last "publish" point (initial
  // load, after cloud fetch, or after a successful Save). Any deviation from
  // this string means the user has unsaved changes.
  const [cleanSnapshot, setCleanSnapshot] = useState(() => snapshotOf(state));
  const isDirty = useMemo(
    () => snapshotOf(state) !== cleanSnapshot,
    [state, cleanSnapshot]
  );

  // Warn the user if they try to close the tab / navigate away with unsaved
  // edits. Browsers ignore the custom message but still show their own
  // generic "Leave site?" prompt. Registered at the provider level so it
  // fires even when the Editor drawer is closed.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = ''; // required for Chrome
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [state]);

  // One-shot fetch from Supabase on mount. If the cloud has data, it wins
  // over whatever's in localStorage (cloud is the source of truth once
  // connected). If the cloud is empty or unreachable, we keep the local
  // state and the user can push it up via Save.
  useEffect(() => {
    if (!hasSupabase) return;
    let cancelled = false;

    (async () => {
      setSyncStatus('loading');
      setSyncError(null);
      try {
        const [topicsRes, projectsRes] = await Promise.all([
          supabase
            .from('topics')
            .select('id, label, order_index')
            .order('order_index', { ascending: true }),
          supabase
            .from('projects')
            .select('id, topic_id, title, subtitle, url, image, image_position, order_index')
            .order('order_index', { ascending: true }),
        ]);

        if (topicsRes.error)   throw topicsRes.error;
        if (projectsRes.error) throw projectsRes.error;

        const topicsData   = topicsRes.data   || [];
        const projectsData = projectsRes.data || [];

        if (topicsData.length === 0) {
          // Empty cloud — keep local state untouched, user can push later.
          if (!cancelled) setSyncStatus('idle');
          return;
        }

        const byTopic = Object.create(null);
        for (const p of projectsData) {
          (byTopic[p.topic_id] ??= []).push(p);
        }
        const TOPICS = topicsData.map((t) => ({
          id: t.id,
          label: t.label,
          projects: (byTopic[t.id] || []).map((p) => ({
            id: p.id,
            title: p.title || '',
            subtitle: p.subtitle || '',
            url: p.url || '',
            image: p.image || '',
            imagePosition: p.image_position || '50% 50%',
          })),
        }));

        if (cancelled) return;
        setState((s) => {
          const next = { ...s, TOPICS };
          // Treat the just-fetched state as "clean" — the cloud is what
          // it is, so there's nothing to publish yet.
          setCleanSnapshot(snapshotOf(next));
          return next;
        });
        setSyncStatus('idle');
      } catch (err) {
        if (cancelled) return;
         
        console.warn('[supabase] fetch failed:', err);
        setSyncError(err.message || String(err));
        setSyncStatus('error');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const reset = useCallback(() => {
    const fresh = buildInitial();
    setState(fresh);
    // Reset counts as "clean" — you haven't edited anything yet.
    setCleanSnapshot(snapshotOf(fresh));
  }, []);

  // --- Mutation helpers the Editor binds to -------------------------------
  const setProfile = useCallback(
    (patch) => setState((s) => ({ ...s, PROFILE: { ...s.PROFILE, ...patch } })),
    []
  );
  const setContact = useCallback(
    (patch) => setState((s) => ({ ...s, CONTACT: { ...s.CONTACT, ...patch } })),
    []
  );
  const setBackground = useCallback(
    (patch) => setState((s) => ({ ...s, BACKGROUND: { ...s.BACKGROUND, ...patch } })),
    []
  );

  const updateTopic = useCallback((index, patch) => {
    setState((s) => {
      const TOPICS = [...s.TOPICS];
      TOPICS[index] = { ...TOPICS[index], ...patch };
      return { ...s, TOPICS };
    });
  }, []);

  const addTopic = useCallback(() => {
    setState((s) => ({
      ...s,
      TOPICS: [...s.TOPICS, { id: genId(), label: 'New Topic', projects: [] }],
    }));
  }, []);

  const removeTopic = useCallback((index) => {
    setState((s) => ({
      ...s,
      TOPICS: s.TOPICS.filter((_, i) => i !== index),
    }));
  }, []);

  const moveTopic = useCallback((index, dir) => {
    setState((s) => {
      const TOPICS = [...s.TOPICS];
      const j = index + dir;
      if (j < 0 || j >= TOPICS.length) return s;
      [TOPICS[index], TOPICS[j]] = [TOPICS[j], TOPICS[index]];
      return { ...s, TOPICS };
    });
  }, []);

  const updateProject = useCallback((ti, pi, patch) => {
    setState((s) => {
      const TOPICS = [...s.TOPICS];
      const t = { ...TOPICS[ti] };
      t.projects = [...t.projects];
      t.projects[pi] = { ...t.projects[pi], ...patch };
      TOPICS[ti] = t;
      return { ...s, TOPICS };
    });
  }, []);

  const addProject = useCallback((ti) => {
    setState((s) => {
      const TOPICS = [...s.TOPICS];
      const t = { ...TOPICS[ti] };
      t.projects = [
        ...t.projects,
        { id: genId(), title: 'New project', subtitle: '', url: '', image: '', imagePosition: '50% 50%' },
      ];
      TOPICS[ti] = t;
      return { ...s, TOPICS };
    });
  }, []);

  const removeProject = useCallback((ti, pi) => {
    setState((s) => {
      const TOPICS = [...s.TOPICS];
      const t = { ...TOPICS[ti] };
      t.projects = t.projects.filter((_, i) => i !== pi);
      TOPICS[ti] = t;
      return { ...s, TOPICS };
    });
  }, []);

  const moveProject = useCallback((ti, pi, dir) => {
    setState((s) => {
      const TOPICS = [...s.TOPICS];
      const t = { ...TOPICS[ti] };
      t.projects = [...t.projects];
      const j = pi + dir;
      if (j < 0 || j >= t.projects.length) return s;
      [t.projects[pi], t.projects[j]] = [t.projects[j], t.projects[pi]];
      TOPICS[ti] = t;
      return { ...s, TOPICS };
    });
  }, []);

  // Push the current TOPICS + projects to Supabase. Uses `upsert` on `id` so
  // existing rows are updated in-place and new rows are inserted. Rows that
  // were deleted locally are pruned by id-exclusion. Cloudinary image URLs
  // are normalised with f_auto,q_auto before being written so the DB always
  // holds storage-optimised values.
  const saveToCloud = useCallback(async () => {
    if (!hasSupabase) {
      throw new Error('Supabase is not configured (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
    }

    setSyncStatus('saving');
    setSyncError(null);

    try {
      const now = new Date().toISOString();

      // --- 1. Topics -------------------------------------------------------
      const topicsPayload = state.TOPICS.map((t, i) => ({
        id: t.id,
        label: t.label,
        order_index: i,
        updated_at: now,
      }));

      if (topicsPayload.length > 0) {
        const { error } = await supabase
          .from('topics')
          .upsert(topicsPayload, { onConflict: 'id' });
        if (error) throw error;
      }

      // --- 2. Projects -----------------------------------------------------
      const projectsPayload = [];
      for (const [ti, t] of state.TOPICS.entries()) {
        for (const [pi, p] of t.projects.entries()) {
          projectsPayload.push({
            id: p.id,
            topic_id: t.id,
            title: p.title || '',
            subtitle: p.subtitle || '',
            url: p.url || '',
            image: normalizeCloudinaryForStorage(p.image || ''),
            image_position: p.imagePosition || '50% 50%',
            order_index: pi,
            updated_at: now,
          });
        }
      }

      if (projectsPayload.length > 0) {
        const { error } = await supabase
          .from('projects')
          .upsert(projectsPayload, { onConflict: 'id' });
        if (error) throw error;
      }

      // --- 3. Prune rows that were removed locally ------------------------
      // PostgREST requires every DELETE to have a filter. Use `not.in` when
      // we have IDs to keep, otherwise a trivially-true filter to wipe all.
      const keepTopicIds   = topicsPayload.map((t) => t.id);
      const keepProjectIds = projectsPayload.map((p) => p.id);
      const SENTINEL_UUID  = '00000000-0000-0000-0000-000000000000';

      {
        const q = supabase.from('projects').delete();
        const { error } = keepProjectIds.length > 0
          ? await q.not('id', 'in', `(${keepProjectIds.join(',')})`)
          : await q.neq('id', SENTINEL_UUID);
        if (error) console.warn('[supabase] prune projects:', error);
      }
      {
        const q = supabase.from('topics').delete();
        const { error } = keepTopicIds.length > 0
          ? await q.not('id', 'in', `(${keepTopicIds.join(',')})`)
          : await q.neq('id', SENTINEL_UUID);
        if (error) console.warn('[supabase] prune topics:', error);
      }

      setSyncStatus('saved');
      // Everything the user typed is now published — clear the dirty flag.
      setCleanSnapshot(snapshotOf(state));
      // Auto-fade back to idle so repeat saves feel fresh.
      setTimeout(() => {
        setSyncStatus((s) => (s === 'saved' ? 'idle' : s));
      }, 2600);

      return { ok: true };
    } catch (err) {
       
      console.error('[supabase] save failed:', err);
      setSyncError(err.message || String(err));
      setSyncStatus('error');
      return { ok: false, error: err.message || String(err) };
    }
  }, [state]);

  // Move a project to any (topic, index). Powers drag-and-drop reordering
  // across topics. `dstPi` is the index BEFORE which the project will land,
  // measured in the destination topic's *current* projects list.
  const moveProjectTo = useCallback((srcTi, srcPi, dstTi, dstPi) => {
    setState((s) => {
      if (
        srcTi < 0 || srcTi >= s.TOPICS.length ||
        dstTi < 0 || dstTi >= s.TOPICS.length
      ) return s;
      // Same-slot no-op (dropping back into own position).
      if (srcTi === dstTi && (dstPi === srcPi || dstPi === srcPi + 1)) return s;

      const TOPICS = s.TOPICS.map((t) => ({ ...t, projects: [...t.projects] }));
      const [moved] = TOPICS[srcTi].projects.splice(srcPi, 1);
      if (!moved) return s;

      // When moving within the same topic to a later index, the splice above
      // shifts everything left by one — adjust destination accordingly.
      let dst = dstPi;
      if (srcTi === dstTi && dstPi > srcPi) dst -= 1;
      dst = Math.max(0, Math.min(dst, TOPICS[dstTi].projects.length));

      TOPICS[dstTi].projects.splice(dst, 0, moved);
      return { ...s, TOPICS };
    });
  }, []);

  // --- Derived "read" shape (same as data/projects.js exports) ------------
  const derived = useMemo(() => {
    const TOPICS = state.TOPICS.map((t, ti) => {
      const id = slug(t.label) + '-' + (ti + 1);
      return {
        id,
        label: t.label,
        projects: t.projects.map((p, pi) => ({
          id: `${id}-${pi + 1}`,
          title: p.title,
          subtitle: p.subtitle,
          url: p.url,
          thumbnail: p.image || autoThumbnail(p.url),
          imagePosition: p.imagePosition || '50% 50%',
        })),
      };
    });
    const CATEGORIES = TOPICS;
    const ALL_PROJECTS = TOPICS.flatMap((c) =>
      c.projects.map((p) => ({ ...p, categoryId: c.id, categoryLabel: c.label }))
    );
    const BRAND = {
      name:    state.PROFILE.name,
      role:    state.PROFILE.role,
      tagline: state.PROFILE.tagline,
      email:   state.CONTACT.email,
      socials: {
        instagram: state.CONTACT.instagram,
        facebook:  state.CONTACT.facebook,
        linktree:  state.CONTACT.linktree,
      },
    };
    const SITE_ASSETS = {
      headerImage: state.PROFILE.photo,
      headerImageShape: 'square',
      background: state.BACKGROUND,
    };
    return { BRAND, SITE_ASSETS, CATEGORIES, TOPICS, ALL_PROJECTS };
  }, [state]);

  const value = {
    // raw editable state for the Editor
    state,
    setProfile,
    setContact,
    setBackground,
    updateTopic,
    addTopic,
    removeTopic,
    moveTopic,
    updateProject,
    addProject,
    removeProject,
    moveProject,
    moveProjectTo,
    reset,
    // cloud sync
    saveToCloud,
    syncStatus,
    syncError,
    hasSupabase,
    isDirty,
    // read shape for components
    ...derived,
    PROFILE: state.PROFILE,
    CONTACT: state.CONTACT,
    BACKGROUND: state.BACKGROUND,
  };

  return (
    <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
  );
}

export function useContent() {
  const v = useContext(ContentContext);
  if (!v) throw new Error('useContent must be used inside <ContentProvider>');
  return v;
}

// ---------------------------------------------------------------------------
// Serialise current state into a COMPLETE, self-running src/data/projects.js
// source string. The Editor's "Save" button writes this directly back to disk
// via a dev-only Vite endpoint; "Export" shows it in a modal as a fallback.

export function serializeToProjectsJs(state) {
  const s = (v) => JSON.stringify(v);
  const topicsSrc = state.TOPICS.map((t) => {
    const projs = t.projects
      .map((p) => {
        const lines = [
          `      title:    ${s(p.title)},`,
          p.subtitle ? `      subtitle: ${s(p.subtitle)},` : null,
          `      url:      ${s(p.url)},`,
          p.image ? `      image:    ${s(p.image)},` : null,
          p.imagePosition && p.imagePosition !== '50% 50%'
            ? `      imagePosition: ${s(p.imagePosition)},`
            : null,
        ].filter(Boolean);
        return `    project({\n${lines.join('\n')}\n    }),`;
      })
      .join('\n');
    return `  topic(${s(t.label)}, [\n${projs}\n  ]),`;
  }).join('\n\n');

  return `/* ============================================================================
   🎬  AMPHITHEATRE FILM — CONTENT
   ============================================================================
   Maintained by the in-browser Editor (click the pencil in the sidebar).
   You can also hand-edit the sections below; the Editor picks up changes on
   the next reload. Don't touch the helpers / legacy exports near the bottom.
   ============================================================================ */


/* ── 1. PROFILE ──────────────────────────────────────────────────────────── */

export const PROFILE = {
  photo:               ${s(state.PROFILE.photo)},
  name:                ${s(state.PROFILE.name)},
  role:                ${s(state.PROFILE.role)},
  tagline:             ${s(state.PROFILE.tagline)},
  taglineEmphasis:     ${s(state.PROFILE.taglineEmphasis || '')},
  siteTitle:           ${s(state.PROFILE.siteTitle || '')},
  favicon:             ${s(state.PROFILE.favicon || '')},
  featuredVideo:       ${s(state.PROFILE.featuredVideo || '')},
  featuredVideoTitle:  ${s(state.PROFILE.featuredVideoTitle || '')},
  featuredVideoPoster: ${s(state.PROFILE.featuredVideoPoster || '')},
};


/* ── 2. CONTACT ──────────────────────────────────────────────────────────── */

export const CONTACT = {
  email:     ${s(state.CONTACT.email)},
  instagram: ${s(state.CONTACT.instagram)},
  facebook:  ${s(state.CONTACT.facebook)},
  linktree:  ${s(state.CONTACT.linktree)},
};


/* ── 3. BACKGROUND ───────────────────────────────────────────────────────── */

export const BACKGROUND = {
  color:   ${s(state.BACKGROUND.color)},
  image:   ${state.BACKGROUND.image ? s(state.BACKGROUND.image) : 'null'},
  overlay: ${s(state.BACKGROUND.overlay)},
};


/* ── 4. TOPICS & PROJECTS ────────────────────────────────────────────────── */

export const TOPICS = [

${topicsSrc}

];


/* ══════════════════════════════════════════════════════════════════════════
   Helpers & legacy exports — do not edit by hand.
   ══════════════════════════════════════════════════════════════════════════ */

function topic(label, items) {
  const id = slug(label);
  return {
    id,
    label,
    projects: items.map((p, i) => ({ ...p, id: \`\${id}-\${i + 1}\` })),
  };
}

function project({ title, subtitle = '', url, image = '', imagePosition = '50% 50%' }) {
  return {
    title,
    subtitle,
    url,
    thumbnail: image || autoThumbnail(url),
    imagePosition,
  };
}

function autoThumbnail(url) {
  const id = parseYouTubeId(String(url || ''));
  if (id) return \`https://img.youtube.com/vi/\${id}/maxresdefault.jpg\`;
  return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1600&auto=format&fit=crop';
}

// Robust YouTube ID extraction — handles share links with params in any order,
// mobile/music subdomains, and the /embed/, /shorts/, /live/, /v/ path forms.
function parseYouTubeId(url) {
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\\.|m\\.|music\\.)/, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || '';
      if (ID_RE.test(id)) return id;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && ID_RE.test(v)) return v;
      const m = u.pathname.match(/^\\/(?:embed|shorts|live|v)\\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch { /* fall through */ }
  const m = url.match(
    /(?:youtu\\.be\\/|youtube(?:-nocookie)?\\.com\\/(?:watch\\?[^#]*?\\bv=|embed\\/|shorts\\/|live\\/|v\\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'topic';
}

export const BRAND = {
  name:    PROFILE.name,
  role:    PROFILE.role,
  tagline: PROFILE.tagline,
  email:   CONTACT.email,
  socials: {
    instagram: CONTACT.instagram,
    facebook:  CONTACT.facebook,
    linktree:  CONTACT.linktree,
  },
};

export const SITE_ASSETS = {
  headerImage: PROFILE.photo,
  headerImageShape: 'square',
  background: BACKGROUND,
};

export const CATEGORIES = TOPICS;

export const ALL_PROJECTS = CATEGORIES.flatMap((c) =>
  c.projects.map((p) => ({ ...p, categoryId: c.id, categoryLabel: c.label }))
);
`;
}

// ---------------------------------------------------------------------------
// POST the serialised source to the dev-server endpoint. Returns:
//   { ok: true }                  — saved to disk
//   { ok: false, notSupported }   — endpoint missing (e.g. production build)
//   { ok: false, error: string }  — other failure
export async function saveProjectsJs(source) {
  try {
    const res = await fetch('/__save-projects', {
      method: 'POST',
      headers: { 'content-type': 'text/plain; charset=utf-8' },
      body: source,
    });
    if (res.status === 404) return { ok: false, notSupported: true };
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true, bytes: data.bytes, git: data.git };
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, notSupported: true, error: String(e?.message || e) };
  }
}
