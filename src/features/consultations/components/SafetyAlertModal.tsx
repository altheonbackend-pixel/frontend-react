// CR-P0-02 / CR-P0-01: doctor-facing override workflow.
//
// When the safety preview returns alerts, this modal shows the
// allergy / DDI hits, lets the doctor read each one, and — for
// blocking alerts — REQUIRES a written reason before they can
// "Prescribe anyway". Reasons are persisted as AllergyOverride /
// InteractionOverride audit rows on the backend.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SafetyResult } from './DrugAutocomplete';

interface SafetyAlertModalProps {
    drugName: string;
    safety: SafetyResult;
    onCancel: () => void;
    onConfirm: (overridePayload: {
        allergy_overrides: { allergen: string; matched_value: string; reason: string }[];
        interaction_overrides: { existing_drug_rxcui: string; reason: string }[];
    }) => void;
}

function severityBadge(severity: string) {
    const colors: Record<string, { bg: string; fg: string }> = {
        life_threatening: { bg: '#7f1d1d', fg: 'white' },
        severe: { bg: '#dc2626', fg: 'white' },
        contraindicated: { bg: '#7f1d1d', fg: 'white' },
        major: { bg: '#dc2626', fg: 'white' },
        moderate: { bg: '#f59e0b', fg: '#451a03' },
        mild: { bg: '#fde68a', fg: '#451a03' },
        minor: { bg: '#fde68a', fg: '#451a03' },
        unknown: { bg: '#e5e7eb', fg: '#1f2937' },
    };
    const c = colors[severity] || { bg: '#e5e7eb', fg: '#1f2937' };
    return (
        <span style={{
            display: 'inline-block', padding: '2px 8px', borderRadius: 4,
            fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase',
            background: c.bg, color: c.fg,
        }}>{severity.replace('_', ' ')}</span>
    );
}

