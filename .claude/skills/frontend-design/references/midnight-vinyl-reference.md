# Midnight Vinyl — My Music Design System

## Project Identity

**My Music** is a self-hosted Spotify alternative for 20–200 users. The aesthetic brand
is **Midnight Vinyl**: warm, smoky, luxurious, analog. Think a dimly lit record shop at 2am,
not a Silicon Valley SaaS dashboard.

**Fixed Design Decisions** (never override):

| Concern         | Decision                                                           |
|-----------------|--------------------------------------------------------------------|
| Theme           | Dark warm. Charcoal bg, gold accents, ivory text                   |
| Fonts           | Playfair Display (all h1–h4, numbers, stats). DM Sans (body/UI)    |
| Motion          | Pure CSS only. No Framer Motion, no GSAP, no @motionone            |
| Component libs  | Radix UI: Dialog, Dropdown, Toast, Avatar only                     |
| Icons           | Lucide React only                                                  |
| State           | Zustand (usePlayerStore, useQueueStore, useAuthStore)              |
| Styling hybrid  | Inline styles for layout/spacing. className for animations         |
| Framework       | Next.js 14 App Router, React 18, TypeScript, Tailwind CSS 3        |

---

## Design Tokens

### CSS Custom Properties (`globals.css :root`)

| Token           | Value                    | Use                                      |
|-----------------|--------------------------|------------------------------------------|
| `--gold`        | `#e8b84b`                | Primary accent, borders, active states   |
| `--gold-dim`    | `#a07d2e`                | Scrollbar, subdued gold                  |
| `--gold-glow`   | `rgba(232,184,75,0.15)`  | Box shadows, ambient glows               |
| `--ivory`       | `#f5eed8`                | Primary text on dark backgrounds         |
| `--charcoal`    | `#0d0d0d`                | App background, page root                |
| `--surface`     | `#111111`                | Card backgrounds                         |
| `--surface-2`   | `#181818`                | Hover state, elevated surfaces           |
| `--muted-text`  | `#5a5550`                | Placeholder, disabled, secondary labels  |
| `--font-display`| `Playfair Display`       | All h1–h4, stat numbers                  |
| `--font-body`   | `DM Sans`                | Everything else                          |

### Usage Rules

- **Inline styles** → use raw CSS vars: `var(--gold)`, `var(--charcoal)`
- **Tailwind className** → use semantic classes: `bg-card`, `text-muted-foreground`
- **Never** hardcode hex in className: ~~`className="bg-[#111111]"`~~ → use `bg-card`
- **Never** use Tailwind's default gray palette (`gray-700`, `gray-900`, etc.)

---

## Animation Vocabulary

All keyframes live in `globals.css`. Apply via `className` — never recreate inline.

### Entrance Animations (one-shot, `fill: both`)

| Class               | Keyframe      | Duration                          | Use                                          |
|---------------------|---------------|-----------------------------------|----------------------------------------------|
| `anim-fade-up`      | `fadeUp`      | `0.55s cubic-bezier(0.16,1,.3,1)` | Page sections, song rows, cards on mount     |
| `anim-fade-up-1..8` | delay steps   | +0.04s → +0.46s increments        | Stagger children (up to 8 per container)     |
| `anim-scale-reveal` | `scaleReveal` | `0.55s`                           | Album art, avatars, cover thumbnails         |
| `anim-hero-reveal`  | `heroReveal`  | `0.65s`                           | Hero banners: artist profile, album header   |

**Stagger recipe** — any list of cards/rows:
```tsx
<div className={`anim-fade-up anim-fade-up-${Math.min(i + 1, 8)}`}>
```
Cap at `anim-fade-up-8` for long lists.

### Continuous / Ambient Animations

