import "server-only";
import { generateText, Output } from "ai";
import { z } from "zod";
import { config } from "@/lib/config";
import { canCallModel, gemini, meter } from "@/lib/ai/provider";
import { PRIVACY_CATEGORIES, type Finding, type PrivacyCategory } from "@/lib/schemas";
import { sentenceAround } from "@/lib/privacy/detect";

/**
 * Privacy Guard, layer 2: a model reads for meaning the patterns cannot see
 * ("Ava's mom said the separation is getting ugly", "we may close the
 * infant room in spring"). It runs once per changed document at ingest,
 * never per question, so its cost scales with content, not traffic.
 *
 * The model quotes the sensitive text; code finds the quote in the document
 * and turns it into a span. A quote that is not in the document is dropped,
 * so the model cannot invent findings.
 */

const ClassifiedSchema = z.object({
  findings: z.array(
    z.object({
      quote: z.string().describe("The exact sensitive text, copied character for character from the document. One sentence at most."),
      category: z.enum(PRIVACY_CATEGORIES),
      reason: z.string().describe("One plain sentence a childcare director would understand."),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

const SYSTEM = `You review documents a childcare center is about to make searchable by parents.
Find text that must NOT be shown to parents. Categories:
- child_record: incident or injury reports, assessments, behavior notes about a specific child
- family_safety: custody, court orders, pickup restrictions, CPS or abuse matters
- health_record: a named person's allergies, medications, diagnoses, immunization status
- staff_hr: wages, payroll, background checks, discipline, performance of named staff
- financial: account numbers, a specific family's balance or collections
- facility_security: door, alarm, gate codes, camera access
- embargoed: unannounced changes (tuition increases, closures, layoffs), open licensing matters
- credentials: passwords, keys
- personal_contact: personal phone, email, address, birth date of a specific person
- custom: matches one of the school's own rules listed below
General policies that apply to every family (fever rules, tuition rates, menus, hours, the school's main phone) are NOT sensitive.
Only report what is really there. Quote exactly. If nothing is sensitive, return an empty list.`;

export async function classifySensitive(
  title: string,
  text: string,
  customRules: Array<{ name: string; description: string }>,
): Promise<{ findings: Finding[]; ran: boolean }> {
  if (!text.trim() || !(await canCallModel())) return { findings: [], ran: false };
  try {
    const rules = customRules.length ? `\nThe school's own rules:\n${customRules.map((r) => `- ${r.name}: ${r.description}`).join("\n")}` : "";
    const { output, usage } = await generateText({
      model: gemini()(config.ai.classifierModel),
      output: Output.object({ schema: ClassifiedSchema }),
      system: SYSTEM + rules,
      prompt: `Document title: ${title}\n\n<document>\n${text.slice(0, 30000)}\n</document>`,
      temperature: 0,
    });
    await meter("classify", usage.inputTokens ?? 0, usage.outputTokens ?? 0);
    const out: Finding[] = [];
    for (const f of output?.findings ?? []) {
      const quote = f.quote.trim();
      if (quote.length < 3) continue;
      const at = text.indexOf(quote);
      if (at < 0) continue;
      const [start, end] = sentenceAround(text, at, at + quote.length);
      out.push({
        category: f.category as PrivacyCategory,
        label: "Flagged by AI review",
        start,
        end,
        excerpt: text.slice(start, end),
        detector: "ai",
        confidence: f.confidence,
        reason: f.reason,
        ruleId: null,
      });
    }
    return { findings: out, ran: true };
  } catch (err) {
    console.error("[privacy] AI classification failed; pattern findings still apply", err);
    return { findings: [], ran: false };
  }
}
