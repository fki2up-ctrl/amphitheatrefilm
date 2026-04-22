// ---------------------------------------------------------------------------
// Supabase Edge Function: get-b2-upload-url
//
// Authenticates the caller with Supabase Auth, then mints a **presigned S3
// PUT URL** for Backblaze B2's S3-compatible API. Using S3 presigning (instead
// of B2's native b2_upload_file) is critical for browser uploads: S3 endpoints
// respect CORS preflight without requiring auth on OPTIONS. B2's native upload
// endpoint returns 401 on OPTIONS, which breaks every modern browser.
//
// Deploy:
//   supabase functions deploy get-b2-upload-url --no-verify-jwt
//
// Required secrets (set via `supabase secrets set KEY=value`):
//   B2_KEY_ID            — B2 Application Key ID (S3-compatible = accessKeyId)
//   B2_APPLICATION_KEY   — matching application key (S3-compatible = secretAccessKey)
//   B2_BUCKET_NAME       — the target bucket's name
//   B2_S3_ENDPOINT       — S3 endpoint, e.g. https://s3.us-east-005.backblazeb2.com
//   B2_S3_REGION         — S3 region matching the endpoint, e.g. us-east-005
//   B2_PUBLIC_BASE_URL   — optional, e.g. https://video.example.com
//   B2_FILE_PREFIX       — optional, e.g. "videos/" or empty for bucket root
// ---------------------------------------------------------------------------

// @ts-nocheck — Deno runtime; Node-based IDE TS doesn't know `Deno` or URL imports.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';

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
  const keyId       = Deno.env.get('B2_KEY_ID');
  const appKey      = Deno.env.get('B2_APPLICATION_KEY');
  const bucketName  = Deno.env.get('B2_BUCKET_NAME');
  const s3Endpoint  = Deno.env.get('B2_S3_ENDPOINT');     // e.g. https://s3.us-east-005.backblazeb2.com
  const s3Region    = Deno.env.get('B2_S3_REGION');       // e.g. us-east-005
  const publicBase  = Deno.env.get('B2_PUBLIC_BASE_URL'); // optional
  const prefix      = Deno.env.get('B2_FILE_PREFIX') || '';

  if (!keyId || !appKey || !bucketName || !s3Endpoint || !s3Region) {
    return json(
      { error: 'Server missing B2 S3 secrets (B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_S3_ENDPOINT, B2_S3_REGION).' },
      500,
    );
  }

  // Stamp uploads so concurrent uploads don't collide on duplicate names.
  const safePrefix = prefix ? prefix.replace(/\/+$/, '') + '/' : '';
  const stamp      = Date.now();
  const filePath   = `${safePrefix}${stamp}-${rawName}`;

  try {
    // --- Build a presigned S3 PUT URL (valid for 10 minutes) -----------
    // aws4fetch signs the query string so the browser never has to attach
    // any AWS/B2 credentials — it just PUTs the file body to the URL.
    const aws = new AwsClient({
      accessKeyId:     keyId,
      secretAccessKey: appKey,
      service:         's3',
      region:          s3Region,
    });

    // S3 object URL shape: {endpoint}/{bucket}/{key}
    const cleanEndpoint = s3Endpoint.replace(/\/+$/, '');
    const objectUrl = `${cleanEndpoint}/${bucketName}/${encodeURI(filePath)}?X-Amz-Expires=600`;

    const signed = await aws.sign(
      new Request(objectUrl, {
        method:  'PUT',
        headers: { 'Content-Type': contentType },
      }),
      { aws: { signQuery: true } },
    );

    const publicUrl = publicBase
      ? `${publicBase.replace(/\/+$/, '')}/${filePath}`
      : `${cleanEndpoint}/${bucketName}/${filePath}`;

    return json({
      uploadUrl:   signed.url,   // client does: axios.put(uploadUrl, file, { headers: { 'Content-Type': contentType } })
      filePath,
      publicUrl,
      contentType,
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