| Class               | Keyframe      | Duration            | Use                                               |
|---------------------|---------------|---------------------|---------------------------------------------------|
| `vinyl-spin`        | `vinylSpin`   | `28s linear inf`    | Album art disc, loading states, decorative vinyls |
| `vinyl-glow`        | `vinylGlow`   | `4s ease-in-out`    | Glow ring on album art when track is playing      |
| `avatar-ring-pulse` | `ringPulse`   | `2.8s ease-in-out`  | Artist avatars, user avatars                      |
| `email-pulse-icon`  | `emailPulse`  | `2.4s ease-in-out`  | CTA icons, notification badges                    |

### Now-Playing / Playback Animations

**WaveBar visualizer recipe** (5 bars):
```tsx
{[0, 0.1, 0.2, 0.3, 0.15].map((delay, i) => (
  <div
    key={i}
    style={{
      width: 3, height: 14, borderRadius: 2,
      background: 'var(--gold)',
      animation: 'waveBar 0.8s ease-in-out infinite',
      animationDelay: `${delay}s`,
      animationPlayState: isPlaying ? 'running' : 'paused',
      transformOrigin: 'bottom',
    }}
  />
))}
```

**Marquee recipe** (now-playing title overflow):
```tsx
const duration = (innerWidth / 50).toFixed(1);
<div style={{ overflow: 'hidden', width: fixedWidth }}>
  <span style={{
    display: 'inline-block', whiteSpace: 'nowrap',
    animation: isOverflowing ? `marqueeScroll ${duration}s linear infinite` : 'none',
  }}>
    {title}
  </span>
</div>
```

### Background / Atmosphere Animations

| Keyframe           | Use                                                              |
|--------------------|------------------------------------------------------------------|
| `auroraShift1/2/3` | Floating blob bg on hero sections and landing pages              |
| `orbFloat`         | Decorative orb elements, ambient background spheres              |
| `particleDrift`    | Rising particles on playback events, album unlock animations     |
| `floatNote`        | Musical note icons floating up (celebration / success states)    |
| `beamSweep`        | Spotlight sweeping over album art (hover effect)                 |
| `scanLine`         | Retro CRT scanline on hero images (atmospheric)                  |
| `glitchSkew`       | Error states, track-skip transitions, genre glitch labels        |
| `vinyl3dSpin`      | Full 3D perspective spin (landing page, decorative only)         |
| `floatCard1/2`     | Floating card pairs for empty state / onboarding visuals         |

### Interaction Animations (state-triggered)

| Class / Keyframe | Trigger                | Use                                                |
|------------------|------------------------|----------------------------------------------------|
| `follow-bounce`  | `onClick` via setState | Follow/unfollow button click                       |
| `goldLine`       | CSS `:focus-within`    | Auth field underline expand (`.auth-field` class)  |
| `strengthGrow`   | `scaleX` state         | Password strength bar                              |
| `progressGrow`   | track progress mount   | Playback progress bar entrance                     |
| `tagIn`          | mount stagger          | Genre pill entrance animation                      |

### Utility CSS Classes

| Class         | Description                                                          |
|---------------|----------------------------------------------------------------------|
| `.btn-gold`   | Gold shimmer button — use for all primary CTAs                       |
| `.auth-field` | Underline input with animated gold focus line                        |
| `.noise`      | Noise texture `::before` overlay at 3% opacity — adds analog depth  |

---

## Music App Component Patterns

### PlayerBar (fixed bottom, `h-20`, `z-50`)

Reads from `usePlayerStore`: `{ currentSong, isPlaying, positionSeconds, duration, volume }`.

**Layout** (left | center | right thirds):
- **Left**: circular album art (48px) + `vinyl-spin vinyl-glow` when isPlaying, then song title (marquee if overflow) + artist name
- **Center**: SkipBack → Play/Pause (gold, 40px) → SkipForward + progress bar below
- **Right**: Volume slider + optional queue icon

