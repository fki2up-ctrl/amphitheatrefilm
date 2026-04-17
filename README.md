# Amphitheatre Film

A cinematic, dark-themed portfolio for **Amphitheatre Film**, inspired by [linktr.ee/amphitheatrefilm](https://linktr.ee/amphitheatrefilm).

## Stack
- **Vite + React 18**
- **Tailwind CSS** (custom `ink` palette, Playfair Display + Inter)
- **Framer Motion** (enter animations + `whileInView`)
- **Lucide React** (icons)

## Layout
- **Desktop**: Fixed right sidebar (~34–38% width) with brand, nav, and socials. Left pane (~62–66%) scrolls through sections. Active nav item is highlighted via `IntersectionObserver`.
- **Mobile/Tablet**: Sticky header + full-screen overlay menu.

## Structure
```
src/
  App.jsx                  # split-screen layout + active-section wiring
  constants/data.js        # ← edit this to update content (brand, nav, projects)
  hooks/useActiveSection.js
  components/
    Sidebar.jsx            # fixed right nav (desktop)
    MobileNav.jsx          # mobile header + overlay
    Showreel.jsx           # hero + featured video
    ProjectSection.jsx     # reusable category grid
    About.jsx
    Contact.jsx
```

## Editing content
All copy, links, and project data live in `src/constants/data.js` — update `BRAND`, `NAV_SECTIONS`, `SHOWREEL`, `PROJECTS`, `ABOUT`, and `CONTACT`.

Embed URLs must be player-friendly: `https://www.youtube.com/embed/<ID>` or `https://player.vimeo.com/video/<ID>`.

## Develop
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```
