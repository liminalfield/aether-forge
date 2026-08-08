# Themes and components

Status: accepted, 5 August 2026 (#83). Decomposed and built across #86, #87 and #93 to #99; the "Not
yet decomposed" that stood here outlived the decomposition. Corrected 7 August 2026.

If the code and this record ever disagree, the code is right and this needs a note saying what
changed.

> The ghost block was built on 8 August 2026 (#172), with two things this record did not anticipate.
> It needs the accent at two strengths, and neither became a sixteenth slot: a theme still authors
> fifteen values and the two are mixed from the accent it authored, so changing the accent changes
> both. Its slow breathing glow is also not a fourth duration. The three durations here say how long
> a change takes; this says how slowly something already on screen breathes, and when a person asks
> for less movement it stops rather than arriving instantly, because a pulse played in zero
> milliseconds is a flash. The border and the wash stay, so the meaning survives the movement going.

> Known divergences between this record and the code, written down 7 August 2026 and not yet
> reconciled. None of these was a decision; each is drift, and whether the code or the record moves
> will be decided per item. The outcome glyphs shipped as ◆ ◇ △ in `system-ironsworn` where this
> record decided ▲ ◐ ▼ ✦, and nothing in `packages/ui` enforces the decided set. The journal window
> still draws with inline style objects, though every colour crosses as a custom property, so the
> themeability this record exists for does hold. The spacing and type scales in
> `packages/ui/src/tokens.ts` cover fewer steps than the handoff uses, so components write the
> missing sizes as literals, and no guard catches a literal size the way the lint catches a literal
> colour. The ghost block, named below as a component and not a style, has not been built; offers
> currently render as a plain chip row.

There is a finished visual design for nine surfaces sitting in `design/ux-ui-design-handoff`, and a
window that draws a list of paragraphs with inline styles. This record is about closing that gap
from the bottom: the tokens, the theming, and the small set of components everything else will be
built out of.

It is deliberately the piece that depends on no engine work. Every other surface in the handoff is a
view of something that does not exist yet: verdict cards need moves, tracks need tracks, the oracle
palette and the asset wall need content packages. This does not. It can be built alongside engine
work rather than behind it, and everything visual afterwards is faster for having it.

## What a theme actually is

The handoff decided something stronger than a colour scheme, and it is worth stating plainly before
anything else: **a theme is a palette and never new component design.**

The Ironsworn variant of the whole application rotates twelve values and adds zero components. If a
theme ever needs a component to be built differently, the theme system is wrong. That claim is
testable, and it is the main thing this record is trying to protect.

> **Counted while building it, 5 August 2026 (#87).** The handoff said eleven, and this record
> repeated it. The real number is twelve: five ground, four ink, two accent, and `outcome.miss`,
> which the handoff also rotates and did not count. A test asserts the twelve by name so the figure
> cannot drift again.

Here is a theme, in full:

```json
{
  "name": "Glacial dark",
  "ground": {
    "void": "#05080E",
    "sunken": "#0A0F18",
    "base": "#0E1420",
    "raised": "#141C2A",
    "overlay": "#1B2534"
  },
  "ink": {
    "primary": "#E8EEF6",
    "secondary": "#A8B7CB",
    "muted": "#7E92A8",
    "hairline": "rgba(150,180,215,.12)"
  },
  "accent": { "accent": "#7FD4F5", "pressure": "#D9A85C" },
  "outcome": {
    "strong": "#8FE3C0",
    "weak": "#D9A85C",
    "miss": "#CE6B75",
    "match": "#A98BFF"
  }
}
```

Fifteen slots in four groups, and that is the whole surface a person authoring a theme touches. A
component never names a colour; it names a slot:

```css
.card {
  background: var(--ground-raised);
  border: 1px solid var(--ink-hairline);
  color: var(--ink-primary);
}
```

Switching theme sets fifteen custom properties on the root element. Nothing re-renders, nothing is
rebuilt, and no component knows it happened.

## Decisions

### Tokens become CSS custom properties, not JavaScript values

Today `tokens` is a plain object of strings, used in inline styles. That cannot be themed. Changing
a value means re-rendering everything that read it, and a theme loaded from a file at runtime could
never reach code that already baked the value in.

So the tokens become CSS custom properties, declared once on the root element, and the TypeScript
object becomes the list of their names rather than the list of their values. Components refer to
`var(--ground-raised)` and never to `#141C2A`.

This is the decision the rest of the record rests on. Everything about user-authored themes,
switching between Ironsworn and Starforged looks, and light mode follows from it, and none of it is
possible without it.

The cost is that a value is no longer visible to TypeScript. A component asking for
`var(--ground-raisd)` compiles and renders wrong. Naming the properties in one place and generating
both the CSS and the type from that list keeps the typo caught, and the list is small enough that
this is cheap.

### A theme is data, and nothing about it is corrected

A theme is a small JSON document. It can be exported, shared and imported, which is the same
distribution model as content packages.

The application computes two things about it and shows them to whoever is authoring it. How each ink
slot contrasts against the ground it sits on, and how far apart accent and pressure are in hue.
Those are worth knowing: accent means the player's own progress and pressure means the world closing
in, and a campaign where they read as the same colour is hard to follow at a glance.

**Then it draws exactly what it was given.** No correction, no clamping, no substituted value.

> **Changed at review, 5 August 2026.** As first written, this said a failing theme still saves and
> the application corrects the value when it draws. The maintainer pushed back on the gatekeeping
> and was right. The rest of this section is the argument that replaced it.

Saving a theme and then drawing a different one is not respecting a choice. It moves the refusal
somewhere the person cannot see, which is worse than refusing honestly, because they have no way to
tell that what they asked for is not what they got.

The comparison with dice is what settles it. Range validation exists because a d10 showing 12 is not
a die result at all; no such face exists. Every hex value is a real colour. Low contrast is not an
impossible state, it is a state someone might want, and there is no version of "a d10 cannot show
12" that applies to it. So there is no check.

There is also a practical reason not to correct, which is that correcting is very hard to undo. Once
the application quietly adjusts colours, people author themes against the adjusted output rather
than against what they typed. Removing the correction later changes how every one of those themes
looks, through no action of the person who made it. A rule that can only be added, never removed,
deserves more certainty than this one has.

The one thing that is refused is a value that is not a colour, because it cannot be drawn at all.
That is the whole of the validation.

### The outcome glyphs are not decoration

Every outcome carries a glyph as well as a hue: strong `▲`, weak `◐`, miss `▼`, match `✦`. Colour is
never the only carrier of meaning, so a colourblind reader, or a reader who has chosen a palette
nobody else would, still reads the screen.

That is decided once here rather than argued per screen, and it is what makes the section above
affordable. If colour were the only signal, an unreadable palette would make the application
unusable and the pressure to correct it would be real. With a glyph beside every outcome, a palette
is a preference rather than a failure.

The handoff locks `outcome.match` to violet and makes it the one slot a person cannot change, on the
grounds that a match is the single most story-productive event in the system and must never be
mistaken for another. **It is unlocked here**, for the same reason the contrast rule went: it is the
same gatekeeping in a smaller place, the glyph already carries the meaning, and a locked slot in an
otherwise open contract is the kind of exception that gets copied.

Agreed 5 August 2026. All fifteen slots belong to whoever is authoring the theme, with no
exceptions.

> **Counted while building it, 5 August 2026 (#86).** This record said fourteen slots throughout,
> taking the number from the handoff. The handoff counted fourteen _editable_ slots and treated the
> match colour as a locked sixteenth thing rather than a slot. Unlocking it makes the count fifteen:
> five ground, four ink, two accent, four outcome. Corrected everywhere it appeared.

### A theme is colours, and nothing else

Fifteen colour slots. Not fonts, not sizes, not spacing, not the shapes of tracks and clocks.

The reasoning is specific rather than a principle, and it is worth keeping because it is the sort of
thing that gets forgotten and relitigated. Nocturne Writer could offer a broadly configurable
interface because its interface was a thin frame around a writing canvas, so there was little for a
bad configuration to break. This application is the opposite. It is dense with detailed chrome:
meters, tally boxes, clocks, chip rows, rails packed with numbers. Fonts and spacing are
load-bearing there in a way they are not around a blank page, and a fully configurable version of it
would be unusable long before it was finished, for the person configuring it and for anyone
maintaining it.

The shapes stay fixed for a stronger reason. A tally box is square and a clock is round, and that
difference is how a player tells their own progress from the world's without reading a label. It is
information, not decoration, and it is not the theme's to move.

This is a scope decision rather than a refusal. There is no slot in the theme file for any of it, so
nobody is being told no. Adding slots later is additive and breaks nothing, which is why deciding
narrowly now is cheap.

### Preferences are personal, and do not travel with a theme

Two things people will reasonably want to change are not colours, and putting them in a theme would
be wrong even though it would be convenient.

**Animation on or off.** The three durations exist because motion carries meaning here, but a person
who finds movement tiring should be able to switch it off outright, not only through the operating
system's reduced-motion setting. That setting is still honoured as the default.

**The journal's typeface.** The journal is the one place where somebody is reading continuous prose
for an hour, and the one place where a font that suits them matters more than the design's
preference. This is the exception to the section above, and it applies to the writing surface only,
never to the chrome around it.

Neither belongs in a theme, because a theme is a thing you export and hand to somebody else. Your
colours are worth sharing. Your need for less movement, or for a particular serif, is yours and
should not arrive attached to a palette a friend sent you. So they are application preferences,
stored with the application, and a theme file has no field for either.

That split is worth getting right the first time. A theme format that quietly accumulates personal
settings becomes a format nobody can share without also sharing how they read.

### Light is not dark inverted

Accents darken rather than lighten: `#7FD4F5` becomes `#156587`. A pale accent on a pale ground has
nowhere to go.

Elevation reverses. In dark, a raised surface is lighter than the page. In light, a raised surface
is whiter than a tinted page. Same slot names, opposite direction along the ramp, which is exactly
why the slots are named `raised` and `sunken` rather than `lighter` and `darker`.

Prose weight goes from 300 to 400 between dark and light, because thin serif type on a bright ground
loses its stroke. That is the theme reacting to its own ground rather than a value anybody sets.

### Components are named in words no rulebook uses

This is the constraint that shapes the component layer, and it is worth being concrete because the
handoff is written in Starforged vocabulary throughout.

`packages/ui` may not contain the words momentum, impact, vow, asset, move, or debility. What the
handoff calls a momentum bar is a **meter**. What it calls a verdict card is a **result card**. What
it calls an impact chip row is a **chip row**. What it calls a progress box is a **tally box**.

This is not pedantry about naming. A component called `MomentumBar` cannot be used by a system that
has no momentum, and the whole architecture exists so that another system can arrive without
reworking the core. The handoff agrees with this already, in its own words: nothing about Ironsworn
versus Starforged should be hardcoded in a component, including the impact chip row, which swaps
wholesale per ruleset.

So the first components are the primitives, in neutral words: meter, tally box, clock, chip, chip
row, card, result card, ghost block, key hint. Modules and the application supply the labels.

### The ghost block is a component, not a style

Every suggestion in the application looks the same: a dashed one-pixel border in the accent colour,
a faint wash, and a slow pulse on the box shadow. `Enter` accepts, `Escape` declines, and a declined
suggestion stays on screen, greyed and timestamped.

That is one component, used everywhere a suggestion appears, rather than a style each surface
applies for itself. The reason is the product promise rather than convenience: the application
suggests and never decides, and the way a person learns to trust that is by seeing the same visual
language every single time something is proposed to them. If two surfaces render a suggestion
differently, the promise gets harder to believe.

The pulse animates the box shadow only, never opacity, because animating opacity would drag the text
contrast down with it on every cycle.

### Reduced motion still marks the moment

Three durations exist: 90ms for something arriving, 140ms for a value settling into a new number,
260ms for the one ceremony, which is a track becoming ready to roll.

Under `prefers-reduced-motion` the durations go to zero and the pulse becomes a static border. **The
ceremony still happens**, as an instant change of border and copy rather than a sweep.

The distinction matters. Reduced motion means less movement, not less information. A player who has
turned animation off still needs to know their track is ready, and a design that silently drops the
signal along with the animation has failed them rather than accommodated them.

### The sector map stays dark in every theme

It is a chart on a dark plate, and a starfield on white paper does not exist.

Written down because it looks like an oversight, and the next person to tidy the theming will
otherwise fix it.

### `packages/ui` gains React, as a peer dependency

The component layer is React, because the renderer is React and a component library that is not
would have to be adapted at every use.

A peer dependency rather than a dependency, so that the application supplies the one copy of React
that runs. Two copies of React in one process is a class of bug that is unpleasant to diagnose and
trivial to avoid.

The first runtime dependency `packages/ui` has ever had, agreed by the maintainer on 5 August 2026.

### Fonts are bundled, not fetched

Literata for prose and display, Archivo for interface text and labels, IBM Plex Mono for dice,
meters and small capitalised labels. All three are open-licensed.

They are bundled as files rather than loaded from a font service. The application is offline-first,
so a font that needs the network is a font that sometimes is not there; and the renderer's content
security policy forbids loading from another origin anyway.

Tabular numerals are mandatory on every dice value, meter and clock reading. A number that changes
width when it changes value is unreadable in a rail, and this is cheaper to decide once than to fix
per component.

Adding three font families is a licensing decision. Agreed by the maintainer on 5 August 2026, with
their attribution to land in `LICENSES.md` in the same change that adds the files.

## What we are deliberately not doing

**The nine surfaces.** This record is the layer underneath them. Each surface arrives with the
engine piece it displays.

**A theme editor.** Themes are data first. An interface for authoring them is its own piece of work,
and until then a theme is a file you can write by hand.

**Icon extraction.** The handoff recommends extracting the real asset icons from the published PDFs
during build. The licence covering the SRD text does not automatically cover the artwork printed
beside it, and nobody has checked. It stays unsettled until someone does.

**Rich text.** The journal stays a plain writing surface until there is something to embed in it,
which is still entities and roll results. That was decided in
`design/reading-and-writing-the-journal.md` and nothing here changes it.

**Changing what the journal window does.** Re-skinning it to the new tokens is a visible change with
no behavioural one, and it belongs in this work. Adding anything to it does not.

## Open questions

**What does the application look like with nothing in it?**

No empty states, no error states, and no first-run-with-no-campaign screen are designed. The handoff
says so and asks that this be raised rather than invented.

_Why it matters:_ it is the first thing a new person sees, and it is the screen most likely to be
built by whoever happens to need it first, in whatever style they happen to choose. That is how a
consistent design becomes an inconsistent one.

_What would settle it:_ designing them, before the first surface needs one rather than during. The
journal already has one, showing "Nothing written yet", and it was written without any of this in
mind.

**What are the seven unspecified slots in each light theme?**

The handoff gives eight of the fifteen slots for Glacial light and Ember light: the page, the raised
surface, three inks, accent, pressure and the miss colour. The other seven are not stated.

_Why it matters:_ they cannot be derived from the rules the record already gives. In light,
elevation reverses so a raised surface goes whiter than a tinted page, and Glacial light's raised
surface is already pure white, which leaves `overlay` with nowhere above it to go. Guessing produces
a theme that looks nearly right and is wrong in a way nobody can point at.

_What would settle it:_ the designer supplying the remaining seven values for each, which is a short
job for whoever chose the first eight and an invention for anybody else.

**Are fifteen slots the right number?**

It is enough for the four built-in themes, which is real evidence, and the ember variant rotating
eleven values with no component changes is a genuine test of it.

_Why it matters:_ too few slots and a user theme cannot express what someone wants, so they ask for
more and the number creeps. Too many and every theme is a chore to author and the contrast rules get
harder to check.

_What would settle it:_ someone other than the designer authoring a theme and saying what they could
not say.

## What this changes elsewhere

**`packages/ui` stops being a file of constants.** It gains a theme model, the custom properties,
the component layer, React as a peer dependency, and three bundled font families.

**The journal window stops using inline styles.** It currently reads `tokens.color.surface` and
similar directly into style objects. Those become classes and custom properties.

**`00-PROJECT-BRIEF.md` may need a line.** It says `packages/ui` is tokens only, which stops being
true. That is a statement of current state rather than a decision, so updating it is probably all
that is needed, but it is the maintainer's to confirm.

**`LICENSES.md` gains the font licences.** Bundled fonts ship inside the application, so their
attribution ships with it.

**The vocabulary check gets more to do.** It has had little to bite on in `packages/ui` so far. A
component layer built from a Starforged design document is the first real test of it, and it should
be expected to fire during this work rather than treated as a surprise when it does.

## How we would know this is wrong

**If a theme turns out to need a component built differently**, then a theme is not a palette, the
central claim here is false, and the slot contract needs rethinking before people have authored
themes against it.

**If people author unreadable themes and then report the application as broken**, then showing a
contrast figure was not enough information, and what is missing is a better way to say it rather
than a rule that overrides them.

**If custom properties make components hard to test**, because a component's appearance now lives
outside the component, then the trade bought theming at the cost of the thing that keeps a component
layer honest.

**If the neutral component names make the application harder to read for the person building it**,
because every screen is a translation exercise between what the design calls something and what the
component is called, then the vocabulary rule is costing more at this layer than it earns and where
the boundary sits needs revisiting.
