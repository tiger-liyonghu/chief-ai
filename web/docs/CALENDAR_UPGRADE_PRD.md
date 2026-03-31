# PRD: Chief Calendar Upgrade -- "The Command View"

**Status**: Draft
**Author**: Alex (PM Agent) **Last Updated**: 2026-03-31 **Version**: 1.0
**Stakeholders**: Tiger (Founder/Lead Dev), Sophie (AI Agent), Engineering

---

## Executive Summary

The calendar is currently the weakest module in Chief -- a readonly event list synced from Google/Outlook. For an app positioned as an **AI Chief of Staff** for globe-trotting founders, this is the equivalent of giving a military commander a notepad instead of a command center.

The calendar should be the **primary surface** of Chief. It is where all three value dimensions converge:
- **Commitment Layer**: promises due today, follow-ups overdue, meetings where commitments were made
- **Travel Layer**: timezone-aware scheduling, trip context overlays, city-specific intelligence
- **Family Layer**: hard constraints (kids' exams, spouse events) that block scheduling and trigger conflict warnings

**One-liner**: When the user opens Chief's calendar, they should see their day the way a world-class executive assistant would brief them -- not a grid of colored rectangles, but a **situational awareness display** showing what matters, what conflicts, and what Sophie recommends.

---

## 1. Problem Statement

**Who**: Busy founder/CEO in Singapore, traveling 8-12 times/year across Asia (China, Japan, Korea, India, Malaysia), managing investors, clients, team, and family.

**Pain**: Current calendar is a passive mirror of Google Calendar. It adds zero intelligence. The user must mentally overlay:
- Which meetings relate to which commitments?
- Am I double-booked with a family event I promised to attend?
- What timezone will I be in when that call happens?
- Do I have prep time before that investor meeting?
- Is Sophie flagging anything about today's schedule?

**Cost of not solving**: The calendar becomes a feature users ignore in favor of Google Calendar directly. Chief loses its position as the "single pane of glass" and becomes a fragmented set of tools instead of an integrated command center.

**Evidence**:
- Product positioning gap: All 3 value dimensions (commitment, travel, family) generate time-bound events, but none surface on the calendar today
- Competitive signal: Reclaim, Motion, and Amie have all moved toward AI-native calendars; a readonly list is table-stakes circa 2022
- User persona: A founder checking their phone at 6am before a flight needs a 5-second scan, not a deep dive into multiple screens

---

## 2. Goals and Success Metrics

| Goal | Metric | Current Baseline | Target | Measurement Window |
|------|--------|-----------------|--------|--------------------|
| Calendar becomes primary screen | % sessions where calendar is first screen opened | ~15% (est.) | 50% | 90 days post-launch |
| Reduce missed commitments | Overdue commitments per user/week | Unknown (no baseline) | Track, then reduce 30% | 60 days |
| Conflict detection value | % of detected conflicts user acts on | N/A | >60% | 60 days |
| Sophie calendar engagement | % of Sophie suggestions accepted from calendar | N/A | >25% | 90 days |
| Timezone confusion elimination | Support/feedback mentions of timezone issues | Qualitative baseline | Zero | 30 days |

---

## 3. Non-Goals

- **We are not rebuilding Google Calendar.** No drag-and-drop event creation, no recurring event editor, no invite management. Google/Outlook remain the system of record. Chief is the intelligence layer on top.
- **We are not building Calendly/Cal.com.** No external booking pages or scheduling links in v1. That is a P2 feature if demand warrants.
- **We are not building a project management tool.** No Gantt charts, no task dependencies, no sprint boards. Motion and Asana own that space.
- **We are not auto-moving meetings.** Unlike Reclaim/Clockwise, we do not silently reschedule the user's calendar. An AI CoS *recommends*; the human *decides*. Sophie suggests, user confirms.
- **We are not building collaborative team calendars.** Chief is for the individual founder. Team scheduling is a P3 concern.

---

## 4. User Personas and Stories

### Primary Persona: Tiger -- Singapore-based founder, frequent Asia traveler

**Context**: Manages 20+ active investor/client relationships, has 2 kids with packed schedules (classes, exams), spouse who works, travels to 3-5 cities per month. Uses Gmail, Google Calendar, WhatsApp. Checks phone first thing in morning and between meetings.

---

### Core User Stories

**Story 1 -- Morning Command View**
As a founder, I want to open the calendar and instantly see what matters today so that I can start my day with full situational awareness in under 10 seconds.

Acceptance Criteria:
- [ ] Today's events displayed with commitment tags (which events relate to active promises)
- [ ] Active conflicts highlighted with severity indicator (red = hard conflict, amber = soft overlap)
- [ ] Sophie's top 3 recommendations for today visible without scrolling
- [ ] Current timezone and "home timezone" both displayed
- [ ] Overdue commitments surfaced as a banner/count badge
- [ ] Family events visually distinct (different color/icon) with hard-constraint indicator

**Story 2 -- Timezone-Aware Travel View**
As a founder landing in Tokyo at 8am, I want my calendar to show me events in both local time and Singapore time so that I never miss a call or accidentally schedule over someone's midnight.

Acceptance Criteria:
- [ ] Dual timezone rail visible (local + home/Singapore)
- [ ] Events from my Singapore team shown with their local time annotation
- [ ] When creating/viewing events during a trip, timezone context is always explicit
- [ ] Trip overlay shows which city I am in on which days (derived from trip module)

**Story 3 -- Conflict Detection and Resolution**
As a founder, I want Chief to detect when a new meeting conflicts with a family commitment, an investor meeting, or a commitment deadline so that I can resolve it before it becomes a dropped ball.

Acceptance Criteria:
- [ ] System detects time overlaps between any event types (work, family, travel, commitment deadlines)
- [ ] Conflicts classified by severity: HARD (family hard constraint, flight time), SOFT (double-booked meetings), WARNING (no prep time before important meeting)
- [ ] Each conflict includes Sophie's suggested resolution (e.g., "Reschedule standup to 2pm -- your investor call has no flex")
- [ ] User can accept Sophie's suggestion with one tap (Chief updates Google Calendar via API)

**Story 4 -- Commitment-Calendar Overlay**
As a founder, I want to see which of today's meetings are connected to active commitments so that I know what to prepare, what to follow up on, and where promises are at risk.

Acceptance Criteria:
- [ ] Events linked to commitments show a commitment badge with status (on track / at risk / overdue)
- [ ] Tapping the badge shows the related commitment details inline
- [ ] Commitments with deadlines today/this week that have NO calendar event trigger a Sophie suggestion ("You promised X by Friday but have nothing scheduled -- want me to block time?")

**Story 5 -- Week Planning with Sophie**
As a founder on Sunday evening, I want Sophie to generate a "Week Ahead" brief that reviews my calendar, flags risks, and suggests optimizations so that I enter Monday already in control.

Acceptance Criteria:
- [ ] Sophie generates a structured weekly brief: key meetings, commitment deadlines, travel days, family events, detected conflicts
- [ ] Brief includes "unscheduled commitments" -- promises due this week with no time blocked
- [ ] Brief available in-app and via WhatsApp
- [ ] User can reply to any suggestion with "do it" to have Sophie take action (block time, draft prep email, etc.)

**Story 6 -- Family Hard Constraints**
As a founder and parent, I want my kids' exam dates, recital times, and spouse's important events to be treated as immovable blocks so that Sophie never suggests scheduling over them.

Acceptance Criteria:
- [ ] Family events can be marked as "hard constraint" (manually or via rule: e.g., all events from "Kids" calendar are hard constraints)
- [ ] When any scheduling action would overlap a hard constraint, Sophie blocks it and explains why
- [ ] Dashboard shows "family commitments this week" count to maintain awareness

---

## 5. Solution Overview: The Command View

### Design Philosophy

The Chief calendar is NOT a traditional calendar grid. It is a **Command View** -- a situational awareness display that answers three questions instantly:

1. **What's happening?** (events, by time)
2. **What's at stake?** (commitments, conflicts, preparation needed)
3. **What should I do?** (Sophie's recommendations)

### The Three Layers (Visual Architecture)

```
+----------------------------------------------------------+
|  COMMAND BAR                                              |
|  [Today] [Week] [Month]  |  SGT (UTC+8) / JST (UTC+9)   |
|  Sophie: "3 items need attention today"         [Ask AI]  |
+----------------------------------------------------------+
|                          |                                |
|   TIME RAIL              |   INTELLIGENCE PANEL           |
|   (left 65%)             |   (right 35%)                  |
|                          |                                |
|   8am  [ Team standup ]  |   CONFLICTS (1)                |
|         ~~~meeting~~~     |   ! Investor call overlaps     |
|   9am  [ Investor call ] |     with school pickup          |
|         *commitment*     |     [Sophie: Move standup?]    |
|         VIP: James Chen  |                                |
|  10am  [ Flight SIN>TYO ]|   COMMITMENTS DUE (2)          |
|         >>>travel>>>     |   * Send deck to James (today) |
|  11am  |  in transit  |  |   * Review contract (Fri)      |
|         >>>>>>>>>>>>>>>  |     [Block time] [Snooze]      |
|   ...                    |                                |
|   3pm  [ Kid piano ]     |   SOPHIE SUGGESTS              |
|         FAMILY HARD      |   - Prep notes for James mtg   |
|         <<<immovable>>>  |   - You land TYO 4pm local,    |
|                          |     next mtg is 6pm -- gap ok   |
|   6pm  [ Dinner w/ TYO ] |   - No gym blocked this week   |
|         partner          |                                |
|                          |   THIS WEEK SUMMARY            |
|                          |   5 meetings | 2 travel days   |
|                          |   3 commitments due | 1 family |
+----------------------------------------------------------+
```

### Key Visual Innovations

**1. Event Type Encoding (Color + Icon + Border)**
Instead of arbitrary calendar colors, Chief uses a semantic visual language:
- **Work meetings**: Solid blue, people icon
- **Commitment-linked events**: Blue with amber left border + commitment badge
- **Travel blocks**: Green gradient with plane/train icon, spans the transit duration
- **Family events**: Purple with lock icon (hard constraint) or heart icon (soft)
- **Focus/prep time**: Striped gray (Sophie-suggested blocks)
- **Conflicts**: Red pulsing border on overlapping events

**2. Dual Timezone Rail**
Two thin time columns on the left edge:
- Left rail: Current location timezone (auto-detected or trip-derived)
- Right rail: Home timezone (Singapore)
- When traveling, the delta is shown once at the top: "Tokyo +1h from Singapore"
- Other attendees' timezones shown as a small tag on their events: "James is at 7am his time"

**3. Commitment Density Indicator**
A thin heat bar at the top of each day (in week/month view) showing:
- Green: Light day, few commitments
- Amber: Moderately loaded
- Red: Overloaded -- more commitments due than time available
This gives a glanceable "pressure map" of the week without reading every event.

**4. Trip Ribbon**
When a trip spans multiple days, a horizontal ribbon sits above the day columns:
```
[------- Tokyo Trip (Mar 15-18) -------][--- Singapore ---]
```
This makes timezone context passive and always visible.

**5. Conflict Markers**
Overlapping events show a red "X" junction marker. Tapping it opens a conflict resolution card with Sophie's suggestion.

---

## 6. Feature Prioritization

### P0 -- Must Have (Matches Core Positioning, High Impact)

These features are what make Chief's calendar fundamentally different from Google Calendar. Without them, the calendar remains a commodity viewer.

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| P0-1 | **Command View -- Day Layout** | The core screen. Events displayed with semantic type encoding (work/travel/family/commitment). Replaces the readonly list. | M |
| P0-2 | **Commitment-Calendar Linking** | Auto-link commitments to calendar events by contact name, subject, or AI matching. Show commitment badge on events. Surface unscheduled commitments. | M |
| P0-3 | **Conflict Detection Engine** | Detect overlaps between all event types. Classify as HARD/SOFT/WARNING. Surface in Intelligence Panel. | M |
| P0-4 | **Sophie's Daily Brief on Calendar** | Top 3 recommendations visible on the Command View. "You have a conflict at 3pm." "Prep notes for James meeting." "Commitment due today: send deck." | S |
| P0-5 | **Family Hard Constraints** | Mark family calendar events as immovable. Conflict detection respects them. Visual lock icon. | S |
| P0-6 | **Dual Timezone Display** | Show current + home timezone rails. Auto-detect from device or trip module. Show attendee timezone annotations. | S |
| P0-7 | **Trip Ribbon Overlay** | When trip data exists, show city/dates as a ribbon above the day view. Timezone context derived automatically. | S |
| P0-8 | **Week View with Commitment Heat Bar** | 7-day view with daily load indicator. Glanceable "pressure map" for the week. | S |
| P0-9 | **One-Tap Action from Sophie Suggestions** | Sophie suggestions are actionable: "Block 30min prep time" -> one tap creates event via Google Calendar API. "Move standup to 2pm" -> one tap reschedules. | M |

**Total P0 Effort Estimate**: ~6-8 engineering weeks (1 senior full-stack)

---

### P1 -- Should Have (Valuable, Not Blocking Launch)

These features deepen the AI-native experience but the calendar is useful without them on day one.

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| P1-1 | **Week Ahead Brief (Sunday Planning)** | Sophie generates a structured weekly brief. Available in-app and via WhatsApp. | M |
| P1-2 | **Smart Prep Time Insertion** | Sophie detects high-stakes meetings (investor, board) and suggests prep blocks 30-60min before. | S |
| P1-3 | **Contact Intelligence on Events** | Tap any attendee to see: VIP score, last interaction, open commitments with them, relationship health. | S |
| P1-4 | **Conflict Resolution Cards** | When conflict detected, show a card with: what conflicts, why it matters (commitment context), Sophie's recommended resolution, one-tap action. | M |
| P1-5 | **Travel Buffer Detection** | When a flight/train is in the calendar, auto-detect and protect buffer time before/after (airport transit, jet lag recovery). Flag if meetings are booked inside the buffer. | S |
| P1-6 | **"What Changed" Diff View** | Morning notification: "2 events added to your calendar since yesterday. 1 conflict created." Shows what moved overnight (common when assistants or team members add things). | S |
| P1-7 | **Month View with Trip/Commitment Overlay** | Month grid showing: trip ribbons across days, commitment deadline dots, family event markers. High-altitude planning view. | M |
| P1-8 | **Natural Language Event Creation** | "Meet James Thursday 2pm for 45min at his office" -> Sophie parses, creates event with correct timezone, links to contact, suggests prep. | M |

**Total P1 Effort Estimate**: ~5-7 engineering weeks

---

### P2 -- Nice to Have (Future, When Validated)

| # | Feature | Rationale | Effort |
|---|---------|-----------|--------|
| P2-1 | **Scheduling Links (Calendly-like)** | Generate a link that shows your availability. Relevant when user starts taking investor meetings at scale. Build only if user requests pile up. | L |
| P2-2 | **Multi-Participant Timezone Optimizer** | "Find a time that works for me (Singapore), James (London), and Sarah (San Francisco)" -- Sophie suggests optimal windows. | M |
| P2-3 | **Calendar Analytics / Time Audit** | "You spent 18 hours in meetings this week, 3 hours on investor relations, 0 hours on deep work." Weekly report. | M |
| P2-4 | **Predictive Scheduling** | Sophie learns patterns: "You usually take investor calls Tuesday/Thursday morning. Want me to block those windows?" | L |
| P2-5 | **Meeting Notes Integration** | Post-meeting: auto-extract commitments from meeting notes/transcript and link them to the calendar event retroactively. | L |
| P2-6 | **Team Member Availability Overlay** | See key team members' free/busy status when planning. Requires calendar access permissions. | M |
| P2-7 | **Smart Commute/Transit Time** | Auto-insert travel time between in-person meetings based on location data. | S |
| P2-8 | **Drag-to-Reschedule with Conflict Check** | Drag an event to a new time; Sophie immediately checks for new conflicts before confirming. | M |

---

### Not Applicable -- Explicitly Out of Scope

| Feature | Why Not |
|---------|---------|
| **Full calendar CRUD (recurring events, complex invite management)** | Google Calendar does this well. Chief is the intelligence layer, not the data layer. Rebuilding this is wasted effort. |
| **Auto-rescheduling without user consent** | Chief's positioning is "AI recommends, human decides." Silent rescheduling (like Clockwise/Reclaim) violates trust. Sophie suggests; user confirms. Always. |
| **Team-wide calendar optimization** | Chief is for the individual founder. Team scheduling is a fundamentally different product (see: Clockwise's failure/acquisition). |
| **Video conferencing integration** | Don't build a Zoom/Meet launcher. Link to the meeting URL in the event -- that's it. |
| **Email from calendar** | Email module already exists. Don't duplicate. Link to it contextually. |
| **Room booking** | Enterprise feature. Not our user. |
| **Shared family calendar editing** | Chief reads family calendars as constraints. It does not manage them. Family members use their own calendar app. |
| **Public holiday / weather overlays** | Low value, easy to find elsewhere. Possible P3 if trivial to add. |

---

## 7. Technical Considerations

### Architecture Decisions

**Read-through, Write-selective model**:
- Chief syncs events FROM Google Calendar / Outlook (existing capability)
- Chief writes TO Google Calendar only for Sophie-suggested actions (new blocks, reschedules) -- always user-confirmed
- Chief never modifies events it didn't create (foreign events are read-only)
- Commitment-calendar links stored in Supabase, not in Google Calendar metadata

**Conflict Detection**:
- Runs on every calendar sync (webhook or poll)
- Compares: calendar events + commitment deadlines + trip blocks + family events
- Stores detected conflicts in Supabase with status (OPEN / RESOLVED / DISMISSED)
- Sophie generates resolution suggestions via LLM call with full context

**Timezone Handling**:
- All events stored in UTC internally
- Display timezone derived from: (1) active trip destination, (2) device timezone, (3) user home timezone setting
- Home timezone is a user setting (default: Asia/Singapore)
- Dual rail always shows home + current

### Dependencies

| System | Needed For | Risk |
|--------|-----------|------|
| Google Calendar API (write) | Sophie one-tap actions | Low -- well-documented, already have read access |
| Trip module data | Trip ribbon, timezone auto-detect | Low -- already exists |
| Commitment module data | Calendar linking, deadline overlay | Low -- already exists |
| Family calendar sync | Hard constraint detection | Medium -- need to identify which synced calendars are "family" |
| Contact module data | Attendee intelligence cards | Low -- already exists |

### Open Questions

- [ ] **Calendar write scope**: Do we already have Google Calendar write permissions in the OAuth scope, or do we need to request an upgrade? -- Owner: Tiger -- Deadline: Before dev start
- [ ] **Family calendar identification**: How does the user designate which Google Calendar(s) are "family"? Settings toggle per synced calendar? Auto-detect by calendar name? -- Owner: Tiger -- Deadline: Design phase
- [ ] **Conflict detection frequency**: Real-time via webhook vs. poll every 5 minutes vs. on-app-open? Webhook is ideal but requires Google Push Notifications setup. -- Owner: Eng -- Deadline: Week 1

---

## 8. Visual/UX Deep Dive: What Makes This Different

### Why the "Command View" is Not Just Another Calendar

| Traditional Calendar | Chief Command View |
|---------------------|-------------------|
| Shows events by time | Shows events by time AND stakes |
| All events look the same (colored blocks) | Events visually encode type, priority, and commitment status |
| Conflicts shown as overlapping blocks | Conflicts shown with severity classification and resolution suggestions |
| Timezone is a settings toggle | Timezone is always visible, trip-aware, attendee-annotated |
| No concept of "what's at risk" | Commitment heat bar and overdue badges create urgency awareness |
| User must context-switch to see commitments, trips, contacts | Everything overlaid on one surface with progressive disclosure |
| Calendar is passive | Calendar is proactive -- Sophie speaks from it |

### Mobile-First Considerations

The founder checks the calendar on their phone between meetings. Mobile must be exceptional.

**Mobile Day View**:
```
+--------------------------------+
| Tue Mar 31 | SGT | +0 from home|
| Sophie: 2 items need attention |
+--------------------------------+
| CONFLICTS (1)            [tap] |
| COMMITMENTS DUE (2)     [tap] |
+--------------------------------+
|  8:00  Team standup            |
|        [commitment: weekly OKR]|
|  9:00  James Chen - Investor   |
|        [VIP] [commitment: deck]|
|        [!] No prep time blocked|
| 10:00  >>> Flight SIN>TYO >>>  |
| ...                            |
|  3:00  Kid piano recital       |
|        HARD CONSTRAINT         |
+--------------------------------+
| [+Sophie] Ask AI about today   |
+--------------------------------+
```

**Key mobile decisions**:
- Intelligence Panel collapses into expandable cards at the top (conflicts, commitments, suggestions)
- Trip ribbon becomes a thin banner below the date header
- Dual timezone shown as compact annotation, not full rail
- Swipe left/right for day navigation
- Pull down for Sophie refresh

### Information Hierarchy (Most to Least Prominent)

1. **Conflicts and alerts** -- red/amber, top of screen
2. **Current/next event** -- largest visual treatment
3. **Sophie suggestions** -- actionable, always visible
4. **Commitment badges** -- on events, glanceable
5. **Trip/timezone context** -- passive, always present
6. **Contact intelligence** -- on tap/hover, progressive disclosure
7. **Week summary stats** -- bottom of Intelligence Panel

---

## 9. Implementation Phased Rollout

### Phase 1: Foundation (Weeks 1-3)
- Command View day layout with semantic event type encoding
- Dual timezone rail
- Trip ribbon overlay (read from existing trip data)
- Family calendar designation in settings

### Phase 2: Intelligence (Weeks 4-6)
- Conflict detection engine
- Commitment-calendar auto-linking
- Sophie daily brief on calendar
- Family hard constraint enforcement

### Phase 3: Actions (Weeks 7-8)
- One-tap Sophie actions (Google Calendar write API)
- Conflict resolution cards
- Smart prep time suggestions
- Week view with commitment heat bar

### Phase 4: Polish and P1 Features (Weeks 9-12)
- Week Ahead brief (in-app + WhatsApp)
- "What Changed" diff view
- Contact intelligence on events
- Natural language event creation
- Travel buffer detection
- Month view with overlays

---

## 10. Launch Plan

| Phase | Date | Audience | Success Gate |
|-------|------|----------|-------------|
| Internal alpha | Week 4 | Tiger only | Core flow usable, no data corruption on calendar writes |
| Design partner beta | Week 6 | 3-5 founder friends | Calendar opened daily, conflict detection useful in >50% of cases |
| Early access | Week 10 | All Pro users | Calendar becomes top-2 most visited screen |
| GA | Week 12 | All users | Metrics on target |

**Rollback Criteria**: If any calendar write action corrupts a user's Google Calendar data (creates duplicate events, deletes events, wrong timezone), immediately disable write capabilities and revert to read-only mode.

---

## 11. What Success Looks Like

The founder opens Chief at 6:15am before a flight to Tokyo. In 5 seconds they see:

> **Tuesday, March 31 -- Singapore (SGT) | Landing Tokyo (JST, +1h) at 4pm**
>
> Sophie: "You have 1 conflict and 2 commitments due today."
>
> **CONFLICT**: Your 3pm standup overlaps with the flight. *[Move to 8am? One tap.]*
>
> **COMMITMENTS DUE**: Send investor deck to James (today). Review contract draft (today).
> *[Block 1hr this morning for deck prep? One tap.]*
>
> Your schedule: 8am standup (if moved), 9am investor call with James [VIP, deck commitment], 10am-4pm flight, 5pm free (jet lag buffer), 6pm dinner with Tokyo partner.
>
> Family: Kid piano recital Thursday 4pm -- HARD. You'll be back by then.

That is what an AI Chief of Staff calendar looks like. Not a grid of colored blocks. A **briefing**.

---

## Appendix

### Competitive Landscape Summary

| App | Strength | Chief's Differentiation |
|-----|----------|------------------------|
| Google Calendar | Ubiquitous, reliable CRUD | Chief adds intelligence layer on top; doesn't replace it |
| Fantastical | Beautiful UI, natural language, calendar sets | Chief adds commitment awareness, travel intelligence, AI recommendations |
| Amie | AI meeting notes, modern design | Chief is broader -- not just meetings, but commitments + travel + family |
| Notion Calendar | Deep workspace integration | Chief integrates with communication channels (email, WhatsApp), not docs |
| Cal.com / Calendly | Scheduling links, booking pages | Chief is inward-facing (your schedule), not outward-facing (booking pages) |
| Reclaim | AI time blocking, focus time | Chief doesn't auto-reschedule; recommends instead. Adds commitment + travel layers Reclaim lacks. |
| Motion | Task-to-calendar automation | Chief is about awareness and action, not project management |

### Key Research Sources

- [Fantastical features review (G2)](https://www.g2.com/products/fantastical/reviews)
- [Amie Calendar review (ClickUp)](https://clickup.com/blog/amie-calendar-review/)
- [Notion Calendar review (Efficient App)](https://efficient.app/apps/notion-calendar)
- [Cal.com AI scheduling agents](https://cal.com/agents)
- [Reclaim AI calendar](https://reclaim.ai/)
- [AI scheduling assistants comparison (Lindy)](https://www.lindy.ai/blog/ai-scheduling-assistant)
- [AI calendar assistants comparison (UseCarly)](https://www.usecarly.com/blog/best-ai-calendar-assistant/)
- [Clockwise sunsetting announcement](https://reclaim.ai/blog/clockwise-vs-reclaim)
- [Calendar UI design patterns (Eleken)](https://www.eleken.co/blog-posts/calendar-ui)
- [Timezone management for travelers (Morgen)](https://www.morgen.so/guides/manage-multiple-time-zones-in-your-calendar)
