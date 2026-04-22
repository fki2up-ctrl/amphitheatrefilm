// ---------------------------------------------------------------------------
// AssetPicker — tiny "pick from library" button that opens a modal grid of
// every asset of a given kind (image | video) already uploaded to Supabase.
// Selecting one fires `onPick(url)` and closes the modal.
//
// Designed to sit next to an ImageUploader / VideoUploader as a secondary
// action, so editors can reuse assets across fields without re-uploading.
// ---------------------------------------------------------------------------

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderOpen, X, Loader2, ImageIcon, Film, Check } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';
import SmartVideo from './SmartVideo';

/**
 * @param {object} props
 * @param {'image'|'video'} props.kind
 * @param {(url:string)=>void} props.onPick
 * @param {string} [props.value]          — currently selected URL (highlighted)
 * @param {string} [props.label]          — button label (default "Library")
 * @param {boolean} [props.compact]       — smaller button
 */
export default function AssetPicker({ kind, onPick, value, label = 'Library', compact = false }) {
  const [open, setOpen] = useState(false);

  if (!hasSupabase) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          'inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-ink-900/60 text-white/75 hover:text-white hover:border-white/40 transition-colors',
          compact ? 'px-2 py-1 text-[10px]' : 'px-2.5 py-1.5 text-[11px]',
        ].join(' ')}
        title={`Pick from the ${kind} library`}
      >
        <FolderOpen className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {label}
      </button>

      {open && createPortal(
        <PickerModal
          kind={kind}
          value={value}
          onPick={(url) => { onPick?.(url); setOpen(false); }}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}

function PickerModal({ kind, value, onPick, onClose }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr('');
      try {
        const { data, error } = await supabase
          .from('assets')
          .select('id, kind, url, filename, width, height, created_at')
          .eq('kind', kind)
          .order('created_at', { ascending: false })
          .limit(200);
        if (error) throw error;
        if (!cancelled) setAssets(data || []);
      } catch (e) {
        if (!cancelled) setErr(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [kind]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
        onClick={onClose}
        className="fixed inset-0 z-[120] bg-black/70 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-4xl max-h-[85vh] bg-ink-900 border border-white/10 rounded-xl overflow-hidden flex flex-col"
        >
          <header className="flex items-center justify-between px-5 py-3 border-b border-white/10">
            <div>
              <p className="text-[10px] tracking-widest2 uppercase text-white/45">Asset library</p>
              <h3 className="text-base text-white/90 flex items-center gap-2">
                {kind === 'image' ? <ImageIcon className="w-4 h-4" /> : <Film className="w-4 h-4" />}
                Pick {kind === 'image' ? 'an image' : 'a video'}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/40"
            >
              <X className="w-4 h-4" />
            </button>
          </header>

          <div className="flex-1 overflow-y-auto pretty-scroll p-5">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-white/50 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : err ? (
              <p className="text-[12px] text-red-300/90 leading-snug">{err}</p>
            ) : assets.length === 0 ? (
              <div className="text-center py-16 text-white/50 text-[12px]">
                No {kind}s uploaded yet. Drop files into the Asset library section to add some.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {assets.map((asset) => {
                  const selected = asset.url === value;
                  return (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => onPick(asset.url)}
                      className={[
                        'group relative rounded-md overflow-hidden bg-ink-950 ring-1 transition-all text-left',
                        selected
                          ? 'ring-2 ring-emerald-400'
                          : 'ring-white/10 hover:ring-white/40',
                      ].join(' ')}
                      style={{ aspectRatio: kind === 'image' ? '4 / 3' : '16 / 9' }}
                    >
                      {kind === 'image' ? (
                        <img
                          src={asset.url}
                          alt={asset.filename || ''}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="absolute inset-0">
                          <SmartVideo url={asset.url} muted loop />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-ink-950/90 to-transparent">
                        <p className="text-[10px] text-white/85 truncate">
                          {asset.filename || asset.url.split('/').pop()}
                        </p>
                      </div>
                      {selected && (
                        <div className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-emerald-400 text-ink-950 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="px-5 py-2.5 border-t border-white/10 text-[11px] text-white/40">
            {assets.length > 0 && `${assets.length} ${kind}${assets.length === 1 ? '' : 's'} — click to select`}
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
