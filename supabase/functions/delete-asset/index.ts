// ---------------------------------------------------------------------------
// Supabase Edge Function: delete-asset
//
// Deletes an asset from the upstream storage provider (Cloudinary for images,
// Backblaze B2 for videos) AND removes the `assets` table row. Auth-gated
// via the caller's Supabase session.
//
// Deploy:
//   supabase functions deploy delete-asset --no-verify-jwt
//
// Secrets reused from get-b2-upload-url:
//   B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_S3_ENDPOINT, B2_S3_REGION
//
// New secrets required for Cloudinary image deletion (Admin API, server-only):
//   CLOUDINARY_CLOUD_NAME
//   CLOUDINARY_API_KEY
//   CLOUDINARY_API_SECRET
// ---------------------------------------------------------------------------

// @ts-nocheck — Deno runtime; Node-based IDE TS doesn't know `Deno` or URL imports.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.203.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.43.4';

/**
 * Fully purge every version of a single B2 object (including hide markers)
 * via the native B2 API. Using S3 DELETE on a versioned bucket only adds a
 * hide marker — which then lingers until the lifecycle rule catches up. This
 * helper hard-deletes everything immediately.
 */
async function purgeB2Versions(
  keyId: string,
  appKey: string,
  bucketName: string,
  fileName: string,
): Promise<number> {
  // 1. Authorize — returns an apiUrl + session token scoped to this key.
  const authRes = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: 'Basic ' + btoa(`${keyId}:${appKey}`) },
  });
  if (!authRes.ok) throw new Error(`b2_authorize_account ${authRes.status}: ${await authRes.text()}`);
  const authJson: any = await authRes.json();
  const apiUrl = authJson.apiInfo.storageApi.apiUrl as string;
  const token  = authJson.authorizationToken as string;
  let   bucketId = authJson.apiInfo.storageApi.allowed?.bucketId as string | undefined;

  // 2. If the key isn't bucket-scoped, resolve the bucketId by name.
  if (!bucketId) {
    const lbRes = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
      method:  'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ accountId: authJson.accountId, bucketName }),
    });
    if (!lbRes.ok) throw new Error(`b2_list_buckets ${lbRes.status}: ${await lbRes.text()}`);
    const lbJson: any = await lbRes.json();
    bucketId = lbJson.buckets?.[0]?.bucketId;
  }
  if (!bucketId) throw new Error(`B2 bucket "${bucketName}" not found.`);

  // 3. List every version of this exact filename.
  const lvRes = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, {
    method:  'POST',
    headers: { Authorization: token, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      bucketId,
      startFileName: fileName,
      prefix:        fileName,
      maxFileCount:  100,
    }),
  });
  if (!lvRes.ok) throw new Error(`b2_list_file_versions ${lvRes.status}: ${await lvRes.text()}`);
  const lvJson: any = await lvRes.json();
  const versions = (lvJson.files || []).filter((f: any) => f.fileName === fileName);

  // 4. Delete each version (including hide markers).
  for (const v of versions) {
    const dRes = await fetch(`${apiUrl}/b2api/v3/b2_delete_file_version`, {
      method:  'POST',
      headers: { Authorization: token, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ fileId: v.fileId, fileName: v.fileName }),
    });
    if (!dRes.ok) {
      throw new Error(`b2_delete_file_version ${dRes.status}: ${await dRes.text()}`);
    }
  }
  return versions.length;
}

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

/**
 * Extract a Cloudinary public_id from a delivery URL. Handles optional
 * transforms (e.g. `f_auto,q_auto,w_1200/`) and an optional version marker
 * (`v1234567/`). Returns an empty string when the URL isn't Cloudinary.
 */
