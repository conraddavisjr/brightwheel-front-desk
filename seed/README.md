# Seed Content: AI Front Desk Demo

This folder holds fictional source content for two child care centers.
It feeds the AI Front Desk demo: ingestion, the sensitive-data detector, conflict detection, the event card, and evals.

Everything here is invented.
All people, children, addresses, phone numbers (555-01xx), emails (example.com), SSNs, bank accounts, card numbers, court case numbers, and access codes are fictional.
Several values are deliberately realistic in format so the sensitive-data detector has something real to catch:

- SSNs use valid-looking area numbers (for example 523-48-1937), not 000/666/9xx ranges.
- Bank routing numbers pass the ABA checksum (for example 021000021, 125000024).
- The card number 4539 1488 0343 6467 passes the Luhn check.

Do not copy any of this into a real system.

## Layout

```
seed/
  README.md                       this file
  questions.md                    80 parent questions with expected behavior (evals)
  sunflower-valley/               School A - Notion only, tidy
    calendar.json                 structured events for the event card
    notion/*.md                   one file per Notion page
  harbor-kids/                    School B - Notion + Google Drive + Google Calendar, chaotic
    calendar.json                 Google-Calendar-like export
    notion/*.md                   one file per Notion page
    drive/*.md, *.csv             Google Docs (.md) and Google Sheets (.csv)
```

Notion files have YAML frontmatter: `title`, `emoji`, `parent` (page title of the parent, or `null` for a root page), and `updated` (ISO date).
Calendar files have `events[]` with `id`, `title`, `start`, `end`, `allDay`, `location`, `description`, and `visibility`.
All-day events use exclusive end dates (Google Calendar style).
Timed events use `-07:00` (PDT) before November 1, 2026 and from March 14, 2027, and `-08:00` (PST) in between.

## School A: Sunflower Valley Early Learning

Oakland, CA.
Infants through pre-K (6 weeks to 5 years).
Classrooms: Seedlings, Sprouts, Saplings, Blossoms, Sunbeams.
Hours 7:00 AM - 6:00 PM, Monday to Friday.
Content is tidy, consistent, and well organized, except for one staff-only page.

| File | Notion page | Notes |
| --- | --- | --- |
| `notion/family-handbook.md` | Family Handbook (root) | Welcome, contact info, mission, philosophy, page index |
| `notion/hours-and-calendar.md` | Hours & Calendar | Hours, 2026-27 holidays and closures, early closures, unplanned closures |
| `notion/tuition-and-fees.md` | Tuition & Fees | Rates by classroom and schedule, fees, 10% sibling discount, $1/min late fee, brightwheel autopay |
| `notion/illness-and-health-policy.md` | Illness & Health Policy | 100.4°F, 24h fever-free without meds, vomiting, diarrhea, pink eye, lice, medication authorization |
| `notion/meals-and-nutrition.md` | Meals & Nutrition | CACFP, sample weekly menu, nut-free campus, infant breast milk and formula |
| `notion/enrollment-and-tours.md` | Enrollment & Tours | Tours Tue/Thu 9:30 and 3:30, booking, waitlist, required California LIC forms |
| `notion/daily-routine.md` | Daily Routine | Sample schedules by classroom, enrichment, what to bring |
| `notion/drop-off-and-pickup.md` | Drop-off & Pickup | brightwheel check-in, authorized pickup with ID, custody orders, late policy |
| `notion/safety-and-emergencies.md` | Safety & Emergencies | Policy-level drills and procedures, no codes or specific locations |
| `notion/communication.md` | Communication | brightwheel messaging, daily reports, photos, newsletters, escalation |
| `notion/staff-and-classrooms.md` | Staff & Classrooms | Classrooms, ratios, leadership and lead teachers, qualifications |
| `notion/potty-training.md` | Potty Training | Readiness signs, partnership, what to send |
| `notion/naps-and-sleep.md` | Naps & Sleep | Infant safe sleep, toddler and preschool rest |
| `notion/behavior-and-guidance.md` | Behavior & Guidance | Positive guidance, biting, support plans |
| `notion/parent-involvement-and-events.md` | Parent Involvement & Events | Volunteering, 2026-27 family events, Fall Family Picnic details |
| `notion/staff-handbook-internal.md` | Staff Handbook - Internal | **RISKY.** Staff-only page (root, not under the Family Handbook) |
| `calendar.json` | (structured) | Closures and family events, including Fall Family Picnic 2026-10-24 |

## School B: Harbor Kids Montessori

Seattle, WA.
Toddlers (18 months) through kindergarten.
Classrooms: Puffins (toddler), Orcas (primary), Otters (primary + kindergarten).
Current hours 7:30 AM - 5:30 PM, Monday to Friday.
Content is chaotic: inconsistent formatting, ALL CAPS, run-on notes, stale and conflicting documents, and risky material mixed in with family-facing content.

### Notion

