/* ============================================================================
   🎬  AMPHITHEATRE FILM — CONTENT
   ============================================================================
   Maintained by the in-browser Editor (click the pencil in the sidebar).
   You can also hand-edit the sections below; the Editor picks up changes on
   the next reload. Don't touch the helpers / legacy exports near the bottom.
   ============================================================================ */


/* ── 1. PROFILE ──────────────────────────────────────────────────────────── */

export const PROFILE = {
  photo:               "/profile.jpg",
  photoPosition:       "50% 50%",
  mobilePhotoHeight:   112,
  name:                "Film Natthawut",
  role:                "Director / Cinematographer",
  tagline:             "I wish to be a light painter",
  taglineEmphasis:     "light painter",
  introTagline:        "I wish to be a light painter",
  introTaglineScale:   1,
  introTaglineTracking:"0.01em",
  introName:           "",
  introNameScale:      1,
  introNameTracking:   "0.005em",
  allLabel:            "All",
  siteTitle:           "Film Natthawut - Portfolio",
  siteDescription:     "",
  favicon:             "/icons/favicon-32.png",
  landingVideo:        "https://video.amphitheatrefilm.com/1776880775118-amphitheatrefilm-Showreel-2024.mp4",
  featuredVideo:       "",
  featuredVideoTitle:  "",
  featuredVideoPoster: "",
};


/* ── 2. CONTACT ──────────────────────────────────────────────────────────── */

export const CONTACT = {
  email:     "natthawut.niyomrot@gmail.com",
  instagram: "https://www.instagram.com/apttfilm/",
  facebook:  "https://www.facebook.com/FILMKI2UP",
  linktree:  "https://linktr.ee/amphitheatrefilm",
};


/* ── 3. BACKGROUND ───────────────────────────────────────────────────────── */

export const BACKGROUND = {
  color:   "#000000",
  image:   null,
  overlay: "rgba(5,5,7,0.7)",
};


/* ── 4. TOPICS & PROJECTS ────────────────────────────────────────────────── */

