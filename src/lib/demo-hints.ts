/**
 * Demo guidance only. For each seeded conflict, the clause a first-time evaluator should mark
 * Disputed so the conflict reaches Legal. Any clause in the conflict would do. This only picks
 * where the hints point. It changes no rule.
 */
export const DISPUTE_START: Record<string, { termId: string; label: string }> = {
  C1: { termId: "T06", label: "T06, Schedule A Note 2 (fixed-rate note)" },
};

export const DISPUTE_HINT =
  "Legal can rule only after a clause is marked Disputed with a question. If every clause is marked Clear, the line stays Needs Legal with nothing for Legal to rule on.";
