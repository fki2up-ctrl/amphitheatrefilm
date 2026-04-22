// ---------------------------------------------------------------------------
// Supabase Edge Function: get-b2-upload-url
//
// Authenticates the caller with Supabase Auth, then talks to Backblaze B2 to
// mint a one-shot upload URL + authorization token. Keeps the B2 master
// credentials server-side (never exposed to the browser).
//
// Deploy:
//   supabase functions deploy get-b2-upload-url --no-verify-jwt
//
// Required secrets (set via `supabase secrets set KEY=value`):
//   B2_KEY_ID            — B2 Application Key ID (with write on the bucket)
//   B2_APPLICATION_KEY   — matching application key secret
//   B2_BUCKET_ID         — the target bucket's ID
//   B2_BUCKET_NAME       — the target bucket's name (used when no base URL is set)
//   B2_PUBLIC_BASE_URL   — optional, e.g. https://video.example.com
//                           (Cloudflare CNAME with a Transform Rule that
//                            rewrites `/` → `/file/<bucket>/`)
//   B2_FILE_PREFIX       — optional, e.g. "videos/" or empty for bucket root
// ---------------------------------------------------------------------------

// @ts-nocheck — Deno runtime; Node-based IDE TS doesn't know `Deno` or URL imports.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function authorizeB2(keyId: string, appKey: string) {
  const creds = btoa(`${keyId}:${appKey}`);
  const r = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!r.ok) throw new Error(`b2_authorize_account ${r.status}: ${await r.text()}`);
  return r.json() as Promise<any>;
}

async function getUploadUrl(apiUrl: string, authToken: string, bucketId: string) {
  const r = await fetch(`${apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: 'POST',
    headers: { Authorization: authToken, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId }),
  });
  if (!r.ok) throw new Error(`b2_get_upload_url ${r.status}: ${await r.text()}`);
  return r.json() as Promise<{ uploadUrl: string; authorizationToken: string }>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  // ------------------------------------------------------------------
  // Auth — require a valid Supabase session.
  // ------------------------------------------------------------------
  const supabaseUrl      = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey  = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader       = req.headers.get('Authorization') || '';
  const token            = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return json({ error: 'Invalid or expired session.' }, 401);
    }
  } catch (e) {
    return json({ error: `Auth check failed: ${(e as Error).message}` }, 401);
  }

  // ------------------------------------------------------------------
  // Parse request body.
  // ------------------------------------------------------------------
  let body: { fileName?: string; contentType?: string } = {};
  try { body = await req.json(); } catch { /* empty body is fine */ }

  const rawName     = (body.fileName || `upload-${Date.now()}.mp4`).replace(/^\/+/, '');
  const contentType = body.contentType || 'video/mp4';

  // ------------------------------------------------------------------
  // Read B2 secrets & build the final file path.
  // ------------------------------------------------------------------
  const keyId      = Deno.env.get('B2_KEY_ID');
  const appKey     = Deno.env.get('B2_APPLICATION_KEY');
  const bucketId   = Deno.env.get('B2_BUCKET_ID');
  const bucketName = Deno.env.get('B2_BUCKET_NAME');
  const publicBase = Deno.env.get('B2_PUBLIC_BASE_URL');       // optional
  const prefix     = Deno.env.get('B2_FILE_PREFIX') || '';     // optional

  if (!keyId || !appKey || !bucketId || !bucketName) {
    return json(
      { error: 'Server missing B2 secrets (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_ID, B2_BUCKET_NAME).' },
      500,
    );
  }

  // Stamp uploads so concurrent uploads don't collide on duplicate names.
  const safePrefix = prefix ? prefix.replace(/\/+$/, '') + '/' : '';
  const stamp      = Date.now();
  const filePath   = `${safePrefix}${stamp}-${rawName}`;

  try {
    const auth     = await authorizeB2(keyId, appKey);
    // B2 v3 returns apiInfo.storageApi.apiUrl — older SDKs had it flat. Support both.
    const apiUrl   = auth.apiInfo?.storageApi?.apiUrl || auth.apiUrl;
    const authTok  = auth.authorizationToken;
    const upload   = await getUploadUrl(apiUrl, authTok, bucketId);

    // Public URL — prefer the user's Cloudflare CNAME (clean, branded, cached).
    // Fall back to the raw B2 f000/file URL so dev still works before DNS is set.
    const downloadUrl = auth.apiInfo?.storageApi?.downloadUrl || auth.downloadUrl;
    const publicUrl = publicBase
      ? `${publicBase.replace(/\/+$/, '')}/${filePath}`
      : `${downloadUrl}/file/${bucketName}/${filePath}`;

    return json({
      uploadUrl:          upload.uploadUrl,
      authorizationToken: upload.authorizationToken,
      filePath,
      publicUrl,
      contentType,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