export const TOPICS = [

  topic("Short Commercials", [
    project({
      title:    "Emporio Armani — Power Of You",
      subtitle: "ft. Namtan Tipnaree",
      url:      "https://www.instagram.com/p/DWoLO3_DLvt",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776525527/Screenshot_2569-04-18_at_22.16.17_jlwlsk.png",
      imagePosition: "54% 63%",
    }),
    project({
      title:    "GATSBY CrazyCool",
      subtitle: "ft. Top Todsapol",
      url:      "https://www.instagram.com/p/DWYq0DgDRAM",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776525692/Screenshot_2569-04-18_at_22.21.11_trg8ie.png",
      imagePosition: "48% 17%",
    }),
    project({
      title:    "Emporio Armani — Stronger With You",
      subtitle: "ft. Jeff Satur",
      url:      "https://www.instagram.com/p/DJY6UTVy58v",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776527944/Screenshot_2569-04-18_at_22.48.49_zxadwl.png",
      imagePosition: "75% 52%",
    }),
    project({
      title:    "Bifesta",
      subtitle: "ft. Nene Pornnappan",
      url:      "https://www.instagram.com/p/DQ9Hq-mAthv",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776527992/Screenshot_2569-04-18_at_22.54.53_hkqdzs.png",
      imagePosition: "50% 26%",
    }),
    project({
      title:    "Bvlgari",
      url:      "https://video.amphitheatrefilm.com/1778745743723-D4_4K_FF_260426.mp4",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/v1778746779/Screenshot_2569-05-14_at_15.18.03_mlsluu.png",
      imagePosition: "49% 84%",
    }),
  ]),

  topic("MV, Live Session & Short Films", [
    project({
      title:    "JACKIE JACKRIN THE FIRST QUARTER",
      subtitle: "25th BIRTHDAY PARTY",
      url:      "https://www.youtube.com/watch?v=Gzspn8-1QmY",
    }),
    project({
      title:    "เติมเธอ (Fill My Heart) — KRIST",
      subtitle: "2nd DOP · Live Session",
      url:      "https://youtu.be/TQi8-llNlVA",
    }),
    project({
      title:    "ด้านชา (NUMB) — KRIST × PERTH",
      subtitle: "2nd DOP · Live Session",
      url:      "https://youtu.be/dnUlktGlRTM",
    }),
    project({
      title:    "รักเอย (Who Are U?) — JACKIE JACKRIN",
      subtitle: "Music Video",
      url:      "https://www.youtube.com/watch?v=jy7JH1ZWTyE",
    }),
    project({
      title:    "Top Secret Mission",
      subtitle: "Mission Impossibamm Concert",
      url:      "https://www.youtube.com/watch?v=KngMs8qbGIo",
    }),
    project({
      title:    "Fly To The Moon Festival 23/24",
      subtitle: "Aftermovie",
      url:      "https://www.youtube.com/watch?v=9smuS4nlZj4",
      imagePosition: "50% 54%",
    }),
    project({
      title:    "Fly To The Moon Festival 2021",
      subtitle: "Aftermovie",
      url:      "https://www.youtube.com/watch?v=1ZK4zGoFA_4",
    }),
    project({
      title:    "The Melting Faith",
      subtitle: "Young Thai Artist Award 2022",
      url:      "https://www.youtube.com/watch?v=nnLjS8lcY80",
    }),
  ]),

  topic("Fashion Film", [
    project({
      title:    "Louis Vuitton — Fall/Summer 2025",
      subtitle: "/w BamBam",
      url:      "https://www.instagram.com/reel/DGx4WxHz_dH/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528821/Screenshot_2569-04-18_at_23.08.41_ujcpei.png",
      imagePosition: "53% 63%",
    }),
    project({
      title:    "Gucci — La Famiglia",
      subtitle: "/w Janeyae & Billkin",
      url:      "https://www.instagram.com/reel/DUcNqBGk1BG",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528797/Screenshot_2569-04-18_at_23.03.17_dnyerk.png",
    }),
    project({
      title:    "Chaumet",
      subtitle: "ft. Bow Maylada",
      url:      "https://www.instagram.com/p/DR01-qYE24E",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776526199/Screenshot_2569-04-18_at_22.29.40_hseyvn.png",
      imagePosition: "51% 44%",
    }),
    project({
      title:    "Bottega Veneta — Summer 2025",
      subtitle: "ft. Thanaerng Kanyawee",
      url:      "https://www.instagram.com/reel/DScU0v1Ewfx",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776525167/Screenshot_2569-04-18_at_22.12.09_juoizn.png",
      imagePosition: "51% 18%",
    }),
    project({
      title:    "Gucci — Fall/Winter 2025",
      subtitle: "/w Jay Park",
      url:      "https://www.instagram.com/reel/DOAcN-uEzAx",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528054/Screenshot_2569-04-18_at_22.58.06_rgdkys.png",
      imagePosition: "50% 15%",
    }),
    project({
      title:    "Onitsuka Tiger — October 25",
      subtitle: "/w Baifern & Gulf",
      url:      "https://www.instagram.com/reel/DQDjBWsE1ol/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776526466/Screenshot_2569-04-18_at_22.34.02_giwwg0.png",
      imagePosition: "50% 52%",
    }),
    project({
      title:    "Tiffany & Co.",
      subtitle: "/w Metawin",
      url:      "https://www.instagram.com/reel/DDOCkuEzjXv/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528900/Screenshot_2569-04-18_at_23.12.42_ojrj2c.png",
      imagePosition: "54% 10%",
    }),
    project({
      title:    "ASICS — Fall/Winter 25",
      subtitle: "/w Sky Wongravee",
      url:      "https://www.instagram.com/reel/DPBdM_tk6Nc/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776526848/Screenshot_2569-04-18_at_22.40.20_tnt8zv.png",
      imagePosition: "51% 18%",
    }),
    project({
      title:    "Mikimoto — High Jewelry",
      subtitle: "/w Jarinporn",
      url:      "https://www.instagram.com/reel/DBSxCMjTlSu/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528876/Screenshot_2569-04-18_at_23.11.42_jv1vm0.png",
      imagePosition: "53% 82%",
    }),
    project({
      title:    "Balenciaga — Fall Collection 2025",
      subtitle: "/w PP Krit",
      url:      "https://www.instagram.com/reel/DKhEQDbzYfD/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776527991/Screenshot_2569-04-18_at_22.54.22_fizd0d.png",
      imagePosition: "48% 15%",
    }),
    project({
      title:    "Dior — Cruise 2025",
      subtitle: "/w Kimberley",
      url:      "https://www.instagram.com/reel/DDLyVpbTNFP/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528856/Screenshot_2569-04-18_at_23.09.10_bnfle3.png",
      imagePosition: "58% 100%",
    }),
    project({
      title:    "OMEGA Seamaster",
      subtitle: "ft. Jame Jirayu",
      url:      "https://www.instagram.com/p/DRYhKyaEzll",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776526350/Screenshot_2569-04-18_at_22.31.45_dx6mdq.png",
      imagePosition: "50% 43%",
    }),
    project({
      title:    "Seiko Diver's Watch 60th Anniversary",
      subtitle: "/w Jee Sutthirak",
      url:      "https://www.instagram.com/reel/DKhFklszx_6/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528801/Screenshot_2569-04-18_at_23.06.57_pz6i0t.png",
      imagePosition: "48% 3%",
    }),
    project({
      title:    "Saint Laurent — Fashion Video",
      subtitle: "/w Pemmwasu",
      url:      "https://www.instagram.com/reels/DIBa9H0TuoA",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776527948/Screenshot_2569-04-18_at_22.53.40_hicebi.png",
      imagePosition: "72% 56%",
    }),
    project({
      title:    "Bvlgari",
      subtitle: "/w Mile Pakpoom",
      url:      "https://www.instagram.com/reel/DFopCQZhHE6/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776527940/Screenshot_2569-04-18_at_22.46.17_rugktf.png",
      imagePosition: "54% 41%",
    }),
  ]),

  topic("Online Content", [
    project({
      title:    "Volvo ES90 × Esquire Thailand",
      subtitle: "Brand Content",
      url:      "https://www.instagram.com/reel/DW0IldDhC02",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776514759/EsqVolvoES90_h3okwn.png",
      imagePosition: "50% 53%",
    }),
    project({
      title:    "Plantae — แห่ Run หมาก",
      subtitle: "Cinematographer",
      url:      "https://www.instagram.com/p/DUfxPFHEtLp",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776521480/Screenshot_2569-04-18_at_21.09.52_opjhq3.png",
      imagePosition: "51% 55%",
    }),
    project({
      title:    "BLEU DE CHANEL — L’EXCLUSIF",
      subtitle: "APEC Interview",
      url:      "https://www.instagram.com/reel/DN5eWJwE1Gb",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776526676/Screenshot_2569-04-18_at_22.37.29_gvhdz5.png",
      imagePosition: "50% 57%",
    }),
    project({
      title:    "ONE's Perfect Pair",
      subtitle: "/w Jamy James at One Bangkok",
      url:      "https://www.instagram.com/reel/DKPC7R-zKah/",
      image:    "https://res.cloudinary.com/dhva8jxvn/image/upload/f_auto,q_auto/v1776528038/Screenshot_2569-04-18_at_22.56.55_by6fgt.png",
      imagePosition: "49% 46%",
    }),
  ]),

];


