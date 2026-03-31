# Sophia Design System -- Comprehensive Audit & Direction

**Date**: 2026-03-31
**Auditor**: UI Design Agent
**Product**: Sophia AI Chief of Staff
**Philosophy**: "Sophia, assist you to live brilliantly"
**Personality**: Smart, warm, restrained, trustworthy, executive-grade

---

## Part 1: Current State Audit

### 1.1 Typography Hierarchy -- GRADE: D+

**What exists:**
- Single font: Inter (good choice)
- `text-base`, `text-sm`, `text-xs` used interchangeably
- `text-lg` for the sidebar logo, `text-xl` for page title
- `font-semibold` and `font-bold` used inconsistently
- No display-level headings anywhere

**Problems:**
- **No typographic scale.** The app uses 3 sizes (xs/sm/base) for 90% of content, making everything feel equally unimportant. This is the #1 cause of the "running ledger" feeling.
- **No headline treatment.** Page titles are `text-base sm:text-xl font-semibold` -- barely distinguishable from body text.
- **Monochrome text.** Everything is slate-600/700/800. No contrast between levels.
- **Section headers** like "TODAY", "ACTION", "HORIZON" in BriefingCard use `text-xs font-semibold uppercase tracking-wider` -- effective but the only place with intentional typographic rhythm.

### 1.2 Color System -- GRADE: C

**What exists (globals.css):**
```
primary: #6366f1 (indigo-500)
accent: #f59e0b (amber)
success: #10b981 (emerald)
danger: #ef4444 (red)
warning: #f59e0b (same as accent -- redundant)
surface: #ffffff / #f8fafc / #f1f5f9
text: #0f172a / #475569 / #94a3b8
border: #e2e8f0
```