export function SafetyAlertModal({ drugName, safety, onCancel, onConfirm }: SafetyAlertModalProps) {
    const { t } = useTranslation();
    const [allergyReasons, setAllergyReasons] = useState<Record<string, string>>({});
    const [interactionReasons, setInteractionReasons] = useState<Record<string, string>>({});

    const blockingAllergies = safety.allergy_alerts.filter(a => a.blocks);
    const blockingInteractions = safety.interaction_alerts.filter(i => i.blocks);
    const totalBlocking = blockingAllergies.length + blockingInteractions.length;

    const allReasonsProvided = (
        blockingAllergies.every(a => {
            const key = `${a.allergen}|${a.matched_value}`;
            return (allergyReasons[key] || '').trim().length >= 5;
        })
        && blockingInteractions.every(i => {
            return (interactionReasons[i.existing_drug_rxcui] || '').trim().length >= 5;
        })
    );

    const handleConfirm = () => {
        onConfirm({
            allergy_overrides: blockingAllergies.map(a => ({
                allergen: a.allergen,
                matched_value: a.matched_value,
                reason: allergyReasons[`${a.allergen}|${a.matched_value}`] || '',
            })),
            interaction_overrides: blockingInteractions.map(i => ({
                existing_drug_rxcui: i.existing_drug_rxcui,
                reason: interactionReasons[i.existing_drug_rxcui] || '',
            })),
        });
    };

    return (
        <div
            role="dialog"
            aria-labelledby="safety-modal-title"
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                background: 'rgba(15,23,42,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '1rem',
            }}
        >
            <div style={{
                background: 'white', borderRadius: 12, maxWidth: 720, width: '100%',
                maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 60px rgba(0,0,0,0.3)',
            }}>
                <div style={{
                    padding: '1.25rem 1.5rem', borderBottom: '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                }}>
                    <div>
                        <h2 id="safety-modal-title" style={{ margin: 0, fontSize: '1.25rem' }}>
                            ⚠️ {t('safety.modal.title', 'Prescription safety alerts')}: {drugName}
                        </h2>
                        <p style={{ margin: '0.5rem 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                            {totalBlocking > 0
                                ? t('safety.modal.subtitle_blocking', '{{count}} alert(s) block this prescription. Document a clinical reason to proceed.', { count: totalBlocking })
                                : t('safety.modal.subtitle_review', 'Review the warnings below.')}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onCancel}
                        aria-label={t('common.close', 'Close')}
                        style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer' }}
                    >
                        ✕
                    </button>
                </div>

                <div style={{ padding: '1rem 1.5rem' }}>
                    {safety.allergy_alerts.length > 0 && (
                        <section style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{t('safety.modal.allergy_section', 'Allergy conflicts')}</h3>
                            {safety.allergy_alerts.map((a, idx) => {
                                const key = `${a.allergen}|${a.matched_value}`;
                                return (
                                    <div key={idx} style={{
                                        border: '1px solid #fecaca', borderRadius: 8,
                                        padding: '0.75rem 1rem', marginBottom: '0.5rem',
                                        background: '#fff7f7',
                                    }}>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 4 }}>
                                            {severityBadge(a.severity)}
                                            <strong>{a.allergen}</strong>
                                            {a.blocks && <span style={{ color: '#7f1d1d', fontSize: '0.75rem' }}>{t('safety.modal.blocks', '(BLOCKS)')}</span>}
                                        </div>
                                        <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>{a.message}</p>
                                        {a.reaction_description && (
                                            <p style={{ margin: '0.25rem 0', color: '#7f1d1d', fontSize: '0.8125rem' }}>
                                                {t('safety.modal.documented_reaction', 'Documented reaction:')} {a.reaction_description}
                                            </p>
                                        )}
                                        {a.blocks && (
                                            <textarea
                                                value={allergyReasons[key] || ''}
                                                onChange={(e) => setAllergyReasons({ ...allergyReasons, [key]: e.target.value })}
                                                placeholder={t('safety.modal.override_placeholder', 'Required: clinical reason to override (min 5 chars).')}
                                                rows={2}
                                                className="form-input"
                                                style={{ width: '100%', marginTop: 8 }}
                                            />
                                        )}
                                    </div>
                                );
                            })}
                        </section>
                    )}

                    {safety.interaction_alerts.length > 0 && (
                        <section style={{ marginBottom: '1rem' }}>
                            <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>{t('safety.modal.interaction_section', 'Drug-drug interactions')}</h3>
                            {safety.interaction_alerts.map((i, idx) => (
                                <div key={idx} style={{
                                    border: '1px solid #fde68a', borderRadius: 8,
                                    padding: '0.75rem 1rem', marginBottom: '0.5rem',
                                    background: '#fffbeb',
                                }}>
                                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: 4 }}>
                                        {severityBadge(i.severity)}
                                        <strong>{i.new_drug_name} + {i.existing_drug_name}</strong>
                                        {i.blocks && <span style={{ color: '#7f1d1d', fontSize: '0.75rem' }}>{t('safety.modal.blocks', '(BLOCKS)')}</span>}
                                    </div>
                                    <p style={{ margin: '0.25rem 0', fontSize: '0.875rem' }}>{i.description}</p>
                                    {i.management && (
                                        <p style={{ margin: '0.25rem 0', color: '#1f2937', fontSize: '0.8125rem' }}>
                                            <strong>{t('safety.modal.management', 'Management:')}</strong> {i.management}
                                        </p>
                                    )}
                                    {i.blocks && (
                                        <textarea
                                            value={interactionReasons[i.existing_drug_rxcui] || ''}
                                            onChange={(e) => setInteractionReasons({ ...interactionReasons, [i.existing_drug_rxcui]: e.target.value })}
                                            placeholder={t('safety.modal.override_placeholder', 'Required: clinical reason to override (min 5 chars).')}
                                            rows={2}
                                            className="form-input"
                                            style={{ width: '100%', marginTop: 8 }}
                                        />
                                    )}
                                </div>
                            ))}
                        </section>
                    )}
                </div>

                <div style={{
                    padding: '1rem 1.5rem', borderTop: '1px solid #e5e7eb',
                    display: 'flex', justifyContent: 'flex-end', gap: '0.5rem',
                }}>
                    <button type="button" className="btn btn-secondary" onClick={onCancel}>
                        {t('safety.modal.cancel', 'Cancel prescription')}
                    </button>
                    {totalBlocking > 0 ? (
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={!allReasonsProvided}
                            onClick={handleConfirm}
                            style={{ background: '#dc2626', borderColor: '#dc2626' }}
                        >
                            {t('safety.modal.prescribe_anyway', 'Prescribe anyway with documented reason')}
                        </button>
                    ) : (
                        <button type="button" className="btn btn-primary" onClick={handleConfirm}>
                            {t('safety.modal.acknowledge', 'Acknowledge and continue')}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SafetyAlertModal;