/* ══════════════════════════════════════════════════════════════════════════
   Helpers & legacy exports — do not edit by hand.
   ══════════════════════════════════════════════════════════════════════════ */

function topic(label, items) {
  const id = slug(label);
  return {
    id,
    label,
    projects: items.map((p, i) => ({ ...p, id: `${id}-${i + 1}` })),
  };
}

function project({ title, subtitle = '', url, image = '', imagePosition = '50% 50%' }) {
  return {
    title,
    subtitle,
    url,
    thumbnail: image || autoThumbnail(url),
    imagePosition,
  };
}

function autoThumbnail(url) {
  const id = parseYouTubeId(String(url || ''));
  if (id) return `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;
  return 'https://images.unsplash.com/photo-1485846234645-a62644f84728?q=80&w=1600&auto=format&fit=crop';
}

// Robust YouTube ID extraction — handles share links with params in any order,
// mobile/music subdomains, and the /embed/, /shorts/, /live/, /v/ path forms.
function parseYouTubeId(url) {
  const ID_RE = /^[A-Za-z0-9_-]{11}$/;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0] || '';
      if (ID_RE.test(id)) return id;
    }
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v');
      if (v && ID_RE.test(v)) return v;
      const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
      if (m) return m[1];
    }
  } catch { /* fall through */ }
  const m = url.match(
    /(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?[^#]*?\bv=|embed\/|shorts\/|live\/|v\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'topic';
}

export const BRAND = {
  name:    PROFILE.name,
  role:    PROFILE.role,
  tagline: PROFILE.tagline,
  email:   CONTACT.email,
  socials: {
    instagram: CONTACT.instagram,
    facebook:  CONTACT.facebook,
    linktree:  CONTACT.linktree,
  },
};

export const SITE_ASSETS = {
  headerImage: PROFILE.photo,
  headerImageShape: 'square',
  background: BACKGROUND,
};

export const CATEGORIES = TOPICS;

export const ALL_PROJECTS = CATEGORIES.flatMap((c) =>
  c.projects.map((p) => ({ ...p, categoryId: c.id, categoryLabel: c.label }))
);
