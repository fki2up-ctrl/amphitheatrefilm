// Universal embed resolver — given any source URL, returns the info the
// VideoModal needs to render the correct player.
//
//   { kind: 'youtube' | 'vimeo' | 'instagram' | 'unknown',
//     embedUrl: string,
//     aspect:   '16/9' | '9/16' | '1/1',   // best-fit player aspect
//     originalUrl: string }

export function resolveEmbed(url) {
  if (!url) return { kind: 'unknown', embedUrl: '', aspect: '16/9', originalUrl: url };

  // YouTube — youtu.be/<id>, youtube.com/watch?v=<id>, youtube.com/embed/<id>
  const yt = url.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  if (yt) {
    return {
      kind: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1`,
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

  return { kind: 'unknown', embedUrl: url, aspect: '16/9', originalUrl: url };
}
