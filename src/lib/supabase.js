// ---------------------------------------------------------------------------
// Supabase client — thin factory around `@supabase/supabase-js`.
//
// Env vars (exposed to the Vite bundle via the VITE_ prefix):
//   VITE_SUPABASE_URL      — e.g. https://xxxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY — the public anon key from Project Settings → API
//
// When either variable is missing, `supabase` is `null` and `hasSupabase` is
// `false`. Callers must guard on `hasSupabase` so the app keeps working in
// pure-local mode (dev without credentials, preview deploys, etc.).
//
// NOTE: the "anon" key is safe to ship in client code — Row Level Security
// on Supabase is what actually protects your rows. Make sure you've enabled
// RLS and written policies for every table you read / write (see README).
// ---------------------------------------------------------------------------

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hasSupabase = Boolean(url && key);

export const supabase = hasSupabase
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Small default timeout-ish: keep the client lean; we don't use
      // realtime subscriptions yet.
      realtime: { params: { eventsPerSecond: 2 } },
    })
  : null;

if (!hasSupabase && typeof window !== 'undefined') {
  // One-time notice so you know why cloud features are disabled.
   
  console.warn(
    '[supabase] VITE_SUPABASE_URL and/or VITE_SUPABASE_ANON_KEY are missing. ' +
      'Running in local-only mode — edits persist to localStorage but not to the cloud.'
  );
}
