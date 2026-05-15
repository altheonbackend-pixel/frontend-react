import { type Prescription } from '../../../../shared/types';
import { TabSkeleton } from '../../../../shared/components/SectionCard';

interface MedicationsTabProps {
    medsLoading: boolean;
    displayedMeds: Prescription[];
    showAllMeds: boolean;
    setShowAllMeds: (v: boolean) => void;
    handleToggleVisibleToPatient: (resource: 'conditions' | 'allergies' | 'prescriptions', itemId: number, current: boolean) => void;
    handleMarkPrescriptionInactive: (rxId: number) => void;
    handleMarkPrescriptionActive: (rxId: number) => void;
    navigateToConsultation: (consultId: number) => void;
}

const MedicationsTab = ({
    medsLoading,
    displayedMeds,
    showAllMeds,
    setShowAllMeds,
    handleToggleVisibleToPatient,
    handleMarkPrescriptionInactive,
    handleMarkPrescriptionActive,
    navigateToConsultation,
}: MedicationsTabProps) => {
    return (
        <div className="tab-panel">
            <div className="tab-panel-header">
                <h3>{showAllMeds ? 'All Medications' : 'Active Medications'}</h3>
                <div className="view-toggle">
                    <button type="button" className={`view-toggle-btn${!showAllMeds ? ' active' : ''}`} onClick={() => setShowAllMeds(false)}>Active</button>
                    <button type="button" className={`view-toggle-btn${showAllMeds ? ' active' : ''}`} onClick={() => setShowAllMeds(true)}>All</button>
                </div>
            </div>
            {medsLoading ? (
                <TabSkeleton rows={3} />
            ) : displayedMeds.length === 0 ? (
                <p className="muted">{showAllMeds ? 'No medications on record.' : 'No active medications on record.'}</p>
            ) : (
                <ul className="detail-list">
                    {displayedMeds.map(rx => (
                        <li key={rx.id} className="detail-list-item" style={{ opacity: rx.is_active ? 1 : 0.55 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong>{rx.medication_name}</strong>
                                {rx.is_active ? (
                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', border: '1px solid var(--color-success)' }}>
                                        Active
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                        Inactive
                                    </span>
                                )}
                            </div>
                            <div className="info-item"><strong>Dosage:</strong> {rx.dosage}</div>
                            <div className="info-item"><strong>Frequency:</strong> {rx.frequency_display || rx.frequency}</div>
                            {rx.duration_days && <div className="info-item"><strong>Duration:</strong> {rx.duration_days} days</div>}
                            {rx.instructions && <div className="info-item"><strong>Instructions:</strong> {rx.instructions}</div>}
                            <div className="info-item" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                Prescribed: {new Date(rx.prescribed_at).toLocaleDateString()}
                            </div>
                            <div className="entry-actions">
                                {rx.is_active ? (
                                    <>
                                        <button
                                            onClick={() => handleToggleVisibleToPatient('prescriptions', rx.id, rx.visible_to_patient ?? true)}
                                            className="action-button"
                                            style={{ color: rx.visible_to_patient !== false ? 'var(--success)' : 'var(--accent)' }}
                                        >
                                            {rx.visible_to_patient !== false ? '✓ Patient can see' : 'Show to patient'}
                                        </button>
                                        <button
                                            onClick={() => handleMarkPrescriptionInactive(rx.id)}
                                            className="action-button"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            Mark Inactive
                                        </button>
                                        {rx.consultation && (
                                            <button
                                                onClick={() => navigateToConsultation(rx.consultation!)}
                                                className="action-button"
                                                style={{ color: 'var(--accent)' }}
                                            >
                                                View Consultation →
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleMarkPrescriptionActive(rx.id)}
                                            className="action-button"
                                            style={{ color: 'var(--color-success-dark)' }}
                                        >
                                            Mark Active
                                        </button>
                                        {rx.consultation && (
                                            <button
                                                onClick={() => navigateToConsultation(rx.consultation!)}
                                                className="action-button"
                                                style={{ color: 'var(--accent)' }}
                                            >
                                                View Consultation →
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default MedicationsTab;
