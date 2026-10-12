import { possessive } from "@/lib/text";
import type { Route } from "@/lib/guard/router";
import type { AnswerCard } from "@/lib/schemas";

/**
 * What we say when the guard routes a question away from search. Written
 * like a kind, competent front desk: say what we can't do, why in a few
 * words, and the fastest real path to help. Never a dead end.
 */

export interface SchoolContact {
  name: string;
  shortName: string;
  phone: string | null;
  email: string | null;
}

const blank = (): Omit<AnswerCard, "outcome" | "kind" | "headline" | "body"> => ({
  facts: [],
  steps: [],
  events: [],
  citations: [],
  followUps: [],
  handoff: null,
  openNow: null,
});

export function routeCard(route: Exclude<Route, { action: "answer" }>, school: SchoolContact): AnswerCard {
  const phone = school.phone;
  const contact = { phone, email: school.email };
  if (route.action === "care") {
    if (route.kind === "emergency") {
      return {
        ...blank(),
        outcome: "care",
        kind: "contact",
        headline: "If this is an emergency, call 911 now.",
        body: `Then let ${school.shortName} know${phone ? ` at ${phone}` : ""}. I'm an assistant for school questions and can't help in an emergency.`,
        steps: [
          { title: "Call 911", detail: "For breathing trouble, choking, severe allergic reactions, serious injuries or poisoning." },
          { title: "Poison Control", detail: "1-800-222-1222, free and open 24/7." },
          { title: `Call ${school.shortName}`, detail: phone ? `${phone}, once your child is safe.` : "Once your child is safe." },
        ],
        handoff: { reason: "Emergency", ...contact, gapLogged: false },
      };
    }
    return {
      ...blank(),
      outcome: "care",
      kind: "contact",
      headline: "You don't have to handle this alone.",
      body: `If anyone is in immediate danger, call 911. For support right now, you can call or text 988 any time. ${possessive(school.shortName)} director is also here to help, privately.`,
      steps: [
        { title: "988 Suicide & Crisis Lifeline", detail: "Call or text 988, 24/7." },
        { title: "Childhelp National Child Abuse Hotline", detail: "1-800-422-4453, 24/7." },
        { title: `Talk to the director`, detail: phone ? `Call ${phone}.` : "Message the front desk." },
      ],
      handoff: { reason: "Wellbeing", ...contact, gapLogged: false },
    };
  }

  if (route.action === "handoff") {
    const copy: Record<typeof route.kind, { headline: string; body: string }> = {
      child_record: {
        headline: "I can't see your child's records, but your teachers can.",
        body: "Today's naps, meals and photos are in your child's daily report in the brightwheel app. For anything else about your child, message the front desk and staff will reply.",
      },
      legal: {
        headline: "This is best handled directly with the director.",
        body: "Custody, legal and safety matters are handled privately by staff, never by an assistant. Please call or message the director, and bring any court documents to the office.",
      },
      concern: {
        headline: "Thank you for telling us. The director should hear this directly.",
        body: "Concerns about care are taken seriously and handled privately. Please call the director, or message the front desk and they will reach out today.",
      },
      billing_account: {
        headline: "Your own account details live in the brightwheel app.",
        body: "Open Billing in the brightwheel app to see your invoices and payments. If something looks wrong, message the front desk and the office will sort it out.",
      },
    };
    const c = copy[route.kind];
    return { ...blank(), outcome: "handoff", kind: "contact", headline: c.headline, body: c.body, handoff: { reason: route.reason, ...contact, gapLogged: false } };
  }

  const decline: Record<typeof route.kind, { headline: string; body: string }> = {
    injection: {
      headline: `I can only help with questions about ${school.shortName}.`,
      body: "Try asking about hours, tuition, illness policy, meals, tours or upcoming events.",
    },
    security: {
      headline: "I can't share access codes or passwords.",
      body: "For everyone's safety, building codes and passwords are only shared in person by staff. Please check with the front desk.",
    },
    privacy: {
      headline: "I can't share information about other families, children or staff.",
      body: "Everyone's privacy matters here, including yours. If you need to reach another family, the front desk can pass along your contact info with your permission.",
    },
    off_topic: {
      headline: `I'm here for questions about ${school.shortName}.`,
      body: "I can help with hours, tuition, health policies, meals, tours, events and more.",
    },
    abuse: {
      headline: "I'm here to help with school questions.",
      body: "If something is frustrating, the front desk would like to hear about it. Message them any time.",
    },
    empty: {
      headline: "I didn't catch a question there.",
      body: "Try asking something like \"What time do you open?\" or \"Is my child too sick to come in?\"",
    },
  };
  const d = decline[route.kind];
  return {
    ...blank(),
    outcome: "declined",
    kind: "answer",
    headline: d.headline,
    body: d.body,
    followUps: ["What are your hours?", "What's the illness policy?", "What's coming up this month?"],
  };
}
