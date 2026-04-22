// ---------------------------------------------------------------------------
// AssetManagerSection — the editor's top-level "Asset Library".
//
// Lists every asset uploaded through ImageUploader / VideoUploader (stored in
// the `assets` table in Supabase) and gives the editor a fast way to upload
// new files without having to hunt down the specific inline field first.
//
// Each row exposes:
//   • a live thumbnail (image) or inline SmartVideo player (video)
//   • copy-URL button
//   • delete button (removes the DB row only; the underlying B2/Cloudinary
//     asset stays so existing references don't break)
//
// The library grid itself accepts drag-and-drop to upload new files.
// ---------------------------------------------------------------------------

import { useContext, useEffect, useState } from 'react';
import { Copy, Check, Trash2, Loader2, UploadCloud, ImageIcon, Film, RefreshCw } from 'lucide-react';
import { supabase, hasSupabase } from '../lib/supabase';
import { uploadImageToCloudinary, hasCloudinary } from '../lib/cloudinaryUpload';
import { uploadVideoToB2 } from '../lib/b2Upload';
import SmartVideo from './SmartVideo';
import { SectionOpenContext } from './Editor';

// Mobile-only collapse wrapper. When embedded in the desktop master-detail
// pane (SectionOpenContext === true), renders children directly — the
// Editor's left menu already labels this section.
function Section({ title, hint, action, children }) {
  const forceOpen = useContext(SectionOpenContext);
  const [openState, setOpen] = useState(false);
  const open = forceOpen || openState;

  if (forceOpen) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-end gap-2">
          {action}
        </div>
        {hint && <p className="text-[11px] text-white/40">{hint}</p>}
        <div className="space-y-3">{children}</div>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-start gap-2 text-left group"
        >
          <span
            className={`mt-1 block w-1.5 h-1.5 rounded-full transition-colors ${
              open ? 'bg-white/80' : 'bg-white/30 group-hover:bg-white/60'
            }`}
          />
          <div>
            <h3 className="text-[11px] tracking-widest2 uppercase text-white/55 group-hover:text-white/85 transition-colors">
              {title}
            </h3>
            {hint && open && <p className="mt-1 text-[11px] text-white/40">{hint}</p>}
          </div>
        </button>
        {open && action}
      </div>
      {open && <div className="space-y-3">{children}</div>}
    </section>
  );
}

