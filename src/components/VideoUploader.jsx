// ---------------------------------------------------------------------------
// VideoUploader — drag-and-drop uploader for large cinematography files.
//
// Pipeline:
//   1. Client asks the `get-b2-upload-url` Edge Function for a signed URL.
//   2. axios PUT/POSTs the file straight to Backblaze B2 with live progress.
//   3. On completion `onChange(publicUrl)` fires; the URL is served via the
//      user's Cloudflare CNAME for a clean cinematic playback.
// ---------------------------------------------------------------------------

import { useRef, useState } from 'react';
import { UploadCloud, Loader2, Check, AlertCircle, Film } from 'lucide-react';
import { uploadVideoToB2 } from '../lib/b2Upload';
import { supabase, hasSupabase } from '../lib/supabase';
import SmartVideo from './SmartVideo';
import AssetPicker from './AssetPicker';

/**
 * @param {object} props
 * @param {string} props.value       — current video URL (for preview)
 * @param {(url:string)=>void} props.onChange
 * @param {string} [props.label]
 * @param {boolean} [props.compact]
 */
export default function VideoUploader({
  value,
  onChange,
  label,
  compact = false,
}) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | uploading | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [fileMeta, setFileMeta] = useState(null); // { name, sizeMb }

  const pickFile = () => fileRef.current?.click();

  const handleFiles = async (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Not a video file.');
      setStatus('error');
      return;
    }
    setFileMeta({ name: file.name, sizeMb: (file.size / 1e6).toFixed(1) });
    setStatus('uploading');
    setProgress(0);
    setError('');
    try {
      const { url, filePath, bytes, contentType } = await uploadVideoToB2(file, (pct) =>
        setProgress(pct),
      );
      onChange?.(url);
      setStatus('done');
      if (hasSupabase) {
        try {
          await supabase.from('assets').insert({
            kind: 'video',
            url,
            filename: file.name,
            size_bytes: bytes,
            content_type: contentType,
            meta: { filePath },
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('[assets] log insert failed:', e?.message || e);
        }
      }
      setTimeout(() => setStatus('idle'), 2200);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[VideoUploader] upload failed:', err);
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
      <div className="flex items-center justify-between gap-2">
        <span className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-white/45`}>
          {label || ''}
        </span>
        <AssetPicker kind="video" value={value} onPick={onChange} compact={compact} />
      </div>

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
        style={{ aspectRatio: '16 / 9' }}
      >
        {value && !busy ? (
          <div className="absolute inset-0">
            <SmartVideo url={value} muted loop />
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/25">
            <Film className="w-7 h-7" />
          </div>
        )}

        <div
          className={[
            'absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4 transition-opacity',
            'bg-ink-950/75 backdrop-blur-sm',
            busy || dragOver || status !== 'idle' || !value
              ? 'opacity-100'
              : 'opacity-0 hover:opacity-100',
          ].join(' ')}
        >
          {status === 'uploading' ? (
            <>
              <Loader2 className="w-5 h-5 text-white animate-spin" />
              <span className="text-[11px] text-white/80">
                Uploading{fileMeta ? ` ${fileMeta.name} (${fileMeta.sizeMb} MB)` : '…'}
              </span>
              <div className="w-4/5 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-white transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] tabular-nums text-white/60">{progress}%</span>
            </>
          ) : status === 'done' ? (
            <>
              <Check className="w-5 h-5 text-emerald-300" />
              <span className="text-[11px] text-emerald-200">Uploaded to Backblaze</span>
            </>
          ) : status === 'error' ? (
            <>
              <AlertCircle className="w-5 h-5 text-red-300" />
              <span className="text-[11px] text-red-200 leading-tight max-w-[90%]">
                {error || 'Upload failed'}
              </span>
              <span className="text-[10px] text-white/50">Click to retry</span>
            </>
          ) : (
            <>
              <UploadCloud className="w-5 h-5 text-white/75" />
              <span className="text-[11px] text-white/75">
                {dragOver ? 'Drop to upload' : value ? 'Click or drop to replace' : 'Click or drop a video'}
              </span>
              <span className="text-[10px] text-white/45">
                MP4 / WebM — streams via Cloudflare
              </span>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}
