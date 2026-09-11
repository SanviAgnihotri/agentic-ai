# Groovy AI — Design System

> The single source of truth for how Groovy AI looks and moves. Written as a
> creative-director brief: tokens explain a third of the brand, the prose rules
> below explain the rest. Every UI change must be able to answer "what would
> Karri do?" — the answer is almost always *less, but better*.

## Brand

Groovy AI is an agent workspace — a calm control room for software that works
while you sleep. The brand personality is **engineered, opinionated, quiet**.
We are not a toy, not a hype deck, and not a chat wrapper. The interface should
feel like a well-machined instrument: dense enough to be useful, calm enough
to be trusted. The product itself — real agent cards, real run timelines — is
our best imagery.

## Color

Dark is the default theme. Elevation is expressed by **lighter surfaces on a
near-black canvas**, never by shadows.

| Token | Dark | Role |
| --- | --- | --- |
| `--background` | `oklch(0.16 0.005 265)` | App canvas (near-black, slight cool undertone) |
| `--card` | `oklch(0.195 0.006 265)` | Cards, panels, popovers |
| `--muted` / `--secondary` | `oklch(0.24 0.005 265)` | Hover/active surfaces, wells |
| `--sidebar` | `oklch(0.13 0.005 265)` | **Dimmer than content** — chrome recedes |
| `--foreground` | `oklch(0.96 0.002 265)` | Primary ink |
| `--muted-foreground` | `oklch(0.62 0.01 265)` | Secondary ink |
| `--border` | `oklch(1 0 0 / 7%)` | Hairlines. Present, barely |
| `--primary` | existing blue | **Interactive states only** |

Rules:
- The accent appears at most once per viewport — CTA **or** active nav **or**
  focus ring. Everything else is neutral.
- No color for decoration. Status colors (green/amber/red) carry meaning only.
- The sidebar must always be darker than the main content area.

## Typography

One family: **Geist Sans** for everything, **Geist Mono** for code, IDs,
timestamps, keyboard keys. Hierarchy comes from weight + tone + size — rarely
size jumps.

| Role | Size | Weight | Tracking |
| --- | --- | --- | --- |
| Display | 48–64px | 590 | −0.022em |
| Title | 20–24px | 590 | −0.012em |
| Heading | 15–17px | 590 | −0.012em |
| Body | 15px | 400–510 | −0.01em |
| Small | 13px | 400–510 | −0.01em |
| Micro/labels | 11–12px | 510 | 0 |
| Mono | 12–13px | 400 | 0 |

- Display headlines are the tightest-tracked thing on the page. Body text
  stays quiet and readable.
- Tabular numerals (`tabular-nums`) on every stat, count, and table.
- Line lengths under 80 characters for reading text.
- Sentence case everywhere. No ALL CAPS labels except tiny overlines at
  ≤12px with +0.15em tracking.

## Spacing

4px base grid. Inside components we are **dense** (8/12/16/24); between
marketing sections we are **generous** (96px). The inversion is the signature:
calm between bands, dense within components. Content max-width 1200px;
reading columns 640–720px.

## Shape & depth

- Radius: 4px controls · 8px containers · 12px modals · pill badges only.
- Depth = 1px hairline + a *slightly lighter* surface. No drop shadows on
  dark surfaces. Frosted glass (`glass` utility) is reserved for the sticky
  header and floating chrome only.
- One accent glow max per page, at low alpha, only behind the product mock.

## Components

- **Buttons**: 32px (sm) / 36px (md) height, radius 6–8px, weight 510. Never pill except tiny CTAs.
- **Cards**: 1px hairline border, 8px radius, 24px padding, no shadow.
- **Inputs**: same radius; focus = 2px accent ring at 40% alpha, never a box shadow.
- **Nav items**: muted ink by default, full ink on hover/active; active item
  gets the accent text + a soft `bg` fill, never a colored pill background.
- **Tables/rows**: 32–40px rhythm, hairline separators at 6% alpha.
- **Badges**: pill, 1px tinted border, 11px, used sparingly — status only.
- **Icons**: 14–16px, `text-muted-foreground` by default. Colored icon
  backgrounds are forbidden outside empty-state illustrations.
- Every interactive element ships all six microstates: default, hover, focus,
  active, disabled, loading. Skeletons match the final layout, not spinners.

## Layout

- Marketing: centered, max 1200px, hero text column ≤640px, 96px section
  spacing. The product mock is the hero's imagery.
- App: fixed sidebar (dimmed) + content column ≤1200px with 24–32px padding.
- Density inversion: lots of air between sections, tight within cards.

## Voice

Confident, concrete, warm-direct. Short sentences. No hype words, no
"revolutionary", no "powered by AI" copy. Sentence case everywhere. Numbers
are plain ("2,000 credits", "runs in 8 seconds"). Emojis never appear in UI
copy.

## Motion

Motion is **feedback, not decoration**. Everything animated has a reason:
state changed, something entered, or the user should look somewhere.

| Token | Value | Use |
| --- | --- | --- |
| `--motion-fast` | 120ms | hovers, opacity, color |
| `--motion-base` | 180ms | enters, layout shifts |
| `--motion-slow` | 260ms | page/section transitions |
| Press scale | `scale(0.97)` | buttons, cards on active |
| Spring | `{ stiffness 400, damping 34, mass 0.8 }` | layoutId indicators |
| Stagger | 30–40ms per item | list entrances, max 8 items |

- Enter/exit: fade + 4–8px y-translate. Never bounce. Never spin. Never
  gradient shimmer.
- Motion resolves in the frame where the user's eye is.
- Respect `prefers-reduced-motion`: reduce to opacity-only.

## Anti-patterns (the "no" list — this is what keeps us from looking AI-generated)

1. Gradient text, gradient blobs, or gradient section backgrounds.
2. Colored icon-in-tinted-square on every card. Icon color is a *rare* signal.
3. Drop shadows on dark surfaces; glow everywhere.
4. Border radius above 12px on containers.
5. A badge on every heading. Badges are status, not decoration.
6. Six identical feature cards in a 3-column grid.
7. "Powered by AI" copy. Any AI-hype phrasing.
8. More than one accent color per screen.
9. Body text below 13px. Muddy 60–80% lightness grays.
10. Decorative motion: floating orbs, parallax fireworks, looping hero
    animations. If it doesn't communicate state, it doesn't ship.
