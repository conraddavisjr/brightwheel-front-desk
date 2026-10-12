import type { Tone } from "@/components/ui/Pill";

export const TOPIC_LABEL: Record<string, string> = {
  illness: "Illness",
  tuition: "Tuition and fees",
  hours: "Hours",
  calendar: "Closures",
  events: "Events",
  meals: "Meals",
  enrollment: "Tours and enrollment",
  pickup: "Drop-off and pickup",
  daily_care: "Daily care",
  policies: "Policies",
  staff: "Staff and classrooms",
  communication: "Communication",
  other: "Other",
  general: "General",
};

export const OUTCOME_PILL: Record<string, { label: string; tone: Tone }> = {
  answered: { label: "Answered", tone: "success" },
  unsure: { label: "No answer yet", tone: "info" },
  handoff: { label: "Sent to staff", tone: "accent" },
  care: { label: "Safety", tone: "danger" },
  declined: { label: "Declined", tone: "neutral" },
};
