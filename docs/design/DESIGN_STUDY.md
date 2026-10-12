# brightwheel Front Desk - Design Study

Status: working design direction for the take-home prototype.
Scope: parent chat surface and operator (director) dashboard.
Author role: creative direction and design research.

## How to read this document

Every factual claim about brightwheel carries a label.
**Verified** means it was read directly from a public brightwheel source (the inline CSS custom properties on https://mybrightwheel.com/ or the launch post at https://mybrightwheel.com/blog/bringing-ai-to-brightwheel).
**Inferred** means it is our reading of the brand from observation, or a design decision we are making on brightwheel's behalf.
Contrast ratios were computed with the WCAG 2.x relative luminance formula, not estimated.

## 1. Executive summary: brightwheel, one step forward

The thesis is simple: this should look like brightwheel shipped it next quarter, not like a stranger redesigned it.
We keep every brand color, the rounded friendly geometry, the lowercase wordmark voice, and the plain-language tone.
We move one step forward in three places where AI products have raised user expectations since brightwheel's visual system was set.

1. **Depth and calm.** Softer layered shadows tinted with blackout (#1E2549) instead of neutral gray, larger radii on surfaces, and more air between groups, so a stressed parent at 7:40 am sees one clear thing at a time.
2. **AI that announces itself, but only when it acts.** A single signature gradient built from the brightwheel logo wheel (blurple, plum, flamingo, caribbean) marks every place the assistant is speaking or working, and nowhere else.
3. **Trust made visible.** Every answer shows where it came from, every sensitive phrase is handled gently in the open, and the director always sees what the AI said and can correct it.

That third point is not our invention.
brightwheel AI launched on October 6, 2026 as read-only, with proactive Spotlight cards, director approval, and thumbs-up and thumbs-down feedback (**Verified**, launch post).
Front Desk extends the same contract to the parent-facing surface: the AI answers from the center's own handbook, cites it, hands off to a human when it should, and the director reviews everything in one place.

The design goal in one line: **a parent should feel the center is answering, and a director should feel in control of what the center is saying.**

## 2. brightwheel brand audit

### 2.1 Color system

All hex values below are **Verified** from `--wp--preset--color--*` custom properties on mybrightwheel.com.
Role names in the second column are brightwheel's own token names where present; the "Front Desk role" column is **Inferred** (our assignment).
Contrast is against white (#FFFFFF) and against charcoal (#18181D).
AA requires 4.5:1 for normal text and 3:1 for large text (18.66px bold or 24px regular) and for UI components.

#### Blues (brand core)

| Token | Hex | Front Desk role | vs white | vs charcoal | Text on white |
|---|---|---|---|---|---|
| primary / blurple | #5463D6 | accent, links, primary button | 5.08 | 3.48 | AA normal |
| barney | #6476FF | selected state, chart series 1 | 3.77 | 4.70 | large only |
| butterfly | #B1BAFF | focus ring halo, AI glow tint | 1.85 | 9.55 | never as text |
| barnacle | #EEF1FF | accent tint, selected row | 1.13 | 15.72 | background only |
| bubble | #F7F9FF | parent app canvas | 1.05 | 16.80 | background only |
| blueberry | #37458A | accent pressed, strong headings | 8.82 | 2.01 | AAA |
| blackout | #1E2549 | primary ink, shadow tint | 14.83 | 1.19 | AAA |

The key finding: **blurple #5463D6 on white is 5.08:1, so it passes AA for normal text, and white text on a blurple button is also 5.08:1 and passes AA for normal text.**
That means the brand primary can carry body-size link text and a standard 15-16px button label without modification.
It does not reach AAA (7:1), so we never use blurple for long paragraphs; it is reserved for links, labels, and controls.
Blurple on barnacle (#EEF1FF) is 4.52:1, which passes AA by a hair, so accent-on-tint pills must use 600 weight and never go below 13px.

#### Supporting hues

| Family | Tokens (hex) | vs white (darkest usable text) | Front Desk role (Inferred) |
|---|---|---|---|
| Purple | plum #7E42EB, pansy #5524AE, peace #F6F1FF, pearl #FBF8FF, grape #BE34C4 | plum 5.43, pansy 9.33 | AI gradient stop, AI tint surfaces |
| Teal | caribbean #29B9BB, canteen #03A39C, canoe #057577, cruise #E4F8F8 | canoe 5.50 | AI gradient stop, "Open now" |
| Pink | flamingo #EE2F88, foxglove #BC0C5E, flower #FFEDF5 | foxglove 6.26 | AI gradient stop, celebration accents |
| Coral | salmon #FF5B60 (CTA), hover #FF3C42, strawberry #CF193A (error), sweet #FFEFEE | strawberry 5.45 | marketing CTA, danger |
| Yellow | lemon #FECC38 (warning), landmark #896507, lighthouse #FFF5D2 | landmark 5.35 | warning, Privacy Guard highlight |
| Orange | tangerine #FF9D17, terracotta #A35319, tumbleweed #FFF1DC | terracotta 5.51 | chart series, "closing soon" |
| Green | joker #3BBA6E (success), jungle #21774E, jellyfish #E3F8ED | jungle 5.51 | success |
| Blue | water #49A8F3 (info), wizard #1570B9, winter #E7F4FF | wizard 5.19 | info |

A consistent pattern runs through the palette (**Inferred**): every family ships a vivid mid-tone, a dark text-safe tone, and a pale tint.
We lean on that triad for every status: vivid for icons and dots, dark for text, tint for backgrounds.

The brand CTA salmon #FF5B60 is a contrast trap.
White on salmon is 3.04:1 and white on the hover #FF3C42 is 3.51:1, both of which fail AA for normal text.
On the marketing site this is tolerable because CTAs are large and bold (**Inferred**).
In the product we make **blurple the primary action color** and use salmon only for non-text accents or with blackout text (4.88:1, passes AA).

#### Neutrals

| Token | Hex | Front Desk role | vs white | vs charcoal |
|---|---|---|---|---|
| charcoal | #18181D | reserved for dark-mode surfaces near black | 17.69 | 1.00 |
| graphite | #5C5E6A | ink-muted (secondary text) | 6.43 | 2.75 |
| miners-coal | #737685 | placeholder text on white only | 4.51 | 3.92 |
| steel | #898D96 | disabled icons, never text | 3.33 | 5.32 |
| stardust | #BABEC6 | strong borders, input outlines | 1.86 | 9.49 |
| cement | #D5D9DF | hairline borders | 1.42 | 12.48 |
| cloud | #EBEFF4 | dividers, skeleton base | 1.15 | 15.32 |
| air | #F7F9FB | operator canvas | 1.06 | 16.76 |

Miners-coal clears AA on pure white (4.51) but falls to 4.27 on air, so secondary text uses graphite everywhere and miners-coal is limited to placeholders inside white inputs.

#### Logo wheel

The logo wheel uses #5463D6, #29B9BB, #FC47AD, #FF543E, #FBA32A, #FECC38, #4FA06A, #5D688E (**Verified**).
The wheel is the brand's most recognizable multi-color moment (**Inferred**), which is why our AI gradient borrows from it rather than importing a generic purple-to-blue "AI" gradient.

### 2.2 Type

The site font stack is `"AvenirNext", "Helvetica Neue"` (**Verified**).
Avenir Next is a geometric humanist sans: round bowls, open apertures, friendly but not childish (**Inferred**).
It is a licensed face, so the prototype cannot ship it.
Our stand-in is covered in section 4.4.

### 2.3 Shape

Radii of 6, 8, and 12 pixels and pill-shaped CTAs appear in the site CSS (**Verified**).
The overall shape language is soft and rounded without being bubbly (**Inferred**).
We extend the scale upward (16, 20, 28) for app surfaces and sheets, which is the "one step forward" move: modern mobile platforms have trained users to read large-radius containers as touchable, lifted layers.

### 2.4 Spacing

The site spacing presets run 5, 10, 15, 20, 30, 40, 50, 60, 80, 100 (**Verified**).
That is a 5px rhythm tuned for marketing pages.
Product UI needs finer steps for dense tables and icon alignment, so we move to a 4pt grid (section 4.8) while keeping the generous macro spacing between sections.

### 2.5 Elevation

The marketing site relies mostly on flat color blocks and photography, with light shadows on cards (**Inferred**).
We introduce a named elevation scale with shadows tinted toward blackout, which keeps shadows from looking dirty gray on blue-tinted canvases.

### 2.6 Iconography

brightwheel's product and marketing icons read as rounded, medium-stroke line icons (**Inferred**).
We use Lucide at 1.75px stroke with rounded caps and joins, which matches that feel and is tree-shakable.
Icons are 20px in the parent app and 16px in dense operator tables, always paired with a text label except for universally understood glyphs (close, send, back).

### 2.7 Photography and illustration

brightwheel's marketing leans on warm, real classroom photography of children, teachers, and families, plus flat illustration in the palette (**Inferred**).
The prototype uses no stock photos of children.
We rely on color, type, and a small set of icon-led empty states, because fake photography in a demo undermines trust faster than no photography.

### 2.8 Voice and tone

The brand writes its name in lowercase: "brightwheel" (**Verified**).
The voice is warm, plain, and reassuring, written for busy parents and overworked directors rather than for software buyers (**Inferred**).
Front Desk copy rules:

- Answer first, then the detail. "Yes, we're open Monday. Drop-off starts at 7:00." not "According to our records, the center will be operating..."
- Use the center's voice ("we"), not the AI's ("I am an AI assistant").
- Name the source in human terms: "From the Family Handbook, p. 12."
- Say "I'm not sure" plainly, then hand off: "I've asked Ms. Rivera to follow up today."
- Never make a parent feel scolded. Privacy Guard says "I left out the medical detail so it stays private," not "Sensitive data detected."
- Sentence case everywhere. No exclamation marks in system messages; one is allowed in a celebration toast.

## 3. Reference study

For each reference we took only the principles that align with brightwheel's audience (parents on phones, directors at desks between tasks) and wrote down exactly where they show up in Front Desk.
Characterizations of these systems are our reading of their public guidelines and shipped products (**Inferred** unless noted).

### 3.1 Airbnb (Design Language System)

| Principle | How Front Desk applies it |
|---|---|
| Unified: every component belongs to one family | One radius scale, one shadow scale, one icon set shared by parent and operator views. |
| Conversational: UI that reads like a helpful host | Answer cards open with a direct sentence in the center's voice, not a data dump. |
| Large, warm, tappable cards | Event cards and answer cards use 20px radius, generous padding, and the whole card is the tap target. |
| Trust signals in context | Citations sit inside the answer card, the way reviews sit next to a listing, not in a footnote. |

### 3.2 Apple Human Interface Guidelines

| Principle | How Front Desk applies it |
|---|---|
| Clarity, deference, depth | Content is the hero; chrome recedes to translucent bars; sheets visibly sit above the chat. |
| 44 by 44 pt minimum hit target | Every interactive element is at least 44px, including chip rows and table row actions. |
| Sheets with detents | Tuition and event details open in a bottom sheet with a grabber and medium and large detents. |
| Respect system settings | Dark mode, Dynamic Type equivalents (rem-based type), and Reduce Motion are honored from day one. |

### 3.3 Uber Base

| Principle | How Front Desk applies it |
|---|---|
| Semantic tokens over raw values | Components reference `--accent`, `--ink-muted`, never `#5463D6` directly. |
| Strong hierarchy through type weight and size, not color | Stat card numbers are large and bold in ink; color is reserved for status. |
| Systematic states | Every component specs default, hover, pressed, focus, disabled, loading, and error. |

### 3.4 Uber Eats

| Principle | How Front Desk applies it |
|---|---|
| Real-time status that is legible at a glance | The "Open now" pill with a soft pulse and the "closes at 6:00" line read in under a second. |
| Progress you can feel | While the AI answers, a three-step status ("Checking handbook", "Writing answer") replaces a blank spinner. |
| Bottom-anchored primary action | The ask bar lives in the thumb zone and never scrolls away. |

### 3.5 Stripe

| Principle | How Front Desk applies it |
|---|---|
| Dense but calm operator UI | The dashboard uses 13-14px table text, tabular numerals, hairline borders, and no zebra stripes. |
| Precise data formatting | Money always shows currency and cents ("$1,450.00 / month"), dates are unambiguous ("Mon, Oct 13"). |
| Documentation-grade clarity | Tuition tables have clear column headers, right-aligned numbers, and footnotes linking to the source policy. |
| Gradient as a signature, used sparingly | Our AI gradient appears in a few precise places, not as wallpaper. |

### 3.6 Google Gemini

| Principle | How Front Desk applies it |
|---|---|
| The input is the invitation | The ask bar carries a soft gradient glow on focus, signalling that this box is the product. |
| Gradient means "AI is here" | The conic gradient appears on the ask bar, AI answer card edge, and AI drafts in the dashboard, only. |
| Suggested prompts lower the blank-page cost | Suggestion chips sit above the ask bar on first open and after each answer as follow-ups. |
| Shimmer while thinking | A gradient shimmer on the answer skeleton, replaced instantly by text as it streams. |

### 3.7 Linear

| Principle | How Front Desk applies it |
|---|---|
| Speed is a feature | Optimistic UI for director actions (approve, edit, resolve) with undo toasts instead of confirm dialogs. |
| Keyboard-first operator workflows | `/` focuses search, `j` and `k` move through the inbox, `e` edits an AI draft. |
| Restraint with color | The dashboard is mostly ink, graphite, and air; color appears only for status and AI. |

### 3.8 Notion

| Principle | How Front Desk applies it |
|---|---|
| Content-first, editable in place | Directors fix a wrong answer by editing the source FAQ inline from the conversation view. |
| Friendly empty states | Empty inbox shows a calm illustration-free message and one next step, never a dead end. |
| Calm typography | Body text at 16px with 1.5 line height on the parent side; no all-caps headings. |

## 4. Token spec we will implement

All tokens are CSS custom properties on `:root`, overridden for dark mode under `prefers-color-scheme: dark` and `[data-theme="dark"]`.
Values are **Inferred** design decisions built on **Verified** brand hex values.

### 4.1 Semantic color tokens

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--canvas` | #F7F9FF (bubble, parent) / #F7F9FB (air, operator) | #0F1120 | Page background |
| `--surface` | #FFFFFF | #15172B | Cards, inputs |
| `--surface-raised` | #FFFFFF + shadow-2 | #1B1F38 | Sheets, popovers |
| `--surface-sunken` | #EBEFF4 (cloud) | #0B0D19 | Table headers, wells |
| `--ink` | #1E2549 (blackout) | #E6E8F5 | 14.83:1 light, 15.36:1 dark |
| `--ink-muted` | #5C5E6A (graphite) | #9EA3B8 | 6.43:1 light, 7.48:1 dark |
| `--ink-placeholder` | #737685 (miners-coal) | #7C8199 | Inputs on white only |
| `--border` | #D5D9DF (cement) | #2D3356 | Hairlines |
| `--border-strong` | #BABEC6 (stardust) | #3D4470 | Input outlines (meets 3:1 with focus ring added) |
| `--accent` | #5463D6 (blurple) | #8F9BFF | 5.08:1 light, 7.40:1 dark |
| `--accent-hover` | #4351C4 | #A3ADFF | Hover darkens in light, lightens in dark |
| `--accent-pressed` | #37458A (blueberry) | #B1BAFF | |
| `--accent-tint` | #EEF1FF (barnacle) | #232848 | Selected rows, accent pills |
| `--on-accent` | #FFFFFF | #0F1120 | 5.08:1 light, 7.40:1 dark |
| `--focus-ring` | 2px #5463D6 + 4px #B1BAFF halo | 2px #8F9BFF + 4px rgba(143,155,255,.35) | Always visible on keyboard focus |

`--accent-hover` #4351C4 is a derived step between blurple and blueberry (6.54:1 with white text), chosen because the brand palette has no shade at that position.

### 4.2 Status tokens

Each status is a triad: a vivid dot or icon color, a text color that passes AA on its own tint, and a tint background.

| Status | Icon (vivid) | Text | Tint | Text on tint | Dark text / tint |
|---|---|---|---|---|---|
| success | #3BBA6E joker | #21774E jungle | #E3F8ED jellyfish | 4.96 | #6EE0A0 on #16302A |
| warning | #FECC38 lemon | #896507 landmark | #FFF5D2 lighthouse | 4.90 | #FFD966 on #332B12 |
| danger | #CF193A strawberry | #CF193A strawberry | #FFEFEE sweet | 4.89 | #FF8A8F on #3A1A22 |
| info | #49A8F3 water | #1570B9 wizard | #E7F4FF winter | 4.64 | #7CC4FF on #132B44 |
| ai | conic gradient | #7E42EB plum | #F6F1FF peace | 4.90 | #B98CFF on #241B3D |

Dark status text values were checked against the raised dark surface #1B1F38: success 9.87, warning 11.83, danger 7.14, info 8.62, ai 6.35.
Against their own dark tints they hold at 8.61, 10.28, 6.87, 7.69, and 6.36 respectively.

### 4.3 The AI gradient

```css
--ai-gradient: conic-gradient(from 210deg,
  #5463D6, #7E42EB, #EE2F88, #29B9BB, #5463D6);
--ai-gradient-linear: linear-gradient(100deg,
  #5463D6 0%, #7E42EB 35%, #EE2F88 70%, #29B9BB 100%);
```

Stops come from blurple, plum, flamingo, and caribbean, which are the brand's own primary, purple, pink, and teal (**Verified** hex values).
Text is never placed on the gradient: white on flamingo is 3.89:1 and white on caribbean is 2.40:1, so the gradient is only ever a border, glow, or shimmer.

### 4.4 Type

**Typeface: Figtree**, loaded through `next/font/google` with `display: swap` and the variable axis (300-800).
Justification:

- Figtree is a geometric sans with round bowls, a single-story "a" option feel, and open apertures, which is the closest free match to Avenir Next's friendly geometry among Google Fonts (**Inferred**).
- It is designed for UI legibility at small sizes, which matters for the 13px operator tables.
- `next/font` self-hosts it at build time: no third-party request, no layout shift via size-adjusted fallback, and only the Latin subset ships.
- The stack falls back to the brand's own fonts if installed: `var(--font-figtree), "AvenirNext", "Avenir Next", "Helvetica Neue", system-ui, sans-serif`.

Numerals use `font-variant-numeric: tabular-nums` in tables, stat cards, and tuition amounts.

| Token | Size / line height | Weight | Use |
|---|---|---|---|
| `display` | 32 / 38 | 700 | Operator page titles, parent welcome |
| `title-1` | 24 / 30 | 700 | Section headers, stat values |
| `title-2` | 20 / 26 | 650 | Card titles, sheet titles |
| `headline` | 17 / 24 | 600 | Answer lead sentence, event names |
| `body` | 16 / 24 | 400 | Parent chat body (minimum on mobile) |
| `body-dense` | 14 / 20 | 400 | Operator body and tables |
| `label` | 13 / 18 | 600 | Pills, chips, column headers |
| `caption` | 12 / 16 | 500 | Timestamps, citations meta |

Letter spacing is -0.01em at 20px and above, 0 below.
No all-caps except two-letter abbreviations.
Parent inputs are 16px or larger so iOS Safari does not zoom on focus.

### 4.5 Radii

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6px | Tags inside tables, kbd hints (brand verified value) |
| `--radius-input` | 8px | Inputs, small buttons, table action buttons |
| `--radius-card-sm` | 12px | Chips containers, citation cards, stat cards |
| `--radius-surface` | 16px | Operator panels, side drawer inner cards |
| `--radius-surface-lg` | 20px | Answer cards, event cards in parent chat |
| `--radius-sheet` | 28px | Bottom sheet top corners |
| `--radius-pill` | 999px | Primary buttons, chips, status pills, ask bar |

Nested radii follow the rule outer = inner + padding, so a 12px card inside a 20px card sits on 8px padding.

### 4.6 Shadows

Shadows are layered (a tight contact shadow plus a wide ambient one) and tinted with blackout #1E2549 at low alpha.

```css
--shadow-1: 0 1px 2px rgba(30,37,73,.06), 0 1px 1px rgba(30,37,73,.04);
--shadow-2: 0 2px 4px rgba(30,37,73,.05), 0 8px 24px rgba(30,37,73,.08);
--shadow-3: 0 4px 8px rgba(30,37,73,.06), 0 16px 48px rgba(30,37,73,.14);
--shadow-ai-glow: 0 0 0 1px rgba(126,66,235,.18), 0 8px 32px rgba(84,99,214,.22);
```

| Level | Use |
|---|---|
| 1 | Cards at rest, stat cards |
| 2 | Ask bar, hovered cards, popovers |
| 3 | Bottom sheet, side drawer, toasts |

In dark mode shadows lose meaning, so elevation is expressed by lighter surfaces (#15172B, #1B1F38, #232848) plus a 1px top highlight `inset 0 1px 0 rgba(255,255,255,.04)`.

### 4.7 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 100ms | Press feedback, checkbox |
| `--dur-quick` | 160ms | Hover, chip select, toast exit |
| `--dur-base` | 240ms | Card enter, drawer fade |
| `--dur-sheet` | 320ms | Sheet and drawer slide |
| `--ease-standard` | cubic-bezier(.2, 0, 0, 1) | Most transitions |
| `--ease-enter` | cubic-bezier(.05, .7, .1, 1) | Things arriving |
| `--ease-exit` | cubic-bezier(.3, 0, .8, .15) | Things leaving |
| `--ease-spring` | cubic-bezier(.34, 1.36, .64, 1) | Chip tap, success check only |

Reduced-motion policy: under `prefers-reduced-motion: reduce`, all translate and scale animations become opacity-only crossfades at 120ms or less, the "Open now" pulse stops (a static dot remains), the gradient shimmer becomes a static tint, and streaming text appears in sentence chunks rather than a typewriter effect.
Nothing essential is ever communicated by motion alone.

### 4.8 Spacing and touch targets

Spacing uses a 4pt grid: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80.
Parent screens use a 16px side gutter on phones and 24px on tablet.
Operator panels use 24px internal padding and a 32px gap between major regions.
Every interactive target is at least 44 by 44px; visually smaller elements (a 32px icon button in a table row) extend their hit area with padding or a pseudo-element.
Adjacent targets keep at least 8px between hit areas.

## 5. Signature elements

### 5.1 The AI gradient, used only where AI acts

The rule: if the gradient is on screen, the AI is speaking, thinking, or has drafted something a human has not yet approved.
Allowed placements:

- The ask bar border and glow on focus (parent).
- A 2px gradient top edge on AI answer cards, plus a small sparkle glyph and "Front Desk" label.
- The skeleton shimmer while an answer is generating.
- The left edge of AI-drafted replies awaiting director review in the dashboard.
- The "Spotlight" style insight card on the operator home, echoing brightwheel AI's proactive cards (**Verified** feature name).

Not allowed: buttons, headers, marketing banners, charts, human-written messages, or decoration.
Scarcity is what keeps the gradient meaningful; once a director approves a draft, its gradient edge turns into a plain accent edge, which visually records "a human signed off."

### 5.2 The glowing ask bar

A pill-shaped input, 56px tall, anchored above the safe area with 12px margin.
At rest: white surface, 1px `--border-strong`, shadow-2, placeholder "Ask about hours, tuition, menus..." in miners-coal.
On focus: the border is replaced by a 1.5px conic gradient ring (mask technique) and `--shadow-ai-glow`, animated by rotating the gradient angle once over 1200ms, then holding still.
The send button is a 40px blurple circle inside the pill, disabled (steel icon on cloud) until text exists.
A visible keyboard focus ring is still drawn outside the glow, because a glow alone is not a focus indicator.

### 5.3 Answer cards

Structure top to bottom: AI label row (sparkle, "Front Desk", timestamp), headline sentence in `headline` weight, supporting body, then a citation row of 12px-radius source chips ("Family Handbook - Holidays").
Actions sit in a footer: thumbs up, thumbs down (mirroring brightwheel AI's feedback model, **Verified**), and "Ask a staff member."
When confidence is low or the topic is out of scope, the card swaps to an info-tint variant that says so and offers the handoff as the primary button.

### 5.4 Status pills

Pill radius, 24px tall (inside a 44px row hit area), `label` type, a 6px vivid dot, text in the status text color, background in the status tint.
States: Open now (success), Closing soon (warning), Closed (neutral cloud and graphite), Needs review (ai), Escalated (danger), Resolved (success).
Dot plus word, never color alone.

### 5.5 "Open now" pulse

A 6px joker green dot with a ring that scales from 1 to 2.2 and fades from 0.35 to 0 every 2400ms, ease-out.
It pulses only when the center is open; closed state shows a static steel dot.
Reduced motion: static dot only.

### 5.6 Privacy Guard visuals

Privacy Guard catches sensitive details (a child's medical condition, custody notes, another family's name) before they leave a message or appear in an answer.
The goal is protection without alarm, so red is reserved for the single case where a send is blocked.

| Situation | Treatment |
|---|---|
| Parent types a sensitive detail | The span gets a lighthouse #FFF5D2 background with a 1.5px dashed landmark #896507 underline and a small shield icon at the end. |
| Inline explanation | A caption below the input in graphite: "Medical details go to staff only, not the assistant. Tap to send privately." |
| AI answer omits a detail | A neutral redaction chip ("child's name hidden") on cloud with graphite text, not a black bar. |
| Operator sees a guarded message | The span shows in a peace #F6F1FF tint with a shield and "Shared privately with staff" tooltip. |
| Send actually blocked | Only here: strawberry text on sweet tint, with a clear next action. |

Landmark on lighthouse is 4.90:1, so the highlighted span stays readable.
The tone is "we've got this," not "you made a mistake."

### 5.7 Operator dashboard density

The parent side is roomy; the operator side is dense, in the Stripe and Linear tradition.
Body text drops to 14px, table rows to 44px, panels sit on the air canvas with 1px cement borders and shadow-1.
A left rail (240px, collapsible to 64px) holds navigation; a top region holds four stat cards; the main region is a conversation inbox with a side drawer for detail.
Color is spent only on status pills, AI markers, and one chart accent, so a director's eye goes straight to what needs action.

## 6. Component inventory

| Component | Do | Don't |
|---|---|---|
| Ask bar | Keep it pinned in the thumb zone, 16px+ text, gradient ring on focus only, clear send affordance. | Hide it behind a FAB, animate the gradient continuously, or let the keyboard cover it. |
| Suggestion chips | 3-4 short, specific chips ("Is school open Monday?"), horizontally scrollable, 44px tall hit area, accent-tint fill. | Write vague chips ("Ask me anything"), wrap to 3 lines, or show more than one row on phones. |
| Answer card with citations | Lead with the answer sentence, show sources as tappable chips that open the exact excerpt, offer thumbs and handoff. | Bury the answer under caveats, cite without a link, or style human staff replies with the AI gradient. |
| Event card + add to calendar | Show date block (day and month), title, time range, location, and an "Add to calendar" secondary button producing an .ics file. | Use relative dates alone ("next Friday"), or make the whole card trigger a download. |
| Tuition table | Right-align money with tabular numerals, include currency and period, group by program, footnote the policy source, collapse to stacked rows under 480px. | Use horizontal scroll on phones, mix "/mo" and "monthly," or round amounts. |
| Bottom sheet | Grabber, 28px top radius, medium and large detents, scrim at 40% blackout, focus trapped, Escape and swipe to close. | Stack sheets on sheets, put the primary action off-screen, or block back navigation. |
| Side drawer (operator) | 480px from the right, shadow-3, keeps the inbox visible behind it, deep-linkable URL. | Use a center modal for detail views or lose the inbox scroll position on close. |
| Stat cards | One number in `title-1` tabular, one label, one trend line in muted text with arrow and word ("up 12% vs last week"). | Use color alone for trend direction, show more than one number, or add sparkline noise without axes. |
| Chart | One accent series (blurple) plus a muted comparison (stardust), direct labels, accessible table fallback, 3:1 against background for marks. | Rainbow categorical palettes, the AI gradient as a fill, or dual axes. |
| Tables | Sticky header on sunken surface, 44px rows, hover tint, row actions revealed on hover and always available on focus, keyboard navigable. | Zebra stripes plus borders together, truncated text without a tooltip, or icon-only actions without labels. |
| Empty states | One sentence of what will appear, one next action, a calm icon in accent-tint circle. | Blame the user, use cute filler copy, or leave a blank panel. |
| Skeleton loaders | Match final layout shape, cloud base with a slow 1600ms shimmer, AI-gradient shimmer only for generating answers. | Spin a generic spinner for over 400ms, or shift layout when content lands. |
| Toasts | Bottom center on mobile, bottom left on desktop, shadow-3, 4-6s with undo for reversible actions, `role="status"`. | Use toasts for errors that need action, stack more than two, or auto-dismiss something the user must read. |

## 7. Accessibility and performance as design constraints

These are constraints we design inside, not checks we run at the end.

### 7.1 Accessibility

- **Contrast floors.** Body text 4.5:1 minimum, and our ink pairings land at 14.83:1 (light) and 15.36:1 (dark); muted text at 6.43:1 and 7.48:1; every status text passes AA on its own tint (lowest is accent on barnacle at 4.52:1, mitigated with 600 weight).
- **No text on the gradient or on salmon with white.** Both fail AA; the tokens make it impossible by design.
- **Never color alone.** Every status carries a word and an icon or dot; charts carry direct labels.
- **Focus is always visible.** The 2px accent ring with butterfly halo is drawn with `:focus-visible` on every control, including inside the glowing ask bar.
- **Targets.** 44px minimum, 8px spacing between adjacent targets.
- **Semantics.** The chat log is a `role="log"` with `aria-live="polite"`; streaming answers announce once on completion rather than per token; sheets and drawers are dialogs with focus trap and return focus.
- **Zoom and reflow.** rem-based type, layouts reflow at 320px width and 200% zoom without horizontal scroll.
- **Motion.** Full reduced-motion policy in section 4.7.
- **Plain language.** Answers target roughly a 6th to 8th grade reading level; many parents read on the move or in a second language (**Inferred**).

### 7.2 Performance

- **Fonts.** One variable family through `next/font`, self-hosted, Latin subset, size-adjusted fallback to avoid layout shift.
- **CSS over JS for visuals.** Gradient ring, glow, pulse, and shimmer are pure CSS using `transform` and `opacity` only, so they run on the compositor.
- **Server components by default.** Static content (tuition, events, handbook excerpts) renders on the server; only the ask bar, chat stream, and dashboard interactions hydrate.
- **Streaming.** Answers stream so first words appear quickly; the skeleton holds layout so cumulative layout shift stays near zero.
- **Icons tree-shaken.** Import individual Lucide icons, never the full set.
- **Budgets.** Target LCP under 2.0s and INP under 200ms on a mid-range phone, under 150KB of JS for the parent route (**Inferred** targets for the prototype).
- **No heavy chart library on the parent route.** Charts load only in the operator dashboard.

## Sources

- brightwheel homepage inline CSS custom properties: https://mybrightwheel.com/ (Verified color, font stack, radii, spacing tokens).
- brightwheel AI launch post: https://mybrightwheel.com/blog/bringing-ai-to-brightwheel (Verified launch date, read-only scope, Spotlight cards, director approval, thumbs feedback).
- WCAG 2.2 contrast and target size success criteria (1.4.3, 1.4.11, 2.5.8) for thresholds.
- Airbnb DLS, Apple Human Interface Guidelines, Uber Base, Uber Eats, Stripe, Google Gemini, Linear, and Notion: principles summarized from their public guidelines and shipped products (Inferred characterizations).