**Problems:**
- **Accent and Warning are identical** (#f59e0b). These should be semantically distinct.
- **No warm color in the palette.** Sophia's personality is "warm" but the palette is entirely cool (indigo + slate). There's no hint of warmth anywhere.
- **Hardcoded colors everywhere.** BriefingCard uses `text-indigo-600`, `bg-indigo-100`, `border-indigo-200` directly -- over 50 instances of hardcoded indigo/slate in one component alone. These bypass the design token system entirely.
- **Inconsistent semantic use.** Blue means "i_promised", amber means "they_promised", pink means "family" in commitments, but blue means "work" in calendar, and indigo means "primary". Blue is overloaded.
- **No dark mode tokens** defined, despite `[data-theme="dark"]` being a good practice.

### 1.3 Spacing & Rhythm -- GRADE: C-

**What exists:**
- Tailwind default spacing used throughout
- Cards use `p-4` or `p-5` inconsistently
- `space-y-1.5`, `space-y-2`, `space-y-3`, `space-y-4` all used within the same component
- `gap-2`, `gap-2.5`, `gap-3` in adjacent elements

**Problems:**
- **No consistent vertical rhythm.** The dashboard stacks cards with varying gaps (3px, 6px, 12px, 16px) creating visual noise.
- **Card padding varies** between `p-4` (16px) and `p-5` (20px) with no clear rule for when to use which.
- **Section spacing is too tight.** BriefingCard sections (TODAY/ACTION/HORIZON) use `pb-3` between them, which is only 12px -- not enough breathing room for scannability.

### 1.4 Component Consistency -- GRADE: D

**Problems identified:**
- **Two separate DraftEmailModal implementations** -- one in `BriefingCard.tsx` (lines 79-202) and another in `dashboard/page.tsx` (lines 128-280). They have different prop interfaces and slightly different styling.
- **Button styles are ad-hoc.** At least 8 different button patterns across the codebase:
  - `bg-primary text-white rounded-lg` (modal submit)
  - `bg-primary text-white rounded-xl` (chat send)
  - `bg-indigo-600 text-white rounded-md` (briefing draft)
  - `bg-blue-50 text-blue-700 rounded-lg` (expanded actions)
  - `border border-slate-200 rounded-lg` (cancel)
  - `bg-primary/10 text-primary rounded-xl` (TopBar ask)
  - `bg-indigo-50 text-indigo-700 rounded-full` (chat suggestions)
  - `px-2.5 py-1 rounded-md bg-indigo-600` (briefing action)
- **Border radius varies:** `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`, `rounded-md` all co-exist.
- **No shared Card component.** Each page rebuilds cards from scratch with different border/shadow/padding.
- **Focus states are inconsistent.** Form inputs use `focus:ring-2 focus:ring-primary/20` in some places, `focus:ring-2 focus:ring-indigo-200` in others.

### 1.5 Visual Hierarchy -- GRADE: D+

**Dashboard page:** Opens to a flat list of commitment cards below a stats banner. There is no focal point. The BriefingCard (the most valuable piece of content) competes visually with the stats grid, and both compete with the commitment list. A CEO at 7am sees a wall of uniformly-styled rectangles.

**Calendar page:** Layer colors (blue/pink/amber/emerald) are defined but all events render at the same visual weight. Conflicts get a subtle red tint but no callout.

**Inbox page:** Email list and WhatsApp messages are interleaved in a flat accordion. No priority surfacing, no visual distinction between needs-reply and FYI.

**Contacts page:** The "Needs Attention" banner is the best visual hierarchy in the app. The contact grid below is a uniform card grid with no relationship warmth beyond a temperature bar.

### 1.6 Whitespace -- GRADE: C-

- Pages use `p-4 sm:p-8` for outer padding -- reasonable
- But internal content is packed too tightly
- No breathing room between major sections
- BriefingCard is the densest component, with 5 sections in ~400px of vertical space

### 1.7 Micro-interactions & Animations -- GRADE: B-

**What exists (good):**
- Framer Motion `AnimatePresence` on modals, dropdowns, chat panel
- `whileHover={{ y: -2 }}` on contact cards
- Spring animations on chat panel open/close
- Loading skeletons (Skeleton component exists)

**Problems:**
- Animations are decorative only. No animations that communicate state changes (e.g., commitment completing, email sending).
- No staggered list entry animations -- all cards appear at once.
- No progress indicators for multi-step operations.
- The `animate-pulse` skeleton is the only loading state. No content-aware shimmer.

### 1.8 Icon System -- GRADE: C+

- Lucide icons used consistently (good)
- Icon sizes vary: `w-3 h-3`, `w-3.5 h-3.5`, `w-4 h-4`, `w-5 h-5`, `w-6 h-6` with no clear hierarchy rule
- Mixed use of emojis and icons. Expanded commitment details use emojis ("memo", "calendar", "electric", "star") while the rest of the app uses Lucide. This creates visual inconsistency.
- The Sophia brand icon is `Sparkles` (lucide), which is generic and not distinct.

### 1.9 Empty States & Loading States -- GRADE: C

- `SkeletonCard` exists and is well-built
- `SkeletonBriefing` exists for briefing loading
- Chat panel has a nice empty state with suggestions
- **Missing:** No empty states for zero commitments, zero contacts, zero emails, empty calendar days
- **Missing:** No error recovery UI beyond "try again" links
- **Missing:** No first-run / onboarding state for new users in dashboard

---

## Part 2: The Sophia Design System

### 2.1 Design Principles

```
1. QUIET AUTHORITY  -- Not loud, not shy. Like a well-tailored suit.
2. SIGNAL, NOT NOISE -- Every pixel must earn its place. If it doesn't help decide, remove it.
3. WARMTH THROUGH CARE -- Not warm colors or rounded corners. Warmth is: knowing what matters, anticipating needs, gentle nudges.
4. HIERARCHY IS KINDNESS -- A clear hierarchy is the most caring thing a UI can do. It says "I know your time is precious."
5. CONTEXT OVER DATA -- Don't show numbers. Show what the numbers mean.
```

### 2.2 Typography Scale

```css
/* --- Type Scale --- */
/* Named semantically, not by size */

/* Page-level greeting / dashboard headline */
.type-display {
  @apply text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary;
  /* 30px desktop, 24px mobile */
}

/* Section titles within a page */
.type-heading {
  @apply text-lg sm:text-xl font-semibold text-text-primary;
  /* 20px desktop, 18px mobile */
}

/* Card titles, important labels */
.type-title {
  @apply text-base font-semibold text-text-primary;
  /* 16px */
}

/* Primary body text, descriptions */
.type-body {
  @apply text-sm leading-relaxed text-text-secondary;
  /* 14px */
}

/* Secondary info, metadata, timestamps */
.type-caption {
  @apply text-xs text-text-tertiary;
  /* 12px */
}

/* Overline labels (section markers like TODAY/ACTION) */
.type-overline {
  @apply text-[11px] font-semibold uppercase tracking-widest text-text-tertiary;
}

/* Numeric emphasis (stats, scores, counts) */
.type-metric {
  @apply text-3xl sm:text-4xl font-bold tracking-tight tabular-nums;
  /* 36px, uses tabular numbers for alignment */
}
```

**Implementation in Tailwind (globals.css):**

```css
@theme {
  /* ... existing tokens ... */
  --font-display: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', monospace;

  /* Letter spacing tokens */
  --tracking-display: -0.025em;
  --tracking-heading: -0.015em;
}
```

**Key change:** Page titles should be `text-2xl font-semibold tracking-tight`, not `text-xl font-semibold`. The BriefingCard greeting should be `text-lg font-semibold`, not `text-sm font-semibold`. These changes alone will create the visual hierarchy that breaks the "running ledger" pattern.

### 2.3 Color System

```css
@theme {
  /* ── Brand: Sophia Indigo ── */
  /* Slightly warmer indigo, shifted toward violet */
  --color-primary: #6366f1;       /* Keep: it's a good base */
  --color-primary-hover: #4f46e5;
  --color-primary-light: #eef2ff;
  --color-primary-muted: #c7d2fe; /* NEW: for subtle backgrounds */

  /* ── Warmth Accent ── */
  /* A warm tone that says "Sophia cares" -- used sparingly */
  --color-warm: #f5a524;          /* Warm amber-gold */
  --color-warm-light: #fef3c7;    /* Light warm bg */
  --color-warm-muted: #fde68a;

  /* ── Semantic: Commitment Types ── */
  /* These are THE defining colors of the app */
  --color-promised: #3b82f6;      /* Blue: I promised */
  --color-promised-light: #dbeafe;
  --color-awaiting: #f59e0b;      /* Amber: They promised */
  --color-awaiting-light: #fef3c7;
  --color-family: #ec4899;        /* Pink: Family */
  --color-family-light: #fce7f3;

  /* ── Semantic: Status ── */
  --color-success: #10b981;
  --color-warning: #f97316;       /* CHANGED: orange, distinct from amber */
  --color-danger: #ef4444;
  --color-info: #3b82f6;

  /* ── Semantic: Calendar Layers ── */
  --color-layer-work: #3b82f6;
  --color-layer-family: #ec4899;
  --color-layer-commitment: #f59e0b;
  --color-layer-trip: #10b981;

  /* ── Relationship Warmth ── */
  --color-temp-hot: #10b981;
  --color-temp-warm: #34d399;
  --color-temp-cooling: #f59e0b;
  --color-temp-cold: #ef4444;

  /* ── Surfaces ── */
  --color-surface: #ffffff;
  --color-surface-secondary: #f8fafc;
  --color-surface-tertiary: #f1f5f9;
  --color-surface-elevated: #ffffff;   /* For cards with shadow */
  --color-surface-sunken: #f1f5f9;     /* For inset areas */

  /* ── Text ── */
  --color-text-primary: #0f172a;
  --color-text-secondary: #475569;
  --color-text-tertiary: #94a3b8;
  --color-text-inverse: #ffffff;

  /* ── Border ── */
  --color-border: #e2e8f0;
  --color-border-subtle: #f1f5f9;      /* NEW: softer dividers */
  --color-border-emphasis: #cbd5e1;     /* NEW: stronger dividers */
}
```

### 2.4 Spacing System

```
Base unit: 4px

Micro:    4px  (gap between icon and label)
Small:    8px  (gap between inline elements)
Medium:  16px  (card internal padding, list item gaps)
Large:   24px  (section gaps within a page)
XLarge:  32px  (gaps between major page sections)
XXLarge: 48px  (page outer padding on desktop)

Rule: All spacing must be a multiple of 4px.
Never use 2.5 (10px), 3.5 (14px), or 5 (20px) as primary spacing.
```

**Practical Tailwind mapping:**
- `gap-1` (4px): icon + text
- `gap-2` (8px): inline elements
- `gap-4` (16px): card padding, list gaps
- `gap-6` (24px): section gaps
- `gap-8` (32px): major sections
- `p-4` for cards (always), `p-6` for modals, `p-8` for page content areas

### 2.5 Component Library

#### Cards

```tsx
/* --- Base Card --- */
// ALL cards in the app should use this pattern:
<div className="bg-white rounded-2xl border border-border p-4
  transition-all duration-200 hover:shadow-md hover:border-border-emphasis">
  {children}
</div>

/* --- Elevated Card (for primary content like Briefing) --- */
<div className="bg-white rounded-2xl border border-border p-6
  shadow-sm transition-all duration-200">
  {children}
</div>

/* --- Colored Card (for stats, status) --- */
<div className={cn(
  "rounded-2xl border p-4",
  "bg-promised-light border-promised/20" // or any semantic color
)}>
  {children}
</div>

/* --- Interactive Card (for list items) --- */
<div className="bg-white rounded-xl border border-border p-4
  cursor-pointer transition-all duration-200
  hover:shadow-md hover:border-border-emphasis hover:-translate-y-0.5
  active:translate-y-0 active:shadow-sm">
  {children}
</div>
```

**Rule: `rounded-2xl` for top-level cards, `rounded-xl` for nested elements, `rounded-lg` for buttons and inputs.**

#### Buttons

```tsx
/* --- Primary (main CTA) --- */
<button className="inline-flex items-center justify-center gap-2
  px-4 py-2.5 rounded-xl
  bg-primary text-white text-sm font-medium
  hover:bg-primary-hover active:scale-[0.98]
  transition-all duration-150
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2
  disabled:opacity-50 disabled:cursor-not-allowed">
  Action
</button>

/* --- Secondary (supporting action) --- */
<button className="inline-flex items-center justify-center gap-2
  px-4 py-2.5 rounded-xl
  bg-primary/10 text-primary text-sm font-medium
  hover:bg-primary/15 active:scale-[0.98]
  transition-all duration-150">
  Action
</button>

/* --- Ghost (tertiary, minimal) --- */
<button className="inline-flex items-center justify-center gap-2
  px-3 py-2 rounded-xl
  text-text-secondary text-sm font-medium
  hover:bg-surface-secondary hover:text-text-primary
  transition-all duration-150">
  Action
</button>

/* --- Danger --- */
<button className="inline-flex items-center justify-center gap-2
  px-4 py-2.5 rounded-xl
  bg-danger/10 text-danger text-sm font-medium
  hover:bg-danger/15 active:scale-[0.98]
  transition-all duration-150">
  Delete
</button>

/* --- Icon Button (small, for inline actions) --- */
<button className="p-2 rounded-lg
  text-text-tertiary hover:text-text-primary hover:bg-surface-secondary
  transition-colors duration-150">
  <Icon className="w-4 h-4" />
</button>
```

#### Form Inputs

```tsx
/* --- Standard Input --- */
<input className="w-full px-3.5 py-2.5 rounded-xl
  border border-border bg-white
  text-sm text-text-primary placeholder:text-text-tertiary
  focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
  transition-all duration-150
  disabled:bg-surface-secondary disabled:opacity-60" />

/* --- With Label (always use this pattern) --- */
<div>
  <label className="block text-xs font-medium text-text-secondary mb-1.5">
    Label
  </label>
  <input className="..." />
</div>
```

#### Badges / Pills

```tsx
/* --- Status Badge --- */
<span className="inline-flex items-center gap-1 px-2 py-0.5
  rounded-full text-xs font-medium
  bg-success/10 text-success border border-success/20">
  <CheckCircle className="w-3 h-3" />
  Done
</span>

/* --- Urgency: Overdue --- */
<span className="inline-flex items-center gap-1 px-2 py-0.5
  rounded-full text-xs font-semibold
  bg-danger/10 text-danger">
  3d overdue
</span>

/* --- Category Label --- */
<span className="inline-flex items-center px-2 py-0.5
  rounded-md text-[11px] font-medium
  bg-surface-secondary text-text-tertiary">
  email
</span>
```

### 2.6 Shadow & Elevation

```css
/* Level 0: Flat (default cards) */
shadow-none, border border-border

/* Level 1: Subtle lift (hovered cards, dropdowns) */
shadow-sm  /* 0 1px 2px 0 rgb(0 0 0 / 0.05) */

/* Level 2: Floating (modals, chat panel) */
shadow-lg  /* 0 10px 15px -3px rgb(0 0 0 / 0.1) */

/* Level 3: Commanding (primary modal overlay) */
shadow-2xl /* 0 25px 50px -12px rgb(0 0 0 / 0.25) */
```

**Rule: Cards start at Level 0, elevate to Level 1 on hover. Modals are Level 2. Chat panel overlay is Level 3.**

### 2.7 Motion System

```css
/* --- Timing --- */
--transition-micro: 100ms ease;    /* Button press, toggle */
--transition-fast: 150ms ease;     /* Hover effects */
--transition-normal: 250ms ease;   /* Panel transitions */
--transition-slow: 400ms ease;     /* Page-level animations */

/* --- Framer Motion Presets --- */
const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }
}

const staggerChildren = {
  animate: { transition: { staggerChildren: 0.05 } }
}

const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }
}
```

**New rules:**
- List items should stagger-animate on load (50ms between each)
- Completing a commitment should have a checkmark + fadeOut animation
- State changes (status update) should have a subtle flash/highlight
- Never animate more than 2 properties simultaneously

---

## Part 3: Page-Specific Improvements

### 3.1 Dashboard -- "The Morning Briefing"

**Current problem:** A CEO opens the app at 7am and sees a 4-stat banner, a briefing card, and a list of commitments. Everything is the same visual weight. There's no clear "start here" focal point.

**New design vision: The Newspaper Layout.**

The dashboard should feel like a morning newspaper -- the most important story is the biggest, and your eye naturally scans from top to bottom in order of priority.

```
+--------------------------------------------------+
|  Good morning, Tiger.          Mon, Mar 31   [sync]|
|  "3 things need you today."                        |
+--------------------------------------------------+

+--------------------------------------------------+
|  TODAY's BRIEFING                          [refresh]|
|  ┌─────────────────────────────────────────────┐  |
|  │ 09:00  Budget review -- prep slides tonight │  |
|  │ 11:30  Call with James @ Prudential         │  |
|  │ 14:00  Family: Pick up Emma from school     │  |
|  └─────────────────────────────────────────────┘  |
|                                                    |
|  NEEDS YOUR ACTION                    SCORE: 87%   |
|  [red dot] Reply to Sarah re: contract   2d overdue|
|  [amber]   Follow up with Chen Wei     due tomorrow|
|                                                    |
|  HORIZON                                           |
|  Board meeting prep in 5 days. 2 deliverables open.|
+--------------------------------------------------+

+------- YOUR NUMBERS --------+------ SOPHIA SAYS --------+
| 3 need action    87% rate   | "Your response time has   |
| 5 waiting        2 overdue  |  improved 15% this week.  |
|                              |  James Chen is cooling -- |
|                              |  consider a coffee."      |
+-----------------------------+----------------------------+

+--------------------------------------------------+
| COMMITMENTS                      [+ Add] [Filter] |
|                                                    |
| [i_promised cards...]                              |
| [they_promised cards...]                           |
| [family cards...]                                  |
+--------------------------------------------------+
```

**Key changes:**

1. **The greeting is the headline.** `text-2xl font-semibold tracking-tight` + a one-line AI summary underneath in `text-base text-text-secondary`. This is Sophia speaking directly.

2. **BriefingCard becomes the hero.** Full width, more generous padding (`p-6`), sections get `gap-4` between them instead of `gap-3`.

3. **Stats move below the briefing**, not above it. Stats are confirmation, not guidance. The briefing IS the guidance.

4. **"Sophia Says" insight card** sits next to stats in a 2-column layout. Not hidden in the flow.

5. **Commitment list gets grouping headers.** Instead of a flat list, group by type with collapsible sections and a count badge.

**Specific Tailwind for the greeting:**
```tsx
<div className="space-y-1">
  <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-text-primary">
    Good morning, Tiger.
  </h1>
  <p className="text-base text-text-secondary">
    3 things need your attention today.
  </p>
</div>
```

### 3.2 Calendar -- "The Clear Overlay"

**Current problem:** 4 layers (work/family/commitment/trip) on one timeline risks visual chaos.

**Design strategy: Layer Opacity + Focus Mode.**

1. **Default view shows all layers** but non-work layers are rendered at 60% opacity with a thin left-border color indicator (not full background color).

2. **Clicking a layer filter** brings that layer to 100% and fades others to 30%. This creates a "focus mode" without hiding data.

3. **The layer legend** should be persistent and interactive (toggle checkboxes), placed in the header bar, not floating.

4. **Conflicts get a visual treatment:**
```tsx
<div className="relative">
  <div className="absolute -left-1 top-0 bottom-0 w-1 bg-danger rounded-full" />
  <div className="border-l-2 border-danger bg-danger/5 px-3 py-2 rounded-r-lg">
    {/* event content */}
  </div>
</div>
```

5. **Time blocks use proportional height.** A 30-min meeting should be visually smaller than a 2-hour block. Currently all events render at the same height.

6. **The day view header** should show a mini summary:
```
Monday, March 31     4 events | 1 conflict | 2h focus time available
```

### 3.3 Inbox -- "The Triage Desk"

**Current problem:** A flat accordion list of emails and WhatsApp messages. No priority, no grouping, no progress feeling.

**New design vision: Priority Triage.**

```
+--------------------------------------------------+
| INBOX                                    12 unread |
|                                                    |
| NEEDS REPLY (3)                                    |
| ┌────────────────────────────────────────────────┐ |
| │ [avatar] Sarah Kim           2h ago            │ |
| │ Re: Contract renewal Q2                        │ |
| │ "Can you confirm the pricing by..."  [Draft]   │ |
| ├────────────────────────────────────────────────┤ |
| │ [avatar] James Chen          5h ago            │ |
| │ Meeting follow-up                              │ |
| │ "Thanks for today's call..."         [Draft]   │ |
| └────────────────────────────────────────────────┘ |
|                                                    |
| RECENT (showing last 7 days)                       |
| ┌────────────────────────────────────────────────┐ |
| │ [avatar] Newsletter Bot      1d ago     [dim]  │ |
| │ Weekly digest #42                               │ |
| └────────────────────────────────────────────────┘ |
+--------------------------------------------------+
```

**Key changes:**

1. **Two-section split:** "Needs Reply" (flagged by Sophia's AI) at top with full visual weight, "Recent" below with reduced visual emphasis.

2. **Reply-needed emails get a warm-tinted left border:**
```tsx
<div className="border-l-4 border-warm bg-warm-light/30 rounded-r-xl p-4">
```

3. **Inline "Draft Reply" button** on each needs-reply email. One click opens the draft modal.

4. **Time grouping** within Recent: "Today", "Yesterday", "This week", "Older".

5. **Channel indicator** as a subtle icon (Mail or MessageCircle) rather than a filter toggle.

### 3.4 Contacts -- "The Relationship Map"

**Current problem:** A grid of cards with avatar + name + company + temperature bar. Functional but emotionally flat.

**New design vision: Warmth is Visual.**

1. **Avatar rings indicate relationship temperature:**
```tsx
/* Hot contact -- green ring */
<div className="w-12 h-12 rounded-full ring-2 ring-temp-hot ring-offset-2 ...">

/* Cooling contact -- amber ring with pulse */
<div className="w-12 h-12 rounded-full ring-2 ring-temp-cooling ring-offset-2 animate-pulse ...">

/* Cold contact -- no ring (default) */
<div className="w-12 h-12 rounded-full ...">
```

2. **VIP contacts get a subtle gold badge overlay** on their avatar (a small star, not a text badge).

3. **Last interaction context** replaces raw "days since contact" number:
   - "Called 3 days ago" instead of "3d since contact"
   - "Emailed about Q2 budget" instead of "email_count: 12"

4. **Commitment connection shown inline:**
```
Sarah Kim -- Prudential
2 open commitments with her | Last: "Send revised proposal"
```

5. **The "Needs Attention" banner** is already good. Enhance it by adding the REASON for attention (e.g., "VIP + 14d no contact" or "has overdue commitment").

---

## Part 4: Sophia's Visual Identity

### 4.1 The Sophia Avatar

The current `Sparkles` icon is too generic. Sophia needs a distinctive visual mark.

**Recommended approach: Abstract "S" monogram.**

```tsx
/* Sophia's avatar mark -- used in sidebar, chat, briefing */
<div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-violet-500
  flex items-center justify-center shadow-sm">
  <span className="text-white text-sm font-bold italic">S</span>
</div>
```

Why this works:
- A single letter is memorable and personal (like iMessage showing first names)
- The gradient (indigo to violet) is distinctive without being flashy
- Italic suggests motion and intelligence
- `rounded-xl` (not `rounded-full`) distinguishes it from user avatars

For the sidebar logo:
```tsx
<div className="flex items-center gap-3 px-6 py-5">
  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-violet-500
    flex items-center justify-center shadow-sm">
    <span className="text-white text-base font-bold italic">S</span>
  </div>
  <div>
    <span className="font-semibold text-base text-text-primary">Sophia</span>
    <span className="block text-[11px] text-text-tertiary -mt-0.5">Chief of Staff</span>
  </div>
</div>
```

### 4.2 Chat Panel Design

**Current state:** Functional but generic. Looks like any chatbot widget.

**New design vision: The Trusted Advisor.**

```
+--------------------------------------+
| [S] Sophia            [minimize] [X] |
| ─────────────────────────────────── |
|                                      |
|     [S avatar]                       |
|     Sophia                           |
|     "Good morning. You have 3        |
|      things that need attention."    |
|                                      |
|     [Quick Action Chips]             |
|     [What's overdue?]                |
|     [Today's schedule]               |
|     [Draft a reply to...]            |
|                                      |
| ─────────────────────────────────── |
|                                      |
|   You: What's my most urgent thing?  |
|                                      |
|     [S] Sarah's contract is 2 days   |
|     overdue. I've drafted a reply.   |
|     ┌─────────────────────────────┐  |
|     │ Email Draft Ready           │  |
|     │ To: sarah@prudential.com    │  |
|     │ [Review in Inbox ->]        │  |
|     └─────────────────────────────┘  |
|                                      |
+--------------------------------------+
| [input field]         [mic] [send]   |
+--------------------------------------+
```

**Specific changes:**

1. **Sophia's messages get her avatar** (the S monogram, small -- `w-6 h-6`) aligned left.

2. **Message bubbles are NOT rounded on the inner corner:**
```tsx
/* Sophia's message */
"bg-surface-secondary text-text-primary rounded-2xl rounded-bl-md"

/* User's message */
"bg-primary text-white rounded-2xl rounded-br-md"
```

3. **Action cards** (email draft, task created, etc.) render below the message with a distinct style -- not inside the bubble.

4. **The panel header** shows Sophia's name + a subtle status indicator ("listening" when processing).

5. **Input area** gets a warm placeholder that changes based on context:
   - Default: "Ask Sophia anything..."
   - After briefing: "What should I do about Sarah's contract?"
   - In inbox: "Draft a reply, forward, or summarize..."

### 4.3 Notifications & Alerts

**Three tiers:**

```tsx
/* --- Tier 1: Inline Nudge (within content flow) --- */
/* Used for: Sophia insights, gentle suggestions */
<div className="flex items-start gap-3 px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl">
  <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary to-violet-500
    flex items-center justify-center shrink-0 mt-0.5">
    <span className="text-white text-[10px] font-bold italic">S</span>
  </div>
  <p className="text-sm text-text-secondary leading-relaxed">
    James Chen hasn't replied in 5 days. Want me to draft a follow-up?
  </p>
</div>

/* --- Tier 2: Banner Alert (page-level) --- */
/* Used for: Overdue warnings, sync errors, attention needed */
<div className="flex items-center gap-3 px-4 py-3 bg-warning/10 border border-warning/20 rounded-xl">
  <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
  <p className="text-sm text-warning font-medium flex-1">
    2 commitments are overdue
  </p>
  <button className="text-xs font-medium text-warning hover:text-warning/80">
    View
  </button>
</div>

/* --- Tier 3: Toast (transient, auto-dismiss) --- */
/* Used for: Action confirmations, sync complete */
<div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3
  bg-surface-elevated border border-border rounded-xl shadow-lg
  animate-slide-up">
  <CheckCircle className="w-4 h-4 text-success" />
  <span className="text-sm font-medium">Commitment marked done</span>
</div>
```

### 4.4 Sophia's Icon/Emoji Language

**Rule: Sophia speaks with restraint.** No emoji floods. When Sophia uses visual markers, they are systematic:

| Meaning | Symbol | Context |
|---------|--------|---------|
| Sophia speaking | `[S]` monogram | Chat, briefing, nudges |
| Urgent | Red dot (CSS, not emoji) | Overdue items |
| Needs attention | Amber dot | Due soon items |
| All good | Green dot | Completed, on track |
| Calendar | `Calendar` icon (Lucide) | Time-related |
| Person | `User` icon or avatar | Contact-related |
| AI-generated | Subtle sparkle indicator | Drafts, insights |

**Banned in Sophia's voice:** Random emoji, multiple exclamation marks, words like "Hey!" or "Awesome!". Sophia is composed and direct.

---

## Part 5: Reference Apps

### 5.1 Linear (linear.app)

**What to learn:** Visual hierarchy through typography alone. Linear uses one font, three sizes, two weights, and achieves perfect scannability. Their issue lists are the gold standard for "information-dense but not overwhelming."

**Specifically steal:**
- Their keyboard-shortcut-first UX
- The way status indicators use tiny colored dots, not full-color badges
- Section headers as subtle gray overlines
- The feeling of "everything has a place"

### 5.2 Superhuman (superhuman.com)

**What to learn:** Making email feel manageable. Superhuman's key insight is that inbox zero is a feeling, not a number. Their "split inbox" (important / other) is exactly what Sophia's inbox needs.

**Specifically steal:**
- The two-panel inbox layout (list + preview)
- Quick action buttons directly on list items
- The satisfying "done" animation when archiving
- Keyboard-driven triage workflow

### 5.3 Notion Calendar (formerly Cron)

**What to learn:** Multi-layer calendar that doesn't feel cluttered. Notion Calendar overlays multiple calendars with transparency and color coding that actually works.

**Specifically steal:**
- The way events use a left-border color indicator (not full background)
- The mini-month sidebar for quick navigation
- The subtle conflict indicator (overlapping events get a red accent)
- Clean day/week/month transitions

### 5.4 Arc Browser (arc.net)

**What to learn:** Warmth in a tech product. Arc proves that a professional tool can feel personal without being childish. Their use of subtle gradients, thoughtful animations, and personality touches is exactly the tone Sophia needs.

**Specifically steal:**
- The gradient brand treatment (tasteful, not garish)
- Contextual sidebars that slide in/out smoothly
- The "boost" concept (user personalization of the tool)
- The feeling that the tool anticipates what you need

### 5.5 Amie (amie.so)

**What to learn:** Calendar + task management with polish. Amie is the closest competitor in spirit to Sophia's calendar. Their visual design is warm, professional, and delightful without being distracting.

**Specifically steal:**
- The way they integrate tasks into the calendar view
- Their event creation flow (inline, not modal)
- The subtle animations on event drag-and-drop
- The personal greeting / daily summary at the top

---

## Part 6: Immediate Action Plan

### Priority 1: Typography Fix (Highest impact, lowest effort)

1. Change TopBar `h1` from `text-base sm:text-xl` to `text-xl sm:text-2xl font-semibold tracking-tight`
2. Add a greeting line to dashboard: `text-2xl sm:text-3xl font-semibold tracking-tight`
3. BriefingCard greeting: change from `text-sm font-semibold` to `text-lg font-semibold`
4. Add section headers to commitment list: `text-xs font-semibold uppercase tracking-widest text-text-tertiary`

### Priority 2: Color Consolidation (Eliminate hardcoded colors)

1. Replace all `text-indigo-600`, `bg-indigo-100` etc. in BriefingCard with `text-primary`, `bg-primary-light`
2. Separate `--color-warning` from `--color-accent` (orange vs amber)
3. Add `--color-warm` token for Sophia's personality moments

### Priority 3: Spacing Normalization

1. Standardize card padding to `p-4` everywhere
2. Use `gap-6` between major page sections
3. BriefingCard sections get `pb-4` instead of `pb-3`

### Priority 4: Component Deduplication

1. Extract a shared `DraftEmailModal` component
2. Create a shared `<Card>` component
3. Create a shared `<Button variant="primary|secondary|ghost|danger">` component

### Priority 5: Sophia Identity

1. Replace `Sparkles` icon with the S monogram mark
2. Add Sophia's avatar to chat messages
3. Implement the three-tier notification system

---

## Appendix: File Locations Audited

- `/Users/tigerli/Desktop/通用助手/web/app/globals.css` -- Design tokens
- `/Users/tigerli/Desktop/通用助手/web/components/layout/Sidebar.tsx` -- Navigation
- `/Users/tigerli/Desktop/通用助手/web/components/layout/TopBar.tsx` -- Page header
- `/Users/tigerli/Desktop/通用助手/web/components/dashboard/BriefingCard.tsx` -- Morning briefing
- `/Users/tigerli/Desktop/通用助手/web/components/dashboard/ChatPanel.tsx` -- AI chat
- `/Users/tigerli/Desktop/通用助手/web/components/ui/Skeleton.tsx` -- Loading states
- `/Users/tigerli/Desktop/通用助手/web/app/(dashboard)/dashboard/page.tsx` -- Main dashboard
- `/Users/tigerli/Desktop/通用助手/web/app/(dashboard)/dashboard/calendar/page.tsx` -- Calendar
- `/Users/tigerli/Desktop/通用助手/web/app/(dashboard)/dashboard/inbox/page.tsx` -- Inbox
- `/Users/tigerli/Desktop/通用助手/web/app/(dashboard)/dashboard/contacts/page.tsx` -- Contacts
