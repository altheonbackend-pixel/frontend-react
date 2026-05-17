// CR-P0-01 / CR-P0-02: doctor-facing drug picker. The doctor never
// types ingredients or interaction data by hand — they pick the drug
// by name and the backend resolves everything via RxNorm.
//
// As they pick, we live-call the safety preview endpoint so allergy
// and DDI alerts appear BEFORE they hit Save.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';

export interface DrugChoice {
    rxcui: string;
    name: string;
    tty: string;
    ingredient_names?: string[];
    drug_classes?: string[];
}

export interface AllergyAlertDTO {
    severity: 'mild' | 'moderate' | 'severe' | 'life_threatening';
    severity_rank: number;
    allergen: string;
    matched_on: 'ingredient' | 'class' | 'name';
    matched_value: string;
    reaction_description: string;
    blocks: boolean;
    message: string;
}

export interface InteractionAlertDTO {
    severity: 'contraindicated' | 'major' | 'moderate' | 'minor' | 'unknown';
    severity_rank: number;
    new_drug_rxcui: string;
    new_drug_name: string;
    existing_drug_rxcui: string;
    existing_drug_name: string;
    description: string;
    management: string;
    blocks: boolean;
    message: string;
}

export interface SafetyResult {
    allergy_alerts: AllergyAlertDTO[];
    interaction_alerts: InteractionAlertDTO[];
    blocked: boolean;
    nkda_required?: boolean;
}

interface SearchResult {
    rxcui: string;
    name: string;
    tty: string;
    score: number;
}

interface DrugAutocompleteProps {
    patientId: string;
    value?: DrugChoice | null;
    onSelect: (drug: DrugChoice | null, safety: SafetyResult | null) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

const SEARCH_DEBOUNCE_MS = 250;

export function DrugAutocomplete({
    patientId, value, onSelect, placeholder, autoFocus,
}: DrugAutocompleteProps) {
    const { t } = useTranslation();
    const [term, setTerm] = useState<string>(value?.name ?? '');
    const [open, setOpen] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (autoFocus) inputRef.current?.focus();
    }, [autoFocus]);

    useEffect(() => {
        if (!term || term.length < 2) {
            setResults([]);
            return;
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            setError(null);
            try {
                const res = await api.get('/drugs/search/', { params: { q: term, limit: 15 } });
                setResults(res.data.results ?? []);
                setOpen(true);
            } catch {
                setError(t('drug_autocomplete.error_suggestions', 'Could not load drug suggestions.'));
            } finally {
                setLoading(false);
            }
        }, SEARCH_DEBOUNCE_MS);
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [term]);

    const handlePick = async (item: SearchResult) => {
        setTerm(item.name);
        setOpen(false);
        setLoading(true);
        try {
            // Resolve full drug details (cached after first hit).
            const detailRes = await api.get(`/drugs/${item.rxcui}/`);
            const drug: DrugChoice = {
                rxcui: detailRes.data.rxcui,
                name: detailRes.data.name,
                tty: detailRes.data.tty,
                ingredient_names: detailRes.data.ingredient_names,
                drug_classes: detailRes.data.drug_classes,
            };

            // Live safety preview against this patient.
            const safetyRes = await api.get(
                `/drugs/${item.rxcui}/safety/`,
                { params: { patient: patientId } },
            );
            onSelect(drug, safetyRes.data);
        } catch {
            setError(t('drug_autocomplete.error_safety', 'Could not load drug safety preview.'));
            onSelect(null, null);
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        setTerm('');
        setResults([]);
        onSelect(null, null);
        inputRef.current?.focus();
    };

    return (
        <div className="drug-autocomplete" style={{ position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <input
                    ref={inputRef}
                    type="text"
                    className="form-input"
                    value={term}
                    onChange={(e) => { setTerm(e.target.value); }}
                    onFocus={() => results.length && setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 150)}
                    placeholder={placeholder ?? t('drug_autocomplete.placeholder', 'Search drug by name (e.g. amoxicillin)…')}
                    autoComplete="off"
                    aria-autocomplete="list"
                    aria-expanded={open}
                />
                {term && (
                    <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={handleClear}
                        aria-label={t('drug_autocomplete.clear', 'Clear drug selection')}
                    >
                        ✕
                    </button>
                )}
            </div>

            {loading && <div className="form-help">{t('drug_autocomplete.searching', 'Searching…')}</div>}
            {error && <div className="form-error">{error}</div>}

            {open && results.length > 0 && (
                <ul
                    className="drug-autocomplete-list"
                    role="listbox"
                    style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        zIndex: 50, background: 'white',
                        border: '1px solid #d1d5db', borderRadius: '0.5rem',
                        marginTop: 4, maxHeight: 280, overflowY: 'auto',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', padding: 0,
                    }}
                >
                    {results.map((item) => (
                        <li
                            key={item.rxcui}
                            role="option"
                            tabIndex={0}
                            onMouseDown={(e) => { e.preventDefault(); handlePick(item); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { e.preventDefault(); handlePick(item); }
                            }}
                            style={{
                                listStyle: 'none', padding: '0.5rem 0.75rem',
                                borderBottom: '1px solid #f3f4f6', cursor: 'pointer',
                                display: 'flex', justifyContent: 'space-between', gap: '0.5rem',
                            }}
                        >
                            <span>{item.name}</span>
                            <small style={{ color: '#6b7280' }}>{item.tty}</small>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export default DrugAutocomplete;
