# Design Brief — for Claude Design (UX/UI lead)

> Companion to `00-PROJECT-BRIEF.md` (read it first — especially "assisted but sovereign" and the
> module/theming architecture). This document is the design mandate: direction, constraints, and the
> surfaces that need design, in priority order. It is a brief, not a spec — Claude Design owns the
> visual language within these constraints.

## Design mandate

A **graphically beautiful**, quiet, writing-first desktop app. The competition (Iron Fellowship,
Stargazer) is functional web-tool aesthetics; the differentiator here is an interface that feels
like a crafted artifact — closer to a beautiful writing app (iA Writer, Obsidian at its best,
Linear's discipline) than a VTT dashboard. Beauty is systematized, not artisanal: everything flows
from tokens.

## Direction: dark and icy

The owner's aesthetic. The **base theme is glacial-dark**: deep blue-black backgrounds, cold
grey-blue surfaces, ice-blue/cyan accent range, high-contrast near-white text with cold undertones.
Think: starlight on ice, aurora accents used _sparingly_, frost rather than neon. Avoid the
cyberpunk trap (saturated magenta/teal everywhere); this is cold, calm, and vast.

Light theme: not a launch requirement, but the token system must make one possible (no hardcoded
colors anywhere, semantic tokens only).

### Theming architecture (constraint from the project brief)

- One **token system** in `packages/ui`: primitives (color scales, spacing, type scale, radii,
  elevation, motion durations) → semantic tokens (`surface.raised`, `text.muted`, `accent.primary`,
  `state.success`…) → component tokens.
- **System modules contribute theme variants** as token overrides, not new systems. The glacial-dark
  base is the app shell's identity; module themes are atmospheric tints within it:
  - _Starforged_: the base theme's natural home — deep space, ice-blue, starfield. Design the base
    FOR this module first.
  - _Classic Ironsworn_: colder iron — desaturated steel, frost-grey, ember accent replacing cyan.
    Still dark, still cold; austere rather than cosmic.
  - Future modules pick their own tint within the token contract (a 5e module might warm slightly;
    that's its right — the contract, not the palette, is fixed).
- Dice, oracle results, and mechanical chrome may glow gently; prose never competes with chrome.

## The two hard UX problems (design these first, before any screens)

### 1. The sovereignty affordance (accept / adjust / decline)

Every mechanical moment produces _suggestions_, never actions: "Weak hit — suggested: −1 momentum."
The pattern must make accepting one tap, adjusting two, declining one — and then get out of the way.
It appears dozens of times per session; if it feels like a dialog box, the app fails. Explore:
inline suggestion chips in the journal flow, ghost-state previews ("momentum 9 → 8" shown faintly
until accepted), and an always-available "edit anything" affordance on past events (revisions, not
erasures — history is sacred, per the append-only log). The audit trail (suggested vs chosen) is
data the UI can quietly celebrate, not hide.

### 2. Prose-first flow with mechanics woven in

The journal is a writing surface interrupted as little as possible. Inline `@`-mentions
(create-as-you-write), inline roll results as live embeds (inspectable: what table, what dice, what
source), move execution that opens _in the flow of writing_ and collapses back into a compact event
card. The measure of success: a full scene played without the hands leaving the keyboard and without
the writing feeling punctuated by "app stuff".

Also in this problem: **manual dice entry** must be as fast as clicking roll — a three-number entry
(Starforged: d6, d10, d10) designed for two-second keyboard input, with digital/manual visually
distinguished but equal in dignity.

## Surfaces, in build order

1. **Journal / session log** — the product. Typography is the app: pick a serious reading/writing
   face pairing (prose serif or humanist sans + a tabular-figures mono for dice/numbers), generous
   measure, calm rhythm. Mechanical event cards (rolls, oracle results, track changes) as compact,
   scannable interruptions that can expand.
2. **Entity panes & connections** — entity quick-view on mention hover; full entity page; the
   relationship graph (cold, constellation-like — this is where "icy" gets to be literal).
3. **Threads / narrative momentum** — open-loops list, staleness cues (subtle, not naggy),
   session-start recap ("previously on") as a designed moment, not a modal.
4. **Tracks & clocks worksheet** — segmented tracks and clocks want to be _satisfying_: the tick
   interaction is the app's most repeated tactile moment. Design it like an instrument.
5. **Oracle worksheet & reference browser** — dense but calm; hyperlinked rules content with
   hover-previews; d100 tables that render beautifully at length.
6. **Session-zero flow** — the front door and first impression. Guided but skippable; every step
   offers roll / pick / write-your-own with equal visual weight.
7. _(Wave 2)_ **Sector maps** — point-crawl constellation on a starfield; SVG; pins are entities.
   The marquee visual feature and the theme's showcase. Asset cards (content supplied by Datasworn
   including SVG icons — design one gorgeous card component, not fifty cards).

## Constraints & non-negotiables

- **Tokens only.** No literal colors/sizes in components. The module theming contract depends on it.
- **Desktop-first, keyboard-first.** Command palette early; full keyboard path through the journal →
  move → suggestion loop. Mouse is for maps.
- **Accessibility:** WCAG AA contrast minimum on the dark theme (dark themes fail this constantly —
  test every muted-text token), visible focus states, reduced-motion respect, never color-only
  meaning (strong hit / weak hit / miss need shape or label, not just hue).
- **Density control** eventually (comfortable/compact), but design comfortable first.
- **Electron/web stack:** React, Radix primitives acceptable as the behavior base; styling approach
  is Claude Design's call within the token architecture (CSS variables strongly preferred as the
  token substrate — they make runtime module theming trivial).
- **Performance is a design feature:** long journals must scroll like silk (virtualization-friendly
  layouts; avoid designs that require measuring the world).
- Iconography: one coherent set, line-weight matched to the type; dice/oracle glyphs will need
  custom drawing — budget for it.

## Deliverables requested from Claude Design, in order

1. Token system v1 (color scales + semantics for glacial-dark, type scale, spacing, elevation,
   motion) as CSS variables + a reference sheet.
2. The sovereignty affordance pattern — explored as interactive prototypes, decided, documented.
3. Journal surface design: typography system + event-card family + inline mention/roll embeds.
4. Component library seed in `packages/ui` (buttons, inputs, cards, panes, chips, focus/hover
   states) consuming the tokens.
5. Tracks/clocks interaction design.
6. Session-zero flow.
7. Starforged module theme tokens + classic-Ironsworn variant (proving the module theming contract
   with two real consumers — same rule-of-two honesty as the toy module).