**Key patterns**:
```tsx
// Album art — circular, spins when playing
<img
  className={isPlaying ? 'vinyl-spin vinyl-glow' : ''}
  style={{
    width: 48, height: 48, borderRadius: '50%',
    border: '1px solid rgba(232,184,75,0.25)',
    objectFit: 'cover',
  }}
/>

// Progress bar (thin gold line, 3px)
<div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 2, flex: 1 }}>
  <div style={{
    height: '100%',
    width: `${(positionSeconds / duration) * 100}%`,
    background: 'var(--gold)',
    borderRadius: 2,
    transition: 'width 1s linear',
  }} />
</div>

// Container (frosted glass)
style={{
  background: 'rgba(13,13,13,0.92)',
  backdropFilter: 'blur(16px)',
  borderTop: '1px solid rgba(232,184,75,0.08)',
}}
```

### Album Art / Cover Thumbnail

| Size            | Pattern                                                                  |
|-----------------|--------------------------------------------------------------------------|
| Small 40px      | `borderRadius: 4`, gold border 1px at 20% opacity, no animation         |
| Medium 80–120px | `anim-scale-reveal` on mount, `vinyl-glow` when track is playing        |
| Hero 240px+     | `anim-scale-reveal`, `vinyl-glow`, optional `vinyl-spin` when playing   |
| Fallback        | Music note icon centered, `background: rgba(232,184,75,0.08)`           |

Always 1:1 square, `objectFit: 'cover'`.

### Song Row (tracklists, playlists, queues)

```
[number / waveBar] | [40px art] | [title + artist] | [duration] | [actions ...]
```

- **Playing indicator**: replace track number with 5-bar waveBar visualizer
- **Active track**: `color: var(--gold)` on title, gold playing indicator
- **Hover**: `background: var(--surface-2)`, reveal action buttons
- **Stagger entrance**: `anim-fade-up anim-fade-up-{i}` on each row

### Glassmorphism Card

```tsx
style={{
  background: 'rgba(17,17,17,0.75)',
  border: '1px solid rgba(232,184,75,0.1)',
  backdropFilter: 'blur(12px)',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  transition: 'border-color 0.2s, transform 0.25s cubic-bezier(0.16,1,0.3,1)',
}}
// Hover: border rgba(232,184,75,0.25), transform translateY(-2px)
```

### Hero Section (artist profile, album detail)

Three-layer pattern:
1. Blurred/scaled source image as full-width background (filter: `blur(55px)`, scale 1.15, opacity 0.25)
2. Gradient overlay: `linear-gradient(to bottom, rgba(13,13,13,0.4) 0%, rgba(13,13,13,0.95) 60%, #0d0d0d 100%)`
3. Content layer: flex column, center-aligned

For album pages, tint the ambient layer with the album's dominant color.

### Vinyl Disc Component (decorative / loading)

```tsx
<div
  className="vinyl-spin"
  style={{
    width: 64, height: 64, borderRadius: '50%',
    background: 'radial-gradient(circle at 30% 30%, #2a2520, #111)',
    border: '2px solid rgba(232,184,75,0.2)',
    boxShadow: '0 0 20px rgba(232,184,75,0.05)',
  }}
/>
```

### Genre / Tag Pills

```tsx
style={{
  padding: '3px 10px',
  background: 'rgba(232,184,75,0.07)',
  border: '1px solid rgba(232,184,75,0.15)',
  borderRadius: 20,
  fontSize: '0.68rem',
  color: 'var(--gold)',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}}
className="tagIn"
```

### Section Labels (caps headers above lists)

```tsx
style={{
  fontSize: '0.62rem',
  letterSpacing: '0.13em',
  textTransform: 'uppercase',
  color: 'rgba(232,184,75,0.35)',
  fontWeight: 400,
}}
```

### Stats Display

```tsx
// Number
style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--gold)', fontWeight: 400 }}
// Label below
style={{ fontSize: '0.65rem', color: 'var(--muted-text)', letterSpacing: '0.07em', textTransform: 'uppercase' }}
```

### Aurora / Gradient Mesh Background

