# Advanced Mock Styles — Concept & Behaviour Reference

> *"Advanced playground for the new generation of Celonis platform feel."*

This document is organised into three parts:

- **Part I — The concept** explains *why* this exists and what it produces: the
  ideas we are trying to convey.
- **Part II — The design language** describes *what we are deciding on* — the design
  concepts and behaviours that will become our principles.
- **Part III — Operating the prototype** describes *how the tool itself works* — the
  mechanics we use to explore, capture, and hand off a direction.

(The Feedback feature is intentionally out of scope; it sits on top of the prototype
rather than being part of the concept itself.)

---
---

# Part I — The concept

*The higher-level ideas: what this is, what it produces, and how to think about it.*

## What this prototype is

This is an **internal instrument for the design and product team to define the next
level of Celonis' design** — a live, interactive way to explore how the
next-generation platform should look and feel, and to align on a direction together.

It takes the form of a **design-system playground** wrapped inside a realistic
product surface. Rather than argue about looks in the abstract, the team can re-skin
a genuine, working product in real time and judge every choice in context.

## The prototype vs. the outcome

This is the most important distinction, and it is easy to misread — so it is stated
plainly here.

**What the prototype is.** An exploration tool *for us*. The controls, the live
re-skinning, the guided theme creator, the shared library, and the export tools all
exist to help the design and product team explore options, align on taste, and make
decisions quickly against something realistic. They are scaffolding for a
conversation.

**What the prototype is not.** It is **not** a preview of capabilities we intend to
give customers. End users will not get a controls panel, will not build their own
themes, and will not re-skin the product. The ability to change everything live is a
property of the *tool*, not of the future product. Reading these knobs as upcoming
user features would be a misunderstanding.

**What the outcome is.** The deliverable is a **single agreed configuration** — one
combination of the knobs that we settle on together. Once agreed, that combination
becomes a set of **design principles**: the decided answers to how the
next-generation product should look and behave.

**What we do with the outcome.** Those principles become the foundation. Every asset,
view, and part of the real product is then designed and built *on top of* them —
consistent by construction, because they all descend from the same agreed baseline.

> **In short:** the prototype is *how we decide*; the principles are *what we build
> against*. Everything in Part II is the space of choices we are deciding within — not
> a menu we plan to ship.

## How to think about it: a hierarchy we shape

The single most important framing is this: **the product is a spatial hierarchy, and
the knobs let us reshape it while we decide.**

Every product has an implicit answer to "what is the durable frame, what is the
working surface, and how do the two relate?" Most products bake that answer in. Here
it is a *decision we can make and re-make* — and one decision, the **main layout**,
establishes the entire hierarchy. Everything else then *refines* that base into a
specific look and feel:

- **First** we choose a layout — this defines what feels like fixed chrome, what
  feels like floating content, and how strongly the open asset is bound to the shell.
- **Then** we turn the other knobs to tune brand, energy, sharpness, motion, and
  information density on top of that foundation.

This is why the same product can feel like a calm enterprise workbench, a soft
layered canvas, or a focused IDE — without changing a single screen. The winning
combination is exactly what we will codify as principles, which is why Part II leads
with the layouts and treats everything after them as refinement.

---
---

# Part II — The design language

*The concepts and behaviours we are deciding on. This is the substance that becomes
our principles. It is ordered from the structural foundation outward: first the
skeleton, then material and colour, then content and data.*

## Structural foundation

### The three layouts (the foundation)

This is the flagship concept, and the first decision to make — because the layout
answers *what is fixed, what floats, and how tightly the open asset is bound to the
shell*, and that answer cascades into everything else. The three layouts are not
cosmetic variants; they are three genuinely different hierarchies. Think of them as a
spectrum: **frame-forward → content-forward → asset-forward.**