export default function AssetManagerSection() {
  const [assets, setAssets]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');
  const [uploading, setUploading] = useState(null); // { kind, name, progress } | null
  const [uploadErr, setUploadErr] = useState('');
  const [dragOver, setDragOver]   = useState(false);
  const [copiedId, setCopiedId]   = useState(null);

  const refresh = async () => {
    if (!hasSupabase) return;
    setLoading(true);
    setErr('');
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('id, kind, url, filename, size_bytes, content_type, created_at')
        .order('created_at', { ascending: false })
        .limit(120);
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
  }, []);

  const upload = async (file) => {
    if (!file) return;
    setUploadErr('');
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    if (!isImage && !isVideo) {
      setUploadErr('Only image or video files are supported.');
      return;
    }
    setUploading({ kind: isImage ? 'image' : 'video', name: file.name, progress: 0 });
    try {
      let row;
      if (isImage) {
        const { url, publicId, bytes, width, height, format } = await uploadImageToCloudinary(
          file,
          (p) => setUploading((u) => u && { ...u, progress: p }),
        );
        row = {
          kind:         'image',
          url,
          filename:     file.name,
          size_bytes:   bytes,
          content_type: file.type,
          width,
          height,
          meta:         { format, publicId },
        };
      } else {
        const { url, filePath, bytes, contentType } = await uploadVideoToB2(
          file,
          (p) => setUploading((u) => u && { ...u, progress: p }),
        );
        row = {
          kind:         'video',
          url,
          filename:     file.name,
          size_bytes:   bytes,
          content_type: contentType,
          meta:         { filePath },
        };
      }
      // Log to the `assets` table so the row shows up in the library grid
      // and can later be deleted by the delete-asset Edge Function.
      if (hasSupabase) {
        const { error: insErr } = await supabase.from('assets').insert(row);
        if (insErr) throw insErr;
      }
      setUploading(null);
      await refresh();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[AssetManager] upload failed:', e);
      setUploadErr(e.message || String(e));
      setUploading(null);
    }
  };

  // Library-level drop — uploads files directly into the library.
  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    // Sequential uploads — parallel would starve B2's single-file upload URL.
    (async () => {
      for (const f of files) {
        // eslint-disable-next-line no-await-in-loop
        await upload(f);
      }
    })();
  };

  const copyUrl = async (asset) => {
    try {
      await navigator.clipboard.writeText(asset.url);
      setCopiedId(asset.id);
      setTimeout(() => setCopiedId((id) => (id === asset.id ? null : id)), 1400);
    } catch { /* ignore */ }
  };

  const removeAsset = async (asset) => {
    const where = asset.kind === 'image' ? 'Cloudinary' : 'Backblaze B2';
    if (!window.confirm(`Permanently delete "${asset.filename || 'this asset'}" from ${where} AND the library? This cannot be undone.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('delete-asset', {
        body: { assetId: asset.id },
      });
      if (error) throw new Error(error.message || 'Delete failed');
      if (data?.error) throw new Error(data.error);
      setAssets((list) => list.filter((a) => a.id !== asset.id));
      if (Array.isArray(data?.warnings) && data.warnings.length) {
        // Surface storage-delete warnings without blocking the UI update.
        setErr(`Removed from library. Warning: ${data.warnings.join(' | ')}`);
      } else {
        setErr('');
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[AssetManager] delete failed:', e);
      setErr(e.message || String(e));
    }
  };

  return (
    <Section
      title="Asset library"
      hint="Drag images or videos here to upload. Images go to Cloudinary, videos to Backblaze B2 via Cloudflare."
      action={
        <button
          type="button"
          onClick={refresh}
          disabled={loading || !hasSupabase}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-white/10 text-[11px] text-white/70 hover:text-white hover:border-white/40 disabled:opacity-40"
          title="Refresh list"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
        </button>
      }
    >
      {/* --- Dropzone ---------------------------------------------------- */}
      <label
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          'relative flex flex-col items-center justify-center gap-2 py-6 rounded-lg border border-dashed cursor-pointer transition-all',
          dragOver
            ? 'border-emerald-400/80 bg-emerald-400/5'
            : 'border-white/15 hover:border-white/40 bg-ink-900/50',
        ].join(' ')}
      >
        <input
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            (async () => {
              for (const f of files) {
                // eslint-disable-next-line no-await-in-loop
                await upload(f);
              }
            })();
            e.target.value = '';
          }}
        />
        {uploading ? (
          <>
            <Loader2 className="w-5 h-5 text-white animate-spin" />
            <span className="text-[11px] text-white/80 text-center max-w-[80%] truncate">
              Uploading {uploading.name} ({uploading.kind})
            </span>
            <div className="w-3/4 h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full bg-white transition-all"
                style={{ width: `${uploading.progress}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-white/60">{uploading.progress}%</span>
          </>
        ) : (
          <>
            <UploadCloud className="w-5 h-5 text-white/60" />
            <span className="text-[11px] text-white/70">
              {dragOver ? 'Drop files to upload' : 'Click or drop files here'}
            </span>
            <span className="text-[10px] text-white/40">Images → Cloudinary · Videos → Backblaze</span>
            {(!hasCloudinary || !hasSupabase) && (
              <span className="text-[10px] text-amber-300/85 text-center max-w-[88%] leading-snug">
                {!hasCloudinary && 'Cloudinary env missing. '}
                {!hasSupabase && 'Supabase env missing.'}
              </span>
            )}
          </>
        )}
      </label>

      {uploadErr && (
        <p className="text-[11px] text-red-300/90 leading-snug">{uploadErr}</p>
      )}
      {err && <p className="text-[11px] text-red-300/90 leading-snug">{err}</p>}

      {/* --- Grid of uploaded assets ------------------------------------ */}
      {assets.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="group relative rounded-md overflow-hidden bg-ink-900 ring-1 ring-white/10"
              style={{ aspectRatio: '16 / 10' }}
            >
              {asset.kind === 'image' ? (
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
                <p className="text-[10px] text-white/75 truncate flex items-center gap-1">
                  {asset.kind === 'image' ? <ImageIcon className="w-3 h-3" /> : <Film className="w-3 h-3" />}
                  {asset.filename || asset.url.split('/').pop()}
                </p>
              </div>

              <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); copyUrl(asset); }}
                  title="Copy URL"
                  className="w-7 h-7 rounded-full bg-ink-950/80 border border-white/15 text-white/80 hover:text-white flex items-center justify-center"
                >
                  {copiedId === asset.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removeAsset(asset); }}
                  title="Remove from library"
                  className="w-7 h-7 rounded-full bg-ink-950/80 border border-red-400/30 text-red-200 hover:text-red-100 flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && assets.length === 0 && !uploading && (
        <p className="text-[11px] text-white/40">
          No assets yet. Uploads made from any inline field will show up here.
        </p>
      )}
    </Section>
  );
}
