// ---------------------------------------------------------------------------
// ImageUploader — minimalist drag-and-drop image upload widget.
//
// Uploads straight to Cloudinary via the unsigned preset and calls
// `onChange(secureUrl)` when done. Designed to sit next to a URL input field
// in the Editor; if `hideUrl` is true it renders just the dropzone.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { UploadCloud, Loader2, Check, AlertCircle, ImageIcon } from 'lucide-react';
import { uploadImageToCloudinary, hasCloudinary } from '../lib/cloudinaryUpload';
import { supabase, hasSupabase } from '../lib/supabase';

/**
 * @param {object} props
 * @param {string} props.value           — current URL (for preview)
 * @param {(url:string)=>void} props.onChange  — called with secure_url after upload
 * @param {string} [props.label]         — optional label above the dropzone
 * @param {boolean} [props.compact]      — tighter spacing
 * @param {string} [props.aspect]        — CSS aspect-ratio for the preview tile
 */
export default function ImageUploader({
  value,
  onChange,
  label,
  compact = false,
  aspect = '16 / 10',
}) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const pickFile = () => fileRef.current?.click();

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Not an image file.');
      setStatus('error');
      return;
    }
    setStatus('uploading');
    setProgress(0);
    setError('');
    try {
      const { url, bytes, width, height, format } = await uploadImageToCloudinary(
        file,
        (pct) => setProgress(pct),
      );
      onChange?.(url);
      setStatus('done');
      // Best-effort log to the assets library — ignore failures so the
      // primary upload flow never regresses because of a DB hiccup.
      if (hasSupabase) {
        try {
          await supabase.from('assets').insert({
            kind: 'image',
            url,
            filename: file.name,
            size_bytes: bytes,
            content_type: file.type,
            width,
            height,
            meta: { format },
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[assets] log insert failed:', e?.message || e);
        }
      }
      setTimeout(() => setStatus('idle'), 1800);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[ImageUploader] upload failed:', err);
      setError(err.message || String(err));
      setStatus('error');
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragOver(true); };
  const onDragLeave = () => setDragOver(false);

  const busy = status === 'uploading';

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {label && (
        <span className={`block ${compact ? 'text-[10px]' : 'text-[11px]'} text-white/45`}>
          {label}
        </span>
      )}

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={!busy ? pickFile : undefined}
        role="button"
        tabIndex={0}
        className={[
          'relative rounded-lg overflow-hidden cursor-pointer transition-all',
          'bg-ink-900/60 border border-dashed',
          dragOver
            ? 'border-emerald-400/80 bg-emerald-400/5'
            : status === 'error'
              ? 'border-red-400/50'
              : status === 'done'
                ? 'border-emerald-400/50'
                : 'border-white/15 hover:border-white/40',
        ].join(' ')}
        style={{ aspectRatio: aspect }}
      >
        {value ? (
          <img
            src={value}
            alt="preview"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/25">
            <ImageIcon className="w-6 h-6" />
          </div>
        )}

        {/* Overlay: hover / drag / progress / status */}
        <div
          className={[
            'absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4 transition-opacity',
            'bg-ink-950/70 backdrop-blur-sm',
            busy || dragOver || status !== 'idle' || !value
              ? 'opacity-100'
              : 'opacity-0 hover:opacity-100',
          ].join(' ')}
        >
          {status === 'uploading' ? (
            <>
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span className="text-[11px] text-white/75">Uploading… {progress}%</span>
              <div className="w-3/4 h-1 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </>
          ) : status === 'done' ? (
            <>
              <Check className="w-5 h-5 text-emerald-300" />
              <span className="text-[11px] text-emerald-200">Uploaded</span>
            </>
          ) : status === 'error' ? (
            <>
              <AlertCircle className="w-5 h-5 text-red-300" />
              <span className="text-[11px] text-red-200 leading-tight">
                {error || 'Upload failed'}
              </span>
              <span className="text-[10px] text-white/50">Click to retry</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5 text-white/75" />
              <span className="text-[11px] text-white/75">
                {dragOver ? 'Drop to upload' : value ? 'Click or drop to replace' : 'Click or drop an image'}
              </span>
              {!hasCloudinary && (
                <span className="text-[10px] text-amber-300/85 leading-tight">
                  Cloudinary not configured — set VITE_CLOUDINARY_CLOUD_NAME &amp; VITE_CLOUDINARY_UPLOAD_PRESET.
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