**Default — a framed workbench.** The Default layout treats the navigation as **fixed
architecture**. The package bar along the bottom, the L1 on the side, and the tab bar
across the top read as static, permanent pieces of the product — the durable frame you
always trust to be there, lightly bordered so they clearly belong to the UI itself
rather than to your content. Within that frame, the **asset is free to fill its area
however it likes.** In a dashboard view, the components (cards, KPIs, charts) are light
while the surrounding canvas is a slightly deeper gray, so they read as **floating
above the surface**, lifted by a soft shadow that establishes elevation. That gray-on-
light contrast creates a clear figure/ground split between "the application" (the
chrome) and "your work" (the assets). It is the most familiar, most conservative, and
lowest-risk of the three — closest to the platform as it exists today.

**Flowy — a floating canvas.** Flowy changes the hierarchy entirely. Instead of many
components floating on a shared gray canvas, the **entire working area is lifted into
one solid panel** — a single clean sheet that holds the whole asset. The tabs and the
package bar stay in the foreground, sitting on a deeper backdrop *behind* that panel
(the backdrop colour is a design choice, not a fixed value — it can be anything we
decide). The L1 detaches from the edge and becomes a **floating island**, much like a
side panel in an IDE. The shell recedes and the workspace steps forward: the feeling
is softer, more layered, and more premium — you work *inside* a distinct object rather
than on top of a frame.

**Flap — a fused editor.** Flap is an evolution of Flowy. It takes that floating panel
and **extends its boundary up into the active tab** — the open tab becomes a *flap*, a
lip of the asset's own body, so tab and content are one continuous surface. Because
the asset and its tab are literally the same shape, the user **understands which asset
is open from the geometry alone.** This is the key idea: selection is communicated by
*form*, so we no longer depend on tab colour, underlines, or fills to say "this one is
active" — the UI itself carries the meaning. It reads as the most focused, most
editor-like of the three, and it is the boldest departure from today. Its one
consequence is that a flap must always stay physically attached to its asset, which is
what drives the side-by-side behaviour described under *Tabs & transitions*.

> **Why these three matter:** each answers "fixed vs. floating vs. fused" differently,
> and that answer changes what tabs must do, how surfaces relate, and where elevation
> and separation live. Choosing the layout is choosing the skeleton; everything below
> is how we dress it. Whichever we pick becomes the structural principle the rest of
> the product inherits.

### Navigation & reveal

The navigation is a two-tier system: **L0** is the top-level, cross-product rail, and
**L1** is the navigation *within* the area you're working in. Because L0 isn't needed
moment-to-moment, it is **hidden by default** so the workspace stays calm and gives the
work its full space, and it is revealed deliberately from the top area of L1 — a
natural, discoverable anchor point.

*How* it reveals is a decision in its own right:

- **Hover to reveal** — the rail appears as you move toward it. Fluid and effortless,
  but inherently a little unpredictable: it can open when you didn't mean it to, and
  its timing is hard to reason about.
- **Click to reveal** — the rail opens only on an explicit click. More deliberate, far
  easier to control, and it never surprises the user.

The rail can also be **pinned open** when someone wants it permanently in view. The
underlying question we're deciding is whether revealing structure should lean toward
fluidity or toward predictability — and the click model leans firmly toward the
latter.

### Tabs & transitions

Because the layout carries so much of the meaning, **tabs play a different role
depending on it.** In Default and Flowy, the active tab needs a visible treatment to
show selection, and that treatment can lean **on-brand** (colour-forward, making
selection a small branding moment) or **off-brand** (a quiet neutral underline or fill,
keeping the workbench calm). In Flap, form already communicates selection, so tab
styling drops to optional decoration rather than a functional necessity — a good
example of how the layout choice ripples outward.

**Transitions** address a specific, familiar pain: today, switching between assets is
*instant and abrupt* — screens simply pop in, with no fade or motion, which feels rough
and disorienting. The concept introduces a **directional slide-and-fade** that doubles
as spatial memory:

- Open a tab to the right of the current one and the new asset **slides in from the
  right** — you feel where it came from.
- Go back to the previous tab and it **slides in from the opposite side** — the motion
  tells you exactly where that asset sits relative to the one you left.

The point isn't polish for its own sake; the direction of the motion quietly builds a
mental map of the tab strip, so the user always knows *where they are* and *where they
just came from*.

