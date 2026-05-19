import { type Prescription } from '../../../../shared/types';
import { useTranslation } from 'react-i18next';
import { TabSkeleton } from '../../../../shared/components/SectionCard';
import { useFormatDateTime } from '../../../../shared/hooks/useUserTimezone';

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
    const { t } = useTranslation();
    const { formatDate } = useFormatDateTime();
    return (
        <div className="tab-panel">
            <div className="tab-panel-header">
                <h3>{showAllMeds ? t('patient_record.medications.all') : t('patient_record.medications.active')}</h3>
                <div className="view-toggle">
                    <button type="button" className={`view-toggle-btn${!showAllMeds ? ' active' : ''}`} onClick={() => setShowAllMeds(false)}>{t('common.status.active')}</button>
                    <button type="button" className={`view-toggle-btn${showAllMeds ? ' active' : ''}`} onClick={() => setShowAllMeds(true)}>{t('patient_record.medications.all_filter')}</button>
                </div>
            </div>
            {medsLoading ? (
                <TabSkeleton rows={3} />
            ) : displayedMeds.length === 0 ? (
                <p className="muted">{showAllMeds ? t('patient_record.medications.none') : t('patient_record.medications.none_active')}</p>
            ) : (
                <ul className="detail-list">
                    {displayedMeds.map(rx => (
                        <li key={rx.id} className="detail-list-item" style={{ opacity: rx.is_active ? 1 : 0.55 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong>{rx.medication_name}</strong>
                                {rx.is_active ? (
                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--color-success-light)', color: 'var(--color-success-dark)', border: '1px solid var(--color-success)' }}>
                                        {t('common.status.active')}
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 10px', borderRadius: '12px', background: 'var(--bg-subtle)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}>
                                        {t('common.status.inactive')}
                                    </span>
                                )}
                            </div>
                            <div className="info-item"><strong>{t('patient_record.medications.dosage')}:</strong> {rx.dosage}</div>
                            <div className="info-item"><strong>{t('patient_record.medications.frequency')}:</strong> {rx.frequency_display || rx.frequency}</div>
                            {rx.duration_days && <div className="info-item"><strong>{t('patient_record.medications.duration')}:</strong> {t('consultation.view.duration_days', { count: rx.duration_days })}</div>}
                            {rx.instructions && <div className="info-item"><strong>{t('patient_record.medications.instructions')}:</strong> {rx.instructions}</div>}
                            <div className="info-item" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {t('patient_record.medications.prescribed', { date: formatDate(rx.prescribed_at) })}
                            </div>
                            <div className="entry-actions">
                                {rx.is_active ? (
                                    <>
                                        <button
                                            onClick={() => handleToggleVisibleToPatient('prescriptions', rx.id, rx.visible_to_patient ?? true)}
                                            className="action-button"
                                            style={{ color: rx.visible_to_patient !== false ? 'var(--success)' : 'var(--accent)' }}
                                        >
                                            {rx.visible_to_patient !== false ? t('patient_record.medications.patient_can_see') : t('patient_record.medications.show_to_patient')}
                                        </button>
                                        <button
                                            onClick={() => handleMarkPrescriptionInactive(rx.id)}
                                            className="action-button"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            {t('patient_record.medications.mark_inactive')}
                                        </button>
                                        {rx.consultation && (
                                            <button
                                                onClick={() => navigateToConsultation(rx.consultation!)}
                                                className="action-button"
                                                style={{ color: 'var(--accent)' }}
                                            >
                                                {t('appointments.view_consultation')}
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
                                            {t('patient_record.medications.mark_active')}
                                        </button>
                                        {rx.consultation && (
                                            <button
                                                onClick={() => navigateToConsultation(rx.consultation!)}
                                                className="action-button"
                                                style={{ color: 'var(--accent)' }}
                                            >
                                                {t('appointments.view_consultation')}
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
