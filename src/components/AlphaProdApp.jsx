// ---------------------------------------------------------------------------
// AlphaProdApp — standalone root for the /alphaprod route.
// Completely isolated from the portfolio's layout, sidebar, and phase system.
// Wraps TheatreAlpha in its own full-screen studio console shell with
// Supabase auth gating identical to the Editor drawer.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Clapperboard, Loader2, LogOut, ArrowLeft } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';
import TheatreAlpha from './TheatreAlpha';

// ---------------------------------------------------------------------------
// Auth gate — same magic-link flow the Editor uses, but rendered full-page.
// ---------------------------------------------------------------------------
function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loaded, setLoaded]   = useState(!hasSupabase);
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [err, setErr]         = useState('');

  useEffect(() => {
    if (!hasSupabase) return;
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoaded(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => {
      setSession(s ?? null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  const signIn = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/alphaprod` },
      });
      if (error) throw error;
      setSent(true);
    } catch (ex) {
      setErr(ex.message || String(ex));
    }
  };

  const signOut = async () => {
    if (hasSupabase) {
      try { await supabase.auth.signOut(); } catch { /* noop */ }
    }
    setSession(null);
  };

  // No Supabase → open access (local dev)
  if (!hasSupabase) return children;

  // Loading spinner
  if (!loaded) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-white/50" />
      </div>
    );
  }

  // Authenticated → render children + sign-out in header is handled by Layout
  if (session) {
    return (
      <AlphaProdLayout onSignOut={signOut}>
        {children}
      </AlphaProdLayout>
    );
  }

  // Unauthenticated → full-page login
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm px-6"
      >
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <Clapperboard className="w-5 h-5 text-amber-400" />
          <span className="text-sm tracking-[0.35em] uppercase text-white/90 font-medium">
            AlphaPROD.
          </span>
        </div>

        {sent ? (
          <p className="text-center text-sm text-white/60">
            Check your inbox for the login link.
          </p>
        ) : (
          <form onSubmit={signIn} className="space-y-4">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-amber-500/50 transition-colors"
            />
            <button
              type="submit"
              className="w-full py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold tracking-wide transition-colors"
            >
              Send magic link
            </button>
          </form>
        )}

        {err && (
          <p className="mt-3 text-center text-xs text-red-400">{err}</p>
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AlphaProdLayout — full-viewport dark studio chrome.
// Completely separate from the portfolio's Sidebar / MobileNav / etc.
// ---------------------------------------------------------------------------
function AlphaProdLayout({ onSignOut, children }) {
  return (
    <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="shrink-0 flex items-center justify-between px-5 h-14 border-b border-white/8">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="text-[10px] tracking-[0.25em] uppercase">Portfolio</span>
          </a>
          <span className="text-white/15 text-xs">|</span>
          <div className="flex items-center gap-2">
            <Clapperboard className="w-4 h-4 text-amber-400" />
            <span className="text-xs tracking-[0.3em] uppercase text-white/80 font-medium">
              AlphaPROD.
            </span>
          </div>
        </div>

        {onSignOut && (
          <button
            onClick={onSignOut}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        )}
      </header>

      {/* Content area — TheatreAlpha fills the rest */}
      <main className="flex-1 min-h-0 overflow-hidden p-4 sm:p-6">
        {children}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export — route entry for /alphaprod
// ---------------------------------------------------------------------------
export default function AlphaProdApp() {
  // When Supabase is disabled (local dev), render layout directly.
  if (!hasSupabase) {
    return (
      <AlphaProdLayout>
        <TheatreAlpha />
      </AlphaProdLayout>
    );
  }

  return (
    <AuthGate>
      <TheatreAlpha />
    </AuthGate>
  );
}
