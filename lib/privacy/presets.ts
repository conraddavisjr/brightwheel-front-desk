import type { PrivacyCategory } from "@/lib/schemas";

/**
 * The protected-info rules every school starts with. They are written for a
 * director, not a lawyer: what it covers, why, and the standard behind it.
 * A school can turn any of them off (with an audit entry) and add its own.
 *
 * The standards named here shaped the list; this demo does not claim
 * compliance with any of them.
 */
export interface PresetRule {
  key: string;
  category: PrivacyCategory;
  name: string;
  description: string;
  basis: string;
}

export const PRESET_RULES: PresetRule[] = [
  {
    key: "child-health",
    category: "health_record",
    name: "A child's health details",
    description: "Allergies, medications, diagnoses, immunization status or exemptions tied to a named child.",
    basis: "Child care licensing confidentiality rules (e.g. CA Title 22, WA WAC 110-300); HIPAA-style minimum necessary.",
  },
  {
    key: "child-records",
    category: "child_record",
    name: "Individual child records",
    description: "Incident and injury reports, developmental screenings, IEP or IFSP plans, observations about one child.",
    basis: "FERPA-style education record privacy; state licensing record confidentiality.",
  },
  {
    key: "custody",
    category: "family_safety",
    name: "Custody and court orders",
    description: "Custody arrangements, restraining or protective orders, who is not allowed to pick up a child.",
    basis: "Family safety. Disclosure can put a child at risk.",
  },
  {
    key: "pickup",
    category: "family_safety",
    name: "Authorized pickup lists",
    description: "Names of the adults approved to pick up a specific child.",
    basis: "Family safety and licensing sign-in/out requirements.",
  },
  {
    key: "child-protection",
    category: "family_safety",
    name: "Child protection reports",
    description: "Anything about CPS contact, mandated reports or suspected abuse or neglect.",
    basis: "State mandated-reporter confidentiality laws.",
  },
  {
    key: "identifiers",
    category: "personal_contact",
    name: "Personal identifiers",
    description: "Social Security numbers, dates of birth, home addresses, personal phone numbers and emails of families or staff.",
    basis: "NIST SP 800-122 PII guidance; COPPA limits on children's personal information.",
  },
  {
    key: "payroll",
    category: "staff_hr",
    name: "Staff pay and payroll",
    description: "Wages, salaries, wage bands, bonuses, payroll exports.",
    basis: "Employee privacy; state wage record confidentiality.",
  },
  {
    key: "hr",
    category: "staff_hr",
    name: "Staff HR records",
    description: "Background check status, fingerprinting results, discipline, performance reviews, I-9 details.",
    basis: "FCRA (background checks); employment record privacy.",
  },
  {
    key: "banking",
    category: "financial",
    name: "Bank and card numbers",
    description: "Card numbers, bank routing and account numbers, tax IDs.",
    basis: "PCI DSS (cards); GLBA-style financial privacy.",
  },
  {
    key: "balances",
    category: "financial",
    name: "Family balances and collections",
    description: "What a specific family owes, late payments, collections notes.",
    basis: "Financial privacy; families should only see their own billing in brightwheel.",
  },
  {
    key: "codes",
    category: "facility_security",
    name: "Door, gate and alarm codes",
    description: "Keypad codes, alarm codes, gate combinations, lockbox codes, camera system access.",
    basis: "Physical security of children and staff.",
  },
  {
    key: "secrets",
    category: "credentials",
    name: "Passwords and keys",
    description: "Wi-Fi and account passwords, API keys, tokens.",
    basis: "Basic security hygiene (OWASP, CIS controls).",
  },
  {
    key: "embargo",
    category: "embargoed",
    name: "Not yet announced",
    description: "Drafts marked do-not-share: tuition changes before approval, closures, staffing changes, layoffs.",
    basis: "Director controls the timing of family communication.",
  },
  {
    key: "licensing",
    category: "embargoed",
    name: "Open licensing matters",
    description: "Pending inspections, citations, complaints or corrective action plans.",
    basis: "Public licensing records exist, but the director decides how to communicate open matters.",
  },
];
