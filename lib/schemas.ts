import { z } from "zod";

/**
 * The single source of shapes shared by the server, the model's structured
 * output, the stream protocol and the UI.
 */

export const CARD_KINDS = ["answer", "hours", "tuition", "event", "steps", "menu", "tour", "contact"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

/** What the model returns. Flat on purpose: structured output is more reliable without unions. */
export const ModelAnswerSchema = z.object({
  grounded: z
    .boolean()
    .describe("true only if the sources below directly answer the question. false if they do not, or only partly."),
  kind: z.enum(CARD_KINDS).describe("Which card shows the answer best."),
  headline: z.string().describe("The direct answer in one short sentence, warm and plain. No preamble."),
  body: z.string().describe("Two to four short sentences of supporting detail, all taken from the sources."),
  facts: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe("Key/value rows for hours, fees or menus, copied exactly from the sources. Empty if not useful."),
  steps: z
    .array(z.object({ title: z.string(), detail: z.string() }))
    .describe("Ordered steps or checklist items for policies and how-tos. Empty if not useful."),
  eventIds: z.array(z.string()).describe("Ids like E1 of calendar events that answer the question. Empty if none."),
  citations: z.array(z.string()).describe("Ids like S1 of every source passage used. Never empty when grounded."),
  followUps: z.array(z.string()).describe("Up to three short follow-up questions a parent might ask next."),
});
export type ModelAnswer = z.infer<typeof ModelAnswerSchema>;

export const CitationSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  title: z.string(),
  heading: z.string(),
  excerpt: z.string(),
  url: z.string().nullable(),
  sourceKind: z.string(),
  updatedAt: z.string().nullable(),
});
export type Citation = z.infer<typeof CitationSchema>;

export const EventCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  allDay: z.boolean(),
  location: z.string().nullable(),
  description: z.string().nullable(),
  timezone: z.string(),
});
export type EventCard = z.infer<typeof EventCardSchema>;

export const OUTCOMES = ["answered", "unsure", "declined", "handoff", "care"] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** The card the parent sees. Built in code from the model's answer plus trusted data. */
export const AnswerCardSchema = z.object({
  outcome: z.enum(OUTCOMES),
  kind: z.enum(CARD_KINDS),
  headline: z.string(),
  body: z.string(),
  facts: z.array(z.object({ label: z.string(), value: z.string() })),
  steps: z.array(z.object({ title: z.string(), detail: z.string() })),
  events: z.array(EventCardSchema),
  citations: z.array(CitationSchema),
  followUps: z.array(z.string()),
  /** Present when we hand off to staff (unsure, sensitive, declined with a route). */
  handoff: z
    .object({ reason: z.string(), phone: z.string().nullable(), email: z.string().nullable(), gapLogged: z.boolean() })
    .nullable(),
  /** Hours card: computed in code from the school's hours, never by the model. */
  openNow: z.object({ open: z.boolean(), label: z.string() }).nullable(),
});
export type AnswerCard = z.infer<typeof AnswerCardSchema>;

/** Newline-delimited JSON events streamed by POST /api/ask. */
export type AskEvent =
  | { type: "start"; conversationId: string }
  | { type: "ack"; text: string }
  | { type: "status"; phase: "checking" | "searching" | "reading" | "writing"; label: string }
  | { type: "partial"; card: Partial<AnswerCard> }
  | {
      type: "done";
      messageId: string;
      card: AnswerCard;
      topic: string;
      latencyMs: number;
    }
  | { type: "error"; message: string; retryable: boolean };

export const AskRequestSchema = z.object({
  question: z.string().trim().min(1).max(2000),
  conversationId: z.string().uuid().nullable().optional(),
  channel: z.enum(["text", "voice", "guided"]).default("text"),
});

export const PRIVACY_CATEGORIES = [
  "child_record",
  "family_safety",
  "health_record",
  "staff_hr",
  "financial",
  "facility_security",
  "embargoed",
  "credentials",
  "personal_contact",
  "custom",
] as const;
export type PrivacyCategory = (typeof PRIVACY_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<PrivacyCategory, string> = {
  child_record: "Child record",
  family_safety: "Family safety",
  health_record: "Health information",
  staff_hr: "Staff HR and payroll",
  financial: "Financial account",
  facility_security: "Building security",
  embargoed: "Not yet announced",
  credentials: "Password or secret",
  personal_contact: "Personal identifiers",
  custom: "Your rule",
};

export const FindingSchema = z.object({
  category: z.enum(PRIVACY_CATEGORIES),
  label: z.string(),
  start: z.number().int(),
  end: z.number().int(),
  excerpt: z.string(),
  detector: z.enum(["pattern", "ai"]),
  confidence: z.number(),
  reason: z.string(),
  ruleId: z.string().nullable().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;
