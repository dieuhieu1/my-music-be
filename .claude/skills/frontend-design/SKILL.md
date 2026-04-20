---
name: frontend-design
description: Create distinctive, production-grade frontend interfaces with high design quality for the My Music app (Midnight Vinyl aesthetic). Use this skill when the user asks to build web components, pages, artifacts, or applications. IMPORTANT — this skill enforces a mandatory two-phase workflow. Phase 1 is PLAN MODE where Claude generates a structured implementation plan and presents it to the user. Phase 2 is IMPLEMENT where Claude writes code only after the plan is approved. Always read the Midnight Vinyl design system reference before planning or coding. Triggers on any mention of UI, component, page, frontend, layout, styling, animation, or design for the music app.
---

# Frontend Design Skill — Plan → Implement Workflow

This skill enforces a **strict two-phase workflow** for all frontend work on the My Music app.

**Before doing anything else**, read the design system reference:
```
view /mnt/skills/user/frontend-design/references/midnight-vinyl.md
```
This file contains all design tokens, animation classes, component patterns, page briefs, and anti-patterns. Every plan and implementation MUST follow it.

---

## Phase 1 — PLAN MODE (mandatory first step)

Before writing ANY code, Claude MUST produce a plan and present it in the conversation for user approval. **Never skip this phase** unless the user explicitly says "just build it" or the task is a minor tweak/bugfix.

### Plan Template

Output this structure (in the conversation, not as a file):

```
## Plan: [Component/Page Name]

### 1. What & Why
- What this builds and the user problem it solves
- Key interactions the user will have

### 2. Aesthetic Direction
- Midnight Vinyl tokens being used (list exact CSS vars)
- Typography: which elements use Playfair Display vs DM Sans
- The ONE memorable thing about this component

### 3. Layout
- Structure description (zones, hierarchy, responsive)
- z-index layering if relevant

### 4. Components
For each sub-component:
- Name, purpose, props/state
- Which Zustand store it reads from (if any)
- Dependencies (Lucide icons, Radix primitives)

### 5. Animation Plan
- Entrance: which elements get anim-fade-up, anim-scale-reveal, etc.
- Stagger: how many items, cap at 8
- Continuous: vinyl-spin, vinyl-glow, waveBar — when active
- Hover: border-color shift, translateY, beamSweep
- State transitions: what animates on play/pause/follow/etc.

### 6. Edge Cases
- Loading state (vinyl-spin disc, shimmer)
- Empty state (what shows when no data)
- Error state (glitchSkew, fallback message)

### 7. Files
- List of files to create with paths
- Estimated size (small / medium / large)

Ready to implement? Let me know if you'd like changes.
```

### Plan Rules
- Reference exact token names from midnight-vinyl.md (`var(--gold)`, `anim-fade-up-3`, etc.)
- Never invent new design tokens — use what exists
- Flag any decision that needs user input
- Keep it concise — bullets, not essays

### After the plan
- User approves → Phase 2
- User gives feedback → revise plan, present again
- User says "skip" / "just code it" → Phase 2 immediately

---

## Phase 2 — IMPLEMENT (after plan approval)

Write code following the approved plan and the Midnight Vinyl design system. If you deviate from the plan, briefly note why.

### Implementation Checklist

Before considering the component done, verify:

- [ ] Uses `var(--gold)`, `var(--ivory)`, `var(--charcoal)`, `var(--surface)` — no hardcoded hex
- [ ] Headings/stats use `fontFamily: 'var(--font-display)'` (Playfair Display)
- [ ] Body/UI text uses DM Sans
- [ ] Animations use className references to globals.css keyframes — no inline @keyframes
- [ ] No Framer Motion, GSAP, or @motionone imports
- [ ] Hover states use onMouseEnter/onMouseLeave with gold border + translateY
- [ ] Transitions use project standard: `cubic-bezier(0.16,1,0.3,1)` for transforms
- [ ] Layout uses inline styles; animations use className
- [ ] Stagger capped at `anim-fade-up-8`
- [ ] Loading state uses vinyl-spin disc, not bare Loader2
- [ ] No Tailwind gray palette, no `bg-white`, no `text-black`
- [ ] No purple gradients or blue accents
- [ ] PlayerBar stays fixed bottom z-50 if present
- [ ] Only approved Radix UI: Dialog, Dropdown, Toast, Avatar

### Code Quality Standards
- Production-grade TypeScript
- All interactive elements have hover/focus states
- Reduced motion media query respected
- Mobile responsive (touch targets ≥ 44px)

---

## When to Skip the Plan

| Scenario | Action |
|---|---|
| New page or full component | **Full plan** → implement |
| Small CSS fix / color tweak | Implement directly |
| Bug fix | Implement directly |
| User says "just build it" | Implement directly |
| User says "plan first" | **Full plan** → implement |
| Ambiguous scope / multiple approaches | **Full plan** → implement |

---

## Workflow Diagram

```
User Request
    │
    ├── Minor tweak/fix? ──► Implement directly (still follow design system)
    │
    └── New build / significant feature
            │
            ▼
    ┌──────────────────┐
    │  Read reference:  │
    │  midnight-vinyl.md│
    └────────┬─────────┘
             ▼
    ┌──────────────────┐
    │  PHASE 1: PLAN   │
    │  Present to user  │
    └────────┬─────────┘
             │ approved / feedback loop
             ▼
    ┌──────────────────┐
    │  PHASE 2: CODE   │
    │  Follow plan +    │
    │  design system    │
    └──────────────────┘
```

---

## Core Principles

- **Midnight Vinyl is the identity** — not a suggestion. Every screen is part of one coherent world.
- **Plan before code** — alignment up front saves rework later.
- **Gold is earned** — use it sparingly as accent, not as fill.
- **Every animation must serve a purpose**: playback feedback, navigation clarity, or atmosphere.
- **Playfair Display numbers are a visual signature** — use them for all stats, counts, timestamps.
- **The PlayerBar is the heartbeat** — it must always feel alive when music is playing.