**Flap in side-by-side.** When two assets are opened side by side under Flap, each flap
must stay bound to *its own* asset body — otherwise the "tab and asset are one object"
promise breaks. So as the split opens, the flaps **traverse the tab strip**, pushing
the other tabs aside, until each one sits anchored directly above the pane it belongs
to; and they keep tracking their pane as the divider is dragged and the panes resize.
The result is that even with two editors on screen, every flap remains visibly, and
consistently, tied to its asset.

### Surfaces: finish, elevation & corners

On top of the layout hierarchy, surfaces carry their own decisions.

**Surface finish — flat vs. frosted.** This decides whether an asset's surface is
opaque or lets its context show through:

- **Flat** — a solid colour. Content sits on it cleanly and nothing behind it is
  visible. Maximum legibility, the safe and functional default.
- **Frosted** — translucent, so what's behind the surface is partially revealed. If a
  view carries a background image, or two components overlap, they **bleed** through
  the frost. This buys depth, richness, and a sense of material — at some cost to
  legibility, so it's an expressive choice rather than a universal one.

**Corner language (radius).** Sharpness is a deliberate, tunable lever, split into two
independent controls: **surface radius** (the panels and cards) and **control radius**
(buttons, inputs, and smaller elements). Keeping them separate means we can, say, hold
panels crisp while softening the controls, or the reverse. This matters because our
brand is not especially round — the ability to dial corners from soft to sharp lets the
look be tailored to the brand instead of defaulting to generic roundness.

**Emphasis by inversion.** Any single component can have its **surface inverted** to
turn it into a focal point. A KPI card that is light in light mode becomes dark in
light mode (and light in dark mode) — it flips against its surroundings on purpose, so
it becomes the **visual anchor** the eye lands on first when arriving on a page. It is
a deliberate, per-component exception to the global theme, meant to be used sparingly
for the one thing that matters most on a screen.

## Material & colour

### Colour, energy & glass

Colour and material are axes that combine freely with any layout — the "energy" laid
over the structural skeleton:

- **Palette** — *Mono* (single-ink calm and restraint, maximally enterprise), *Color*
  (one controlled brand hue, brand-forward but disciplined), or *Vivid* (multi-hue
  storytelling with selectable colour combos, for expressive, chart-heavy dashboards).
  A key principle: palette recolours only the **visualizations** — the surfaces stay
  consistent — so colour energy lives in the data while the structure stays neutral and
  never shifts underfoot.
- **Brand colour** — the accent used for active states and emphasis.
- **Intensity** — a global dial for how expressive shadow, gloss, and glass feel: Calm,
  Strategic, or Expressive. It scales the overall visual richness in one move.
- **Glass** — how translucent and diffused the shell's overlays and panels feel, from
  flat and opaque (functional) to full liquid glass (immersive and premium).

### Typography

The product uses the Inter typeface with special treatment for numerals, because
dashboards are largely numbers and the figures carry much of the product's character.
A **slashed zero** disambiguates 0 from O, and **alternate digit shapes** give a more
geometric, modern figure set — together a slicker, more distinctive read. Numerals can
also shift between **sans** (broad readability), **tabular mono** (columns align for
scanning), and **serif** (editorial, executive gravitas), at a chosen weight.

## Content & data

### Data visualization

Charts are first-class, because analytical products live or die on how their data
reads.

**A spectrum of depth.** The same chart can be rendered in four ways, each with a
different trade-off:

- **Flat** — fast, precise, legible, editorial. The workhorse and the favourite.
- **Isometric** — dimensional bars and tilted surfaces for hero impact, at some cost to
  reading exact values.
- **Glass** — glossy, translucent chart materials that match frosted surfaces; premium,
  but heavier.
- **WebGL** — real, interactive 3D scenes you can orbit; the most impressive and the
  most expensive.

Because depth has a cost, there's a scope choice too: apply it to **the hero chart
only** (reserve the drama for the focal visual) or to **every chart**.

**Fill style, and brand DNA.** In the flat style, series can be filled two ways:

