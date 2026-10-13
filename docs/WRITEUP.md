# brightwheel Front Desk: one-page write-up

**What it is.**
An AI front desk with two sides.
Parents ask by text, voice or a guided flow, and get a specific, cited answer from their center's own documents in about a second.
Directors connect the tools they already keep up to date (Notion, Google Drive, Google Calendar), see what families ask, and close every gap from one inbox.

**Who it's for, and the job.**
A director at 7:40am is answering the same ten questions by phone, text and email.
Parents want the answer now, from the school, not a guess.
I optimized for three things:
- the answer is specific and checkable (it always shows its source)
- the system says "I don't know" instead of guessing, and routes that question to the director
- nothing private reaches a parent, even when the source documents are messy

**Scope I chose.**
- Two fictional schools: one tidy (Notion only) and one deliberately chaotic (Notion, Drive and Calendar).
  The chaotic one hides payroll, an incident report, a custody order, building codes and two conflicting illness policies.
- The parent surface works fully on a phone.
- The operator surface covers what makes quality visible and improvable: an outcomes dashboard, a gaps inbox, conversations, a knowledge editor, Privacy Guard and sources.

**AI where it helps, code where it must be certain.**
- Rules in code run before any model and are instant and free.
  They cover emergencies (911 first), building codes, other families' information, injection attempts, and one child's records, which go to a person.
- Hybrid retrieval combines meaning and exact words, fused with reciprocal rank fusion, in Postgres.
- Gemini writes a structured answer that must cite the passages it used.
  Code rejects uncited or ungrounded answers and computes facts like "open now" itself.
- Gemini also reviews documents for sensitive meaning at ingest, once per change, so cost scales with content, not traffic.

**Uncertainty and failure modes.**
- Weak retrieval, an ungrounded flag, or a fake citation each turn into an honest "I don't have that yet".
  The question becomes an Inbox item, so the system learns where it's thin.
- When two documents disagree, it uses the current one, never cites the stale one, and asks the director to retire it.
- If the model is unavailable or over its daily cap, answers fall back to extractive mode instead of failing.

**Privacy.**
Privacy Guard is data loss prevention for a childcare knowledge base.
- Checksum-verified detectors (card and routing numbers) and shape detectors (SSNs, codes, contacts) run first.
- Context rules flag a named person's health, custody, incidents or wages, and AI review catches meaning the patterns miss.
- Held text is masked from search until a director chooses Redact, Staff only or It's fine.
- Records files stay staff-only whole, every answer is scanned before it streams, and every decision is audited.

**Operator control.**
- Directors see answered vs. needed-staff, hours saved, ratings, top questions and top sources.
- Gaps are answered in their own words and published instantly, and the families who asked see the answer on their home screen.
- "Ask a test question" shows exactly what a parent would get after an edit.

**Cost.**
$0 by default: the Gemini free tier with a key that has no billing, Supabase free and Vercel Hobby.
A daily cap bounds usage, and tests, CI and evals run on deterministic stubs.

**How I know it works.**
- 56 unit tests and 55 Playwright journeys on desktop and phone.
- Zero WCAG 2.2 AA violations in light and dark.
- A 44-case eval suite in my in-house harness, with adversarial, privacy and safety gated at 100%.

**Limitations.**
- Sign-in is a demo shortcut, and family notifications are simulated.
- Google Calendar works for test users until Google verifies the app.
- Detectors are US- and English-centric.

**Next.**
Slack alerts for unanswered questions with an in-thread Answer button (staff answer where they already work), approved write-back (draft replies the director approves), per-family answers from brightwheel's own data, proactive Spotlight nudges, multilingual answers, and turning thumbs-down answers into eval cases automatically.
