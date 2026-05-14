// Universal embed resolver — given any source URL, returns the info the
// VideoModal needs to render the correct player.
//
//   { kind: 'youtube' | 'vimeo' | 'instagram' | 'unknown',
//     embedUrl: string,
//     aspect:   '16/9' | '9/16' | '1/1',   // best-fit player aspect
//     originalUrl: string }

export function resolveEmbed(url) {
  if (!url) return { kind: 'unknown', embedUrl: '', aspect: '16/9', originalUrl: url };

  // YouTube — handled by a dedicated parser because share links come in many
  // shapes (?si=… share links with v= reordered, m./music. subdomains,
  // /live/, /shorts/, /embed/, /v/, youtu.be/, query params in any order).
  const ytId = parseYouTubeId(url);
  if (ytId) {
    return {
      kind: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`,
      aspect: '16/9',
      originalUrl: url,
    };
  }

  // Vimeo — vimeo.com/<id>
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) {
    return {
      kind: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vm[1]}?autoplay=1&title=0&byline=0&portrait=0`,
      aspect: '16/9',
      originalUrl: url,
    };
  }

  // Instagram — posts (/p/<code>/), reels (/reel/<code>/ or /reels/<code>/)
  const ig = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  if (ig) {
    // Reels are vertical; posts can be either — 9/16 is a safer modal aspect.
    const isReel = /\/reels?\//.test(url);
    return {
      kind: 'instagram',
      embedUrl: `https://www.instagram.com/p/${ig[1]}/embed/?cr=1&v=14`,
      aspect: isReel ? '9/16' : '1/1',
      originalUrl: url,
    };
  }

  // Backblaze B2 direct video files — and any other direct .mp4 / .webm /
  // .mov / .m4v URL. These are served as raw files, not embed pages, so we
  // use a native <video> element (no iframe, no CSP frame-src issue).
  const isDirectVideo =
    /backblazeb2\.com/.test(url) ||
    /\.(?:mp4|webm|mov|m4v|ogg)(\?|#|$)/i.test(url);
  if (isDirectVideo) {
    return {
      kind: 'direct',
      embedUrl: url,
      aspect: '16/9',
      originalUrl: url,
    };
  }

  return { kind: 'unknown', embedUrl: url, aspect: '16/9', originalUrl: url };
}

/* ---------------------------------------------------------------------------
 * YouTube ID extraction.
 *
 * Handles every delivery shape we've seen in the wild:
 *   https://youtu.be/<id>[?si=…]
 *   https://www.youtube.com/watch?v=<id>      (v first)
 *   https://www.youtube.com/watch?si=…&v=<id> (share link, v later)
 *   https://m.youtube.com/watch?v=<id>
 *   https://music.youtube.com/watch?v=<id>
 *   https://www.youtube.com/embed/<id>
 *   https://www.youtube.com/shorts/<id>
 *   https://www.youtube.com/live/<id>
 *   https://www.youtube.com/v/<id>
 *   https://www.youtube-nocookie.com/embed/<id>
 *
 * Returns a canonical 11-char ID, or null for anything else.
 * ------------------------------------------------------------------------- */
const YT_ID_RE = /^[A-Za-z0-9_-]{11}$/;

export function parseYouTubeId(url) {
  // 1) Prefer URL parsing — handles any query-param order cleanly.
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');

    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || '';
      if (YT_ID_RE.test(id)) return id;
    }

    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && YT_ID_RE.test(v)) return v;

      const pathMatch = u.pathname.match(
        /^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/
      );
      if (pathMatch) return pathMatch[1];
    }
  } catch {
    /* not a parseable URL — fall through to regex fallback */
  }

  // 2) Regex fallback — catches protocol-less strings, odd wrappers, etc.
  const m = url.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?[^#]*?\bv=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}
