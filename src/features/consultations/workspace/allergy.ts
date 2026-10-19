import type { PatientAllergy } from '../../../shared/types';

/** Name match against recorded drug allergies — works without the drug knowledge base. */
export function nameAllergyMatches(name: string, allergies: PatientAllergy[]) {
    const n = name.trim().toLowerCase();
    if (n.length < 3) return [];
    return allergies.filter(a => a.is_active && a.reaction_type === 'drug' && (
        n.includes(a.allergen.toLowerCase()) || a.allergen.toLowerCase().includes(n)
    ));
}