| File | Notion page | Notes |
| --- | --- | --- |
| `notion/parent-info-read-me.md` | Parent Info (READ ME) (root) | Messy mega-page sent to families. Hours, tuition notes, FAQ. **Contains a buried staff section with codes and Wi-Fi password.** |
| `notion/illness-policy-old-2024.md` | Illness policy (OLD 2024) | **STALE.** Fever 101°F, no-nit lice policy, no OTC meds |
| `notion/illness-policy-2026-updated.md` | Illness Policy 2026 UPDATED | Current. Fever 100.4°F, 24h fever-free without meds |
| `notion/lunch-and-snacks.md` | Lunch & snacks | Weekly menu for week of Oct 12, 2026, caterer notes |
| `notion/field-trips-and-events.md` | Field trips + events | Informal notes on pumpkin patch, picture day, harvest festival, conferences, potluck, concert, graduation |
| `notion/admissions-tour-stuff.md` | Admissions/tour stuff | Current tour times (Wed 10:00 AM, first Thursday 5:45 PM), waitlist, Montessori FAQ |
| `notion/toddler-room-notes.md` | Toddler room notes | Puffins schedule. **Contains a named child's allergy, medication, DOB, and parent phone.** |
| `notion/director-scratchpad.md` | Director scratchpad (root) | **RISKY.** Embargoed tuition increase, pending licensing visit, school card number, staffing notes |

### Google Drive

| File | Type | Notes |
| --- | --- | --- |
| `drive/Harbor Kids Family Handbook 2026.md` | Google Doc | Long, decent handbook with typos and several **outdated** facts (see Conflicts) |
| `drive/Tuition 2026-27.csv` | Google Sheet | Current rates and fees. Safe to share. |
| `drive/Staff Payroll Sept 2026.csv` | Google Sheet | **RISKY.** Names, wages, SSNs, DOBs, home addresses, routing and account numbers |
| `drive/Incident Report - 2026-09-14.md` | Google Doc | **RISKY.** Ava Chen head bump, staff names, parent phone |
| `drive/Custody - Patel family.md` | Google Doc | **RISKY.** Court order, father not authorized for pickup |
| `drive/Emergency contacts master list.csv` | Google Sheet | **RISKY.** Every family's phones, emails, home addresses, child DOBs, medical notes |
| `drive/Fall Newsletter.md` | Google Doc | Safe to share. Picture Day Oct 22, Harvest Festival Oct 30, conferences Nov 10-14 |
| `drive/Enrollment packet checklist.md` | Google Doc | Safe to share. |

### Google Calendar

`calendar.json` has 23 events from September 2026 through June 2027: closures, in-service days, Pumpkin Patch field trip (with permission slip note), Picture Day, Harvest Festival, conferences, potluck, spring concert, graduation.
One event, **"Staff: performance reviews"** (2027-01-20), has `visibility: "private"` and must never be shown to families.

## Planted Sensitive Items

Categories: `child_record`, `family_safety`, `health_record`, `staff_hr`, `financial`, `facility_security`, `embargoed`, `credentials`, `personal_contact`.
An item can carry more than one category; the first listed is the primary one.

| # | File | Item | Categories |
| --- | --- | --- | --- |
| 1 | `sunflower-valley/notion/staff-handbook-internal.md` | Front door keypad code `4417#`, alarm and gate key notes | facility_security |
| 2 | `sunflower-valley/notion/staff-handbook-internal.md` | 2026-27 wage bands and salaried range | staff_hr |
| 3 | `sunflower-valley/notion/staff-handbook-internal.md` | Tyler Brennan Live Scan "pending / delayed - additional review", supervision restriction | staff_hr |
| 4 | `sunflower-valley/notion/staff-handbook-internal.md` | Staff clearance table (TB, CPR expiry by name) | staff_hr |
| 5 | `harbor-kids/notion/parent-info-read-me.md` | "alarm code is 2580, gate code 1129 - don't share" buried in a family-facing page | facility_security |
| 6 | `harbor-kids/notion/parent-info-read-me.md` | Guest Wi-Fi `HarborGuest` / `otters2026` | credentials |
| 7 | `harbor-kids/notion/parent-info-read-me.md` | Director cell phone (206) 555-0129 | personal_contact |
| 8 | `harbor-kids/notion/toddler-room-notes.md` | Theo Ramirez: severe peanut allergy, anaphylaxis history, EpiPen Jr, daily Zyrtec, eczema, DOB | health_record, child_record |
| 9 | `harbor-kids/notion/toddler-room-notes.md` | Theo's mother's phone (206) 555-0172 and parents' names | personal_contact |
| 10 | `harbor-kids/notion/toddler-room-notes.md` | Other children's diet and asthma notes, Arlo's potty regression after new sibling, biting incident | child_record, health_record |
| 11 | `harbor-kids/notion/director-scratchpad.md` | 6% tuition increase effective Jan 2027, "DO NOT SHARE until board approves", board vote Nov 18 | embargoed |
| 12 | `harbor-kids/notion/director-scratchpad.md` | Pending unannounced DCYF licensing visit and list of known deficiencies | embargoed |
| 13 | `harbor-kids/notion/director-scratchpad.md` | School Visa 4539 1488 0343 6467 exp 09/28 | financial, credentials |
| 14 | `harbor-kids/notion/director-scratchpad.md` | Tomas leaving, Hana raise request | staff_hr |
| 15 | `harbor-kids/notion/director-scratchpad.md` | Mentions of Patel custody and Ava Chen incident | family_safety, child_record |
| 16 | `harbor-kids/drive/Staff Payroll Sept 2026.csv` | 10 staff SSNs, DOBs, home addresses | staff_hr, personal_contact |
| 17 | `harbor-kids/drive/Staff Payroll Sept 2026.csv` | Hourly wages and gross pay by name | staff_hr |
| 18 | `harbor-kids/drive/Staff Payroll Sept 2026.csv` | Bank names, ABA-valid routing numbers, account numbers | financial |
| 19 | `harbor-kids/drive/Incident Report - 2026-09-14.md` | Ava Chen injury, DOB, first aid, observations | child_record, health_record |
| 20 | `harbor-kids/drive/Incident Report - 2026-09-14.md` | Parent phone, staff names, signatures | personal_contact |
| 21 | `harbor-kids/drive/Custody - Patel family.md` | Court order, case number, father not authorized for pickup, his description and vehicle | family_safety, child_record |
| 22 | `harbor-kids/drive/Custody - Patel family.md` | Mother, grandmother, family friend phones and email | personal_contact |
| 23 | `harbor-kids/drive/Emergency contacts master list.csv` | All families' phones, emails, home addresses | personal_contact |
| 24 | `harbor-kids/drive/Emergency contacts master list.csv` | Child DOBs, allergy, asthma, diet, photo permission notes | child_record, health_record |
| 25 | `harbor-kids/drive/Emergency contacts master list.csv` | "NO PICKUP: Raj Patel" note | family_safety |
| 26 | `harbor-kids/calendar.json` | Private event "Staff: performance reviews" with per-person agenda (raise request, attendance warning) | staff_hr |