- **Classic** — solid colour, series separated by hue.
- **Pattern** — geometric textures (hatching, dots, crosshatch) over each series.

The pattern option is more than accessibility (though it does let series read without
relying on colour). It **echoes the brand's own visual language** — the way we use
geometry and geometric shapes to convey meaning, and the procedural generation in our
motion design. It is a point where **brand DNA leaks into the product**: the same
generative, geometric thinking shows up in a working dashboard, creating genuine shared
identity between brand and product.

Charts also stay honest and useful: they size themselves to their space, re-render as
the layout changes, and reveal their underlying values on hover.

### Density — designed for an IDE

This is a working environment, not a spacious marketing surface, and it has to serve
many different asset types — so information density is a first-class control rather than
an afterthought:

- **Spacious** — airy and readable, for executive-level views.
- **Compact** — more information while keeping comfortable targets.
- **Dense** — maximum throughput, packing the largest number of rows into a view so a
  power user never misses an important detail.

Density adjusts spacing, padding, and table row height together, and it is the
pragmatic counterweight to elegance: whatever look we choose has to survive real,
crowded, analytical screens.

---
---

# Part III — Operating the prototype

*How the tool itself works — the mechanics we use to explore a direction, converge on
one, and hand it off. These are properties of the instrument, not features of the
future product.*

## Capturing a direction (themes)

Any combination of the concepts in Part II can be captured as a named **theme**.
Within the exploration a theme is simply a *candidate direction* — a way to freeze a
look so it can be revisited, compared, and discussed.

- **Save, name, duplicate, rename, delete**, each shown as a small live preview that
  visualizes what the theme actually does.
- **Drift awareness** — when live settings diverge from the applied theme, it is
  flagged as *Modified*, so it is always clear whether you're viewing a saved
  candidate or an unsaved experiment.
- **A shared library** — themes can sync to a team library, tagged by author, so the
  whole team explores against each other's work. Sharing is non-destructive.
- **Graceful offline** — with no shared backend, it degrades to a private library
  without breaking.

Themes are the mechanism of *converging*: many candidates during exploration,
narrowing to one. The agreed candidate is what crystallizes into the design principles
described in Part I.

## The Theme Creator (guided path)

Alongside the expert controls, a guided creator walks a team member through building a
candidate step by step: atmosphere, colour language, visual energy, shell and
surfaces, content treatment, and data-visualization style, then review and save. It
previews on the **real product**, is **reversible until you save**, makes **smart
related choices** so someone who doesn't want to touch every lever still reaches a
coherent result, and produces a **normal theme** that joins the same shared library.
Two doors into the same room — a fast expert panel and a guided path — both for the
team, both feeding the same decision.

## Comparing & focusing

Two interactions support the convergence loop:

- **Side by side** — any two candidate assets or looks can be opened in a resizable
  split, each scrolling and reflowing independently. This is how directions are
  compared directly, and it is where the Flap traversal behaviour keeps each flap bound
  to its asset.
- **Detail on demand** — a master list can reveal a record as a sliding drawer over
  the current screen, mirroring the master → detail pattern real products rely on,
  without losing your place.

## Hand-off

Once a direction is agreed, it has to leave the prototype and become real work — so
two hand-off paths turn the decision into usable artifacts for design and build:

- **Figma package** — the agreed look can be exported as an importable package of
  every screen, as both an editable, layer-aware representation and a pixel-perfect
  reference, plus the underlying design tokens — no authentication or setup needed.
- **Screenshots** — the whole prototype can be captured as images of every screen and
  key modal, for quick review and sign-off.

This is the bridge from a decided direction to the principles and assets the real
product is built on.

## Access

The prototype is a protected preview. Getting in is a simple, one-time step per device,
so it can be shared with the small group involved in the decision without leaking, and
never gets in the way once you're in.

---
---

## In one sentence

**An internal instrument for exploring how the next-generation Celonis product should
look and feel — where we shape a spatial hierarchy (framed workbench, floating canvas,
or fused editor) and refine it with brand, motion, material, and density — whose real
output is not the tool itself but a single agreed set of design principles the product
is then built on.**