function extractCloudinaryPublicId(url: string): string {
  const m = /\/upload\/(.*)$/.exec(url || '');
  if (!m) return '';
  let tail = m[1];
  // Strip transform segment (contains `_` pairs, no dots).
  const firstSlash = tail.indexOf('/');
  if (firstSlash !== -1) {
    const first = tail.slice(0, firstSlash);
    if (/[a-z]_[^,/]+/i.test(first) && !first.includes('.') && !/^v\d+$/.test(first)) {
      tail = tail.slice(firstSlash + 1);
    }
  }
  // Strip version marker.
  const m2 = /^v\d+\/(.*)$/.exec(tail);
  if (m2) tail = m2[1];
  // Strip extension.
  return tail.replace(/\.[^./]+$/, '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST')    return json({ error: 'Method not allowed' }, 405);

  // --- Auth: require a valid Supabase session. ----------------------------
  const supabaseUrl     = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const authHeader      = req.headers.get('Authorization') || '';
  const token           = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Missing Authorization bearer token.' }, 401);

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) {
    return json({ error: 'Invalid or expired session.' }, 401);
  }

  // --- Parse body ---------------------------------------------------------
  let body: { assetId?: string } = {};
  try { body = await req.json(); } catch { /* empty */ }
  const assetId = body.assetId;
  if (!assetId) return json({ error: 'assetId is required.' }, 400);

  // --- Fetch the asset row ------------------------------------------------
  const { data: asset, error: fetchErr } = await supabase
    .from('assets')
    .select('id, kind, url, meta')
    .eq('id', assetId)
    .single();
  if (fetchErr || !asset) return json({ error: 'Asset not found.' }, 404);

  const warnings: string[] = [];

  try {
    if (asset.kind === 'image') {
      // --- Delete from Cloudinary via Admin API (Basic auth) --------------
      const cloud     = Deno.env.get('CLOUDINARY_CLOUD_NAME');
      const apiKey    = Deno.env.get('CLOUDINARY_API_KEY');
      const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET');
      const publicId  = asset.meta?.publicId || extractCloudinaryPublicId(asset.url);

      if (!cloud || !apiKey || !apiSecret) {
        warnings.push('Cloudinary API secrets not set — DB row will be removed, but the file stays on Cloudinary.');
      } else if (!publicId) {
        warnings.push('Could not determine Cloudinary public_id from URL.');
      } else {
        const basic = btoa(`${apiKey}:${apiSecret}`);
        const url   = `https://api.cloudinary.com/v1_1/${cloud}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}`;
        const r     = await fetch(url, {
          method:  'DELETE',
          headers: { Authorization: `Basic ${basic}` },
        });
        if (!r.ok) {
          warnings.push(`Cloudinary delete failed (${r.status}): ${await r.text()}`);
        } else {
          const j = await r.json().catch(() => null) as any;
          const outcome = j?.deleted?.[publicId];
          if (outcome && outcome !== 'deleted') {
            warnings.push(`Cloudinary returned "${outcome}" for public_id ${publicId}.`);
          }
        }
      }
    } else if (asset.kind === 'video') {
      // --- Hard-delete every version of the B2 object via native B2 API.
      //     S3 DELETE would only write a hide marker on a versioned bucket;
      //     we want the bytes gone immediately.
      const keyId    = Deno.env.get('B2_KEY_ID');
      const appKey   = Deno.env.get('B2_APPLICATION_KEY');
      const bucket   = Deno.env.get('B2_BUCKET_NAME');
      const filePath = asset.meta?.filePath;

      if (!keyId || !appKey || !bucket) {
        warnings.push('B2 secrets not set — DB row will be removed, but the file stays on Backblaze.');
      } else if (!filePath) {
        warnings.push('Asset row has no filePath in meta — cannot locate the B2 object to delete.');
      } else {
        try {
          const n = await purgeB2Versions(keyId, appKey, bucket, filePath);
          if (n === 0) warnings.push(`B2: no versions found for ${filePath}.`);
        } catch (e) {
          warnings.push(`B2 purge failed: ${(e as Error).message}`);
        }
      }
    } else {
      warnings.push(`Unknown asset kind "${asset.kind}" — deleting DB row only.`);
    }

    // --- Cascade: null out any references to this URL in projects /
    //              site_settings so the Landing / Gallery don't break. -----
    const targetUrl = asset.url;
    if (targetUrl) {
      // projects.image and projects.url can both reference uploaded assets.
      const { error: pImgErr } = await supabase
        .from('projects')
        .update({ image: '' })
        .eq('image', targetUrl);
      if (pImgErr) warnings.push(`projects.image cleanup: ${pImgErr.message}`);

      const { error: pUrlErr } = await supabase
        .from('projects')
        .update({ url: '' })
        .eq('url', targetUrl);
      if (pUrlErr) warnings.push(`projects.url cleanup: ${pUrlErr.message}`);

      // site_settings.site_config is a JSONB blob holding the PROFILE object
      // (landingVideo, featuredVideo, favicon, featuredVideoPoster, etc).
      // Fetch, deep-clean every string value equal to the deleted URL, write back.
      const { data: ss, error: ssFetchErr } = await supabase
        .from('site_settings')
        .select('id, site_config')
        .limit(1)
        .maybeSingle();
      if (ssFetchErr) {
        warnings.push(`site_settings fetch: ${ssFetchErr.message}`);
      } else if (ss?.site_config) {
        const cleaned = JSON.parse(JSON.stringify(ss.site_config));
        let changed = false;
        const stripMatches = (obj: any) => {
          if (!obj || typeof obj !== 'object') return;
          for (const k of Object.keys(obj)) {
            const v = obj[k];
            if (typeof v === 'string' && v === targetUrl) {
              obj[k] = '';
              changed = true;
            } else if (v && typeof v === 'object') {
              stripMatches(v);
            }
          }
        };
        stripMatches(cleaned);
        if (changed) {
          const { error: ssUpdErr } = await supabase
            .from('site_settings')
            .update({ site_config: cleaned })
            .eq('id', ss.id);
          if (ssUpdErr) warnings.push(`site_settings update: ${ssUpdErr.message}`);
        }
      }
    }

    // --- Always remove the DB row (best-effort delete pattern) -----------
    const { error: delErr } = await supabase.from('assets').delete().eq('id', assetId);
    if (delErr) throw new Error(`DB delete failed: ${delErr.message}`);

    return json({ ok: true, warnings });
  } catch (e) {
    return json({ error: (e as Error).message, warnings }, 500);
  }
});