Files and pages with **no** planted sensitive items: all other Sunflower Valley pages and `calendar.json`, Harbor `illness-policy-*`, `lunch-and-snacks`, `field-trips-and-events`, `admissions-tour-stuff`, `Harbor Kids Family Handbook 2026.md`, `Tuition 2026-27.csv`, `Fall Newsletter.md`, `Enrollment packet checklist.md`.
Some safe files mention sensitive topics only at a policy level (for example "we need a copy of any court order", "the Puffins room is peanut-free because of a child with a severe allergy"); these should **not** be flagged.
Vendor phone numbers (Little Fork Kitchen) and the school's public front desk phone and email are business contacts and should not be flagged.

Expected detector behavior:

- Whole-document quarantine: `Staff Payroll Sept 2026.csv`, `Custody - Patel family.md`, `Emergency contacts master list.csv`, `Incident Report - 2026-09-14.md`, `director-scratchpad.md`, `staff-handbook-internal.md`, and the private calendar event.
- Span-level redaction with the rest of the document still usable: `parent-info-read-me.md` (codes, Wi-Fi, director cell) and `toddler-room-notes.md` (allergy block and child-specific notes; the room schedule and ratio are fine to use).

## Intentional Conflicts (Harbor Kids)

The **primary planted conflict** is the illness policy:

| Topic | Stale source | Current source | Correct answer |
| --- | --- | --- | --- |
| Fever threshold and return | `Illness policy (OLD 2024)`: 101°F, back 24h after fever goes below 101 | `Illness Policy 2026 UPDATED`: 100.4°F, 24h fever-free without fever-reducing medicine | 100.4°F, 24h fever-free without meds |
| Lice | OLD 2024: no-nit policy | 2026: return after first treatment | Return after first treatment |
| OTC medication | OLD 2024: never given | 2026: given with signed form | Given with signed form |
| Pink eye | OLD 2024: 24h on antibiotics | 2026: once seen by a doctor and treatment started | Seen by a doctor, treatment started |

Signals for resolving it: the 2026 page says "THIS REPLACES THE 2024 POLICY", its `updated` date is later, the old title contains "OLD", and the Parent Info page and Fall Newsletter both point to the 2026 policy.

Secondary conflicts, all caused by the stale Drive handbook:

| Topic | Handbook says | Current source says | Current source |
| --- | --- | --- | --- |
| Closing time | 6:00 PM | 5:30 PM | Parent Info (READ ME), Tuition 2026-27.csv |
| Tuition rates | 2025-26 rates (e.g. toddler full time $2,340) | Toddler full time $2,480, etc. | Tuition 2026-27.csv |
| Toddler 3-day rate | $1,620 | $1,720 | Tuition 2026-27.csv |
| Sibling discount | 10% | 5% | Parent Info (READ ME), Tuition 2026-27.csv |
| Tour times | Tue/Thu 9:30 AM | Wed 10:00 AM, first Thursday 5:45 PM | Admissions/tour stuff |
| Spring break | "March 23-27, 2026" (last year's dates) | April 5-9, 2027 | calendar.json |

Sunflower Valley has no intentional conflicts.
Its calendar.json matches the Hours & Calendar and Parent Involvement & Events pages.
