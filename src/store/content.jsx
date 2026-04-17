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

const STORAGE_KEY = 'amphitheatre:content:v1';

// Shape we keep in state — flat & friendly, mirrors the file sections.
function buildInitial() {
  return {
    PROFILE:    { ...defaults.PROFILE },
    CONTACT:    { ...defaults.CONTACT },
    BACKGROUND: { ...defaults.BACKGROUND },
    TOPICS: defaults.TOPICS.map((t) => ({
      label: t.label,
      projects: t.projects.map((p) => ({
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
    // Forward-compat: merge any newly-added default fields into the stored
    // shape so schema additions (e.g. siteTitle, favicon) light up for users
    // who already have earlier local edits.
    const defaultState = buildInitial();
    return {
      ...defaultState,
      ...parsed,
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
  const yt = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  if (yt) return `https://img.youtube.com/vi/${yt[1]}/maxresdefault.jpg`;
  return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1600&auto=format&fit=crop';
}

// ---------------------------------------------------------------------------

const ContentContext = createContext(null);

export function ContentProvider({ children }) {
  const [state, setState] = useState(() => loadStored() ?? buildInitial());

  // Persist on every change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode — ignore */
    }
  }, [state]);

  const reset = useCallback(() => setState(buildInitial()), []);

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
      TOPICS: [...s.TOPICS, { label: 'New Topic', projects: [] }],
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
        { title: 'New project', subtitle: '', url: '', image: '', imagePosition: '50% 50%' },
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
    reset,
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
  const yt = String(url || '').match(
    /(?:youtu\\.be\\/|youtube\\.com\\/(?:watch\\?v=|embed\\/|shorts\\/))([A-Za-z0-9_-]{11})/
  );
  if (yt) return \`https://img.youtube.com/vi/\${yt[1]}/maxresdefault.jpg\`;
  return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1600&auto=format&fit=crop';
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
    if (res.ok && data.ok) return { ok: true, bytes: data.bytes };
    return { ok: false, error: data.error || `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, notSupported: true, error: String(e?.message || e) };
  }
}