```tsx
const orbs = [
  { style: { top: '-20%', left: '-10%' },   size: 500, color: 'rgba(232,184,75,0.06)',  anim: 'auroraShift1 18s ease-in-out infinite' },
  { style: { bottom: '-20%', right: '-10%' }, size: 400, color: 'rgba(245,238,216,0.03)', anim: 'auroraShift2 22s ease-in-out infinite' },
  { style: { top: '30%', left: '40%' },     size: 300, color: 'rgba(232,184,75,0.04)',  anim: 'auroraShift3 14s ease-in-out infinite' },
];
```

### Dividers

```tsx
// Gradient
style={{ height: 1, background: 'linear-gradient(to right, transparent, #2a2520, transparent)', margin: '24px 0' }}
// Hard
style={{ height: 1, background: '#141414' }}
```

---

## Styling Architecture Rules

### Hybrid Convention
1. **Layout, spacing, sizing** → inline `style={{}}`
2. **Animations and utility effects** → `className="..."`
3. Never inline-animate properties that CSS classes already handle
4. For Tailwind: use only for utilities not covered by inline styles or CSS vars

### Hover Interactions (no useState needed)
```tsx
onMouseEnter={e => {
  e.currentTarget.style.borderColor = 'rgba(232,184,75,0.3)';
  e.currentTarget.style.transform = 'translateY(-2px)';
}}
onMouseLeave={e => {
  e.currentTarget.style.borderColor = 'rgba(232,184,75,0.1)';
  e.currentTarget.style.transform = 'translateY(0)';
}}
```

### Transition Standard
```tsx
transition: 'color 0.18s, background 0.18s, border-color 0.18s'
transition: 'transform 0.25s cubic-bezier(0.16,1,0.3,1)'
```

### Stagger Formula
```tsx
animationDelay: `${i * 0.06}s`
```

### z-index Layers

| Layer                        | z-index |
|------------------------------|---------|
| PlayerBar (fixed bottom)     | 50      |
| Modals / Toasts              | 50+     |
| Background orbs / decorations| -1      |

---

## Page Design Briefs

### Browse / Discover
- Hero: horizontally scrollable genre pill row
- Featured: large glassmorphism card with aurora background + `beamSweep` on hover
- Grid: staggered `anim-fade-up` on album cards, hover lifts with `translateY(-4px)`
- Sections: horizontal scroll carousels with section label headers

### Activity Feed
- Each feed item entrance: `anim-fade-up` staggered
- Song-play events: small inline waveBar (3 bars, compact)
- Follow events: `avatar-ring-pulse` on artist avatar
- Timeline: thin gold vertical line on left edge

### Playlist Detail
- Hero: large cover art (240px, `anim-scale-reveal`) + Playfair Display italic title
- Track list: song rows with staggered entrance, waveBar on active track
- Gradient fade at tracklist bottom

### Album Detail
- Hero: full-width with aurora ambient bg tinted by dominant album color, large art with `vinyl-glow`
- When playing: album art goes circular + `vinyl-spin`
- Track list: numbered rows, active track gold, waveBar visualizer

### Artist Public Profile
- Songs section: staggered song rows, waveBar on playing track
- Discography grid: album cards with hover `vinyl-glow`

---

## Anti-Patterns

### Typography
- Never use Inter, Roboto, system-ui for headings → use Playfair Display
- Never bold Playfair Display at weight 700+ → use 400 or 500
- Never use white `#ffffff` for text → use `var(--ivory)`

### Color
- Never use Tailwind's default gray palette
- Never use purple gradients or blue accents
- Never use fully opaque gold as a background fill
- Never use `bg-white` or `text-black`

### Animation
- Never import Framer Motion, `@motionone/react`, or GSAP
- Never write `@keyframes` inside component files
- Never apply `vinyl-spin` to non-circular elements
- Never animate layout properties (width, height, top, left)
- Never stack more than 3 simultaneous ambient animations

### Structure
- Never use Tailwind grid/flex for complex layouts → use inline styles
- Never create a new CSS file → extend `globals.css`
- Never use Radix UI outside the approved list
- Never place PlayerBar outside the fixed-bottom layout

### Loading States
- Never use a bare `<Loader2>` spinner → use vinyl-spin disc variant
