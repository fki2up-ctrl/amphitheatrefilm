// ---------------------------------------------------------------------------
// AssetPicker — tiny "pick from library" button that opens a modal grid of
// every asset of a given kind (image | video) already uploaded to Supabase.
// Selecting one fires `onPick(url)` and closes the modal.
//
// Designed to sit next to an ImageUploader / VideoUploader as a secondary
// action, so editors can reuse assets across fields without re-uploading.
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FolderOpen, X, Loader2, ImageIcon, Film, Check, Trash2, FolderInput, FolderPlus } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';
import SmartVideo from './SmartVideo';

// Sentinel used for the "Unsorted" pseudo-folder (assets with folder === null).
const UNSORTED = '__unsorted__';
const ALL      = '__all__';

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
  const [assets, setAssets]       = useState([]);
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState('');
  const [activeFolder, setFolder] = useState(ALL);
  const [busyId, setBusyId]       = useState(null);  // per-asset action spinner

  const refresh = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('id, kind, url, filename, width, height, folder, created_at, meta')
        .eq('kind', kind)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      setAssets(data || []);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // Distinct folder names sorted alphabetically — built client-side so we
  // stay in sync with optimistic edits (create/rename/delete) without needing
  // a round-trip.
  const folders = useMemo(() => {
    const set = new Set();
    for (const a of assets) if (a.folder && a.folder.trim()) set.add(a.folder.trim());
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [assets]);

  const visibleAssets = useMemo(() => {
    if (activeFolder === ALL) return assets;
    if (activeFolder === UNSORTED) return assets.filter((a) => !a.folder);
    return assets.filter((a) => a.folder === activeFolder);
  }, [assets, activeFolder]);

  /** Create a new folder — just a local state flip; the folder "exists"
   *  as soon as an asset is moved into it. */
  const createFolder = () => {
    const name = window.prompt('New folder name:')?.trim();
    if (!name) return;
    if (name === UNSORTED || name === ALL) return;
    setFolder(name);
  };

  /** Move an asset to a folder (or null to un-sort it). */
  const moveAsset = async (asset) => {
    const choices = ['(unsorted)', ...folders, '+ New folder…'];
    const picked = window.prompt(
      `Move "${asset.filename || 'asset'}" to folder?\n\nType a folder name, or leave empty for unsorted.\nExisting: ${folders.length ? folders.join(', ') : '(none yet)'}`,
      asset.folder || '',
    );
    if (picked === null) return; // cancelled
    const next = picked.trim() || null;
    setBusyId(asset.id);
    try {
      const { error } = await supabase
        .from('assets')
        .update({ folder: next })
        .eq('id', asset.id);
      if (error) throw error;
      setAssets((list) => list.map((a) => (a.id === asset.id ? { ...a, folder: next } : a)));
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusyId(null);
    }
    // Silence unused `choices` — kept for potential future dropdown UI.
    void choices;
  };

  /** Hard-delete an asset from storage + DB via the delete-asset Edge Fn. */
  const deleteAsset = async (asset) => {
    const where = kind === 'image' ? 'Cloudinary' : 'Backblaze B2';
    if (!window.confirm(`Permanently delete "${asset.filename || 'this asset'}" from ${where} AND the library? This cannot be undone.`)) return;
    setBusyId(asset.id);
    try {
      const { data, error } = await supabase.functions.invoke('delete-asset', {
        body: { assetId: asset.id },
      });
      if (error) throw new Error(error.message || 'Delete failed');
      if (data?.error) throw new Error(data.error);
      setAssets((list) => list.filter((a) => a.id !== asset.id));
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        setErr(`Deleted with warnings: ${data.warnings.join(' | ')}`);
      }
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusyId(null);
    }
  };

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

          {/* Folder tabs ----------------------------------------------------- */}
          <div className="flex items-center gap-1.5 px-5 py-2 border-b border-white/10 overflow-x-auto pretty-scroll">
            <FolderChip active={activeFolder === ALL}      onClick={() => setFolder(ALL)}>All</FolderChip>
            <FolderChip active={activeFolder === UNSORTED} onClick={() => setFolder(UNSORTED)}>Unsorted</FolderChip>
            {folders.map((f) => (
              <FolderChip key={f} active={activeFolder === f} onClick={() => setFolder(f)}>{f}</FolderChip>
            ))}
            <button
              type="button"
              onClick={createFolder}
              className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/10 text-[11px] text-white/70 hover:text-white hover:border-white/40 whitespace-nowrap"
              title="Create a new folder"
            >
              <FolderPlus className="w-3 h-3" /> New folder
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pretty-scroll p-5">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-white/50 gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading…
              </div>
            ) : err ? (
              <p className="text-[12px] text-red-300/90 leading-snug">{err}</p>
            ) : visibleAssets.length === 0 ? (
              <div className="text-center py-16 text-white/50 text-[12px]">
                {assets.length === 0
                  ? `No ${kind}s uploaded yet. Drop files into the Asset library section to add some.`
                  : `No ${kind}s in this folder.`}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {visibleAssets.map((asset) => {
                  const selected = asset.url === value;
                  const busy     = busyId === asset.id;
                  return (
                    <div
                      key={asset.id}
                      className={[
                        'group relative rounded-md overflow-hidden bg-ink-950 ring-1 transition-all',
                        selected ? 'ring-2 ring-emerald-400' : 'ring-white/10 hover:ring-white/40',
                      ].join(' ')}
                      style={{ aspectRatio: kind === 'image' ? '4 / 3' : '16 / 9' }}
                    >
                      <button
                        type="button"
                        onClick={() => onPick(asset.url)}
                        className="absolute inset-0 text-left"
                        disabled={busy}
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
                      </button>

                      {/* Filename strip */}
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-2 py-1.5 bg-gradient-to-t from-ink-950/90 to-transparent">
                        <p className="text-[10px] text-white/85 truncate">
                          {asset.filename || asset.url.split('/').pop()}
                          {asset.folder && <span className="text-white/45"> · {asset.folder}</span>}
                        </p>
                      </div>

                      {/* Selected check */}
                      {selected && (
                        <div className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-emerald-400 text-ink-950 flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      )}

                      {/* Hover actions — top-right, above the click layer */}
                      <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveAsset(asset); }}
                          disabled={busy}
                          title="Move to folder"
                          className="w-7 h-7 rounded-full bg-ink-950/80 border border-white/15 text-white/80 hover:text-white flex items-center justify-center disabled:opacity-40"
                        >
                          <FolderInput className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); deleteAsset(asset); }}
                          disabled={busy}
                          title="Delete permanently"
                          className="w-7 h-7 rounded-full bg-ink-950/80 border border-red-400/30 text-red-200 hover:text-red-100 flex items-center justify-center disabled:opacity-40"
                        >
                          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <footer className="px-5 py-2.5 border-t border-white/10 text-[11px] text-white/40 flex items-center justify-between">
            <span>
              {visibleAssets.length} {kind}{visibleAssets.length === 1 ? '' : 's'}
              {activeFolder !== ALL && <> in <b className="text-white/65">{activeFolder === UNSORTED ? 'Unsorted' : activeFolder}</b></>}
            </span>
            <span className="text-white/30">Click to select · hover for actions</span>
          </footer>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function FolderChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'px-3 py-1 rounded-full text-[11px] whitespace-nowrap transition-colors border',
        active
          ? 'bg-white/90 text-ink-950 border-white/90'
          : 'bg-transparent text-white/70 border-white/10 hover:text-white hover:border-white/30',
      ].join(' ')}
    >
      {children}
    </button>
  );
}
