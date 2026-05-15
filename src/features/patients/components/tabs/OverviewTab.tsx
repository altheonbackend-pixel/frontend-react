import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { type PatientWithHistory, type Prescription } from '../../../../shared/types';
import { toast } from '../../../../shared/components/ui';
import { queryKeys } from '../../../../shared/queryKeys';

const CONDITION_STATUS_COLORS: Record<string, string> = {
    active: '#e53e3e',
    chronic: '#d69e2e',
    in_remission: '#3182ce',
    resolved: '#38a169',
};

const SEVERITY_COLORS: Record<string, string> = {
    mild: '#38a169',
    moderate: '#d69e2e',
    severe: '#e53e3e',
    life_threatening: '#742a2a',
};

interface PatientAppointment {
    id: number;
    appointment_date: string;
    status: string;
    status_display?: string;
    reason_for_appointment: string;
    appointment_type?: string;
}

interface OverviewTabProps {
    patient: PatientWithHistory;
    id: string;
    medications: Prescription[];
    clinicalAlerts: any[];
    alertsLoading: boolean;
    dismissedVitalAlerts: Set<number>;
    setDismissedVitalAlerts: (v: Set<number>) => void;
    vitalAcknowledging: boolean;
    setVitalAcknowledging: (v: boolean) => void;
    handleTabChange: (tab: string) => void;
    handleAcknowledgeAlert: (alertId: number) => void;
    setExpandedConsultIds: (v: Set<number>) => void;
    patientAppointments: PatientAppointment[];
    pendingRequests: any[];
}

const OverviewTab = ({
    patient,
    id,
    medications,
    clinicalAlerts,
    alertsLoading,
    dismissedVitalAlerts,
    setDismissedVitalAlerts,
    vitalAcknowledging,
    setVitalAcknowledging,
    handleTabChange,
    handleAcknowledgeAlert,
    setExpandedConsultIds,
    patientAppointments,
    pendingRequests,
}: OverviewTabProps) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const activeAllergies = patient.allergy_records?.filter(a => a.is_active) || [];

    const now = new Date();
    const upcomingAppointment = patientAppointments
        .filter(a => new Date(a.appointment_date) >= now && a.status !== 'cancelled')
        .sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime())[0];

    return (
        <div className="tab-panel">
            {/* Vital alert banner */}
            {(() => {
                const latest = patient.consultations?.[0];
                if (!latest?.has_vital_alerts || dismissedVitalAlerts.has(latest.id)) return null;
                const reasons = latest.vital_alert_reasons ?? [];
                const handleAcknowledge = async () => {
                    setVitalAcknowledging(true);
                    try {
                        setDismissedVitalAlerts(new Set([...dismissedVitalAlerts, latest.id]));
                        queryClient.invalidateQueries({ queryKey: queryKeys.dashboard() });
                        toast.success('Vital alert acknowledged.');
                    } catch {
                        toast.error('Failed to acknowledge alert.');
                    } finally {
                        setVitalAcknowledging(false);
                    }
                };
                return (
                    <div className="vital-alert-banner">
                        <span className="vital-alert-icon">⚠</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <strong>Vital Alert</strong> — {new Date(latest.consultation_date).toLocaleDateString()}
                            <div className="vital-alert-chips">
                                {reasons.map((r, i) => <span key={i} className="vital-alert-chip">{r}</span>)}
                            </div>
                        </div>
                        <button className="btn-ghost-sm" onClick={() => {
                            setExpandedConsultIds(new Set([latest.id]));
                            handleTabChange('consultations');
                        }}>View →</button>
                        <button className="btn-ghost-sm" disabled={vitalAcknowledging} onClick={handleAcknowledge}>
                            {vitalAcknowledging ? '…' : 'Acknowledge'}
                        </button>
                    </div>
                );
            })()}

            {/* Clinical Alerts banner */}
            {!alertsLoading && clinicalAlerts.length > 0 && (
                <div style={{ marginBottom: 'var(--space-3)' }}>
                    {clinicalAlerts.map((alert: any) => (
                        <div key={alert.id} className="vital-alert-banner" style={{ borderColor: alert.severity === 'critical' ? 'var(--error)' : 'var(--warning)' }}>
                            <span className="vital-alert-icon">🔔</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <strong>{alert.title}</strong>
                                {alert.body && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{alert.body}</div>}
                            </div>
                            <button className="btn-ghost-sm" onClick={() => handleAcknowledgeAlert(alert.id)}>Acknowledge</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Vitals snapshot strip */}
            {(() => {
                const c = patient.consultations?.[0];
                if (!c) return null;
                const chips = [
                    c.blood_pressure_display ? { label: 'BP', value: c.blood_pressure_display, warn: (c.bp_systolic ?? 0) >= 140 } : null,
                    c.sp2 ? { label: 'SpO₂', value: `${c.sp2}%`, warn: Number(c.sp2) < 94 } : null,
                    c.temperature ? { label: 'Temp', value: `${c.temperature}°C`, warn: Number(c.temperature) > 38.5 } : null,
                    c.weight ? { label: 'Wt', value: `${c.weight} kg`, warn: false } : null,
                ].filter(Boolean) as { label: string; value: string; warn: boolean }[];
                if (!chips.length) return null;
                return (
                    <div className="snapshot-strip">
                        <span className="snapshot-label">Latest vitals — {new Date(c.consultation_date).toLocaleDateString()}</span>
                        <div className="snapshot-chips">
                            {chips.map(chip => (
                                <span key={chip.label} className={`snapshot-chip${chip.warn ? ' snapshot-chip--warn' : ''}`}>
                                    <span className="snapshot-chip-label">{chip.label}</span>
                                    {chip.value}
                                </span>
                            ))}
                        </div>
                    </div>
                );
            })()}

            <div className="pt-overview-grid">
                {/* Left column */}
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                    {/* Personal Info card */}
                    <div className="pt-card">
                        <div className="pt-card-head">
                            <span className="pt-card-title">Personal Information</span>
                        </div>
                        <div className="pt-card-body">
                            <div className="pt-info-row">
                                <span className="pt-info-label">Date of Birth</span>
                                <span>{patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString() : 'N/A'}</span>
                            </div>
                            <div className="pt-info-row">
                                <span className="pt-info-label">Age</span>
                                <span>{patient.age || 'N/A'}</span>
                            </div>
                            <div className="pt-info-row">
                                <span className="pt-info-label">Blood Group</span>
                                <span>{patient.blood_group || 'N/A'}</span>
                            </div>
                            <div className="pt-info-row">
                                <span className="pt-info-label">Phone</span>
                                <span>{patient.phone_number || 'N/A'}</span>
                            </div>
                            <div className="pt-info-row">
                                <span className="pt-info-label">Email</span>
                                <span>{patient.email || 'N/A'}</span>
                            </div>
                            {(patient.emergency_contact_name || patient.emergency_contact_number) && (
                                <div className="pt-info-row">
                                    <span className="pt-info-label">Emergency</span>
                                    <span>{patient.emergency_contact_name || ''} {patient.emergency_contact_number ? `(${patient.emergency_contact_number})` : ''}</span>
                                </div>
                            )}
                            {patient.address && (
                                <div className="pt-info-row">
                                    <span className="pt-info-label">Address</span>
                                    <span>{patient.address}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Recent Consultations card */}
                    <div className="pt-card">
                        <div className="pt-card-head">
                            <span className="pt-card-title">Recent Consultations</span>
                            <button className="pt-card-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleTabChange('consultations')}>
                                View all →
                            </button>
                        </div>
                        <div className="pt-card-body">
                            {patient.consultations?.length ? (
                                patient.consultations.slice(0, 3).map(c => (
                                    <div key={c.id} className="mini-consultation">
                                        <div className="mini-consult-date">{new Date(c.consultation_date).toLocaleDateString()}</div>
                                        <div className="mini-consult-reason">{c.reason_for_consultation}</div>
                                        {c.follow_up_date && <div className="follow-up-chip">Follow-up: {new Date(c.follow_up_date + 'T00:00:00').toLocaleDateString()}</div>}
                                    </div>
                                ))
                            ) : (
                                <p className="muted">No consultations yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
                    {/* Next Appointment card */}
                    <div className={`pt-card${upcomingAppointment ? ' pt-appt-card' : ''}`}>
                        <div className="pt-card-head">
                            <span className="pt-card-title">Next Appointment</span>
                            <button
                                className="pt-card-link"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                                onClick={() => handleTabChange('portal')}
                            >
                                All appointments →
                            </button>
                        </div>
                        <div className="pt-card-body">
                            {upcomingAppointment ? (
                                <>
                                    <div className="pt-appt-date">
                                        {new Date(upcomingAppointment.appointment_date).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <div className="pt-appt-meta">{upcomingAppointment.reason_for_appointment}</div>
                                    {upcomingAppointment.appointment_type && (
                                        <div className="pt-appt-meta" style={{ marginTop: '0.25rem' }}>
                                            {upcomingAppointment.appointment_type === 'telemedicine' ? '📹 Telemedicine' : '🏥 In person'}
                                        </div>
                                    )}
                                    <span className={`status-badge status-${upcomingAppointment.status}`} style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
                                        {upcomingAppointment.status_display || upcomingAppointment.status}
                                    </span>
                                </>
                            ) : (
                                <>
                                    <p className="pt-appt-none">No upcoming appointments.</p>
                                    <button
                                        className="btn-add-primary"
                                        style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0.75rem' }}
                                        onClick={() => navigate(`/appointments?patient_id=${id}`)}
                                    >
                                        Book →
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Conditions & Allergies card */}
                    <div className="pt-card">
                        <div className="pt-card-head">
                            <span className="pt-card-title">Conditions & Allergies</span>
                            <button className="pt-card-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleTabChange('history')}>
                                View History →
                            </button>
                        </div>
                        <div className="pt-card-body">
                            {patient.conditions?.filter(c => c.status !== 'resolved').slice(0, 3).map(c => (
                                <div key={c.id} className="mini-condition">
                                    <span className="condition-dot" style={{ background: CONDITION_STATUS_COLORS[c.status] }} />
                                    <span>{c.name}</span>
                                    <span className="condition-status-label">{c.status_display || c.status}</span>
                                </div>
                            ))}
                            {!patient.conditions?.filter(c => c.status !== 'resolved').length && (
                                <p className="muted" style={{ marginBottom: activeAllergies.length ? '0.5rem' : 0 }}>No active conditions.</p>
                            )}
                            {activeAllergies.length > 0 && (
                                <>
                                    <hr style={{ margin: '0.5rem 0', borderColor: 'var(--border-subtle)' }} />
                                    {activeAllergies.slice(0, 2).map(a => (
                                        <div key={a.id} className="mini-allergy">
                                            <span className="severity-dot" style={{ background: SEVERITY_COLORS[a.severity] }} />
                                            {a.allergen}
                                            <span className="allergy-type-label">{a.reaction_type_display || a.reaction_type}</span>
                                        </div>
                                    ))}
                                    {activeAllergies.length > 2 && (
                                        <p className="muted" style={{ fontSize: 'var(--text-xs)', margin: '4px 0 0' }}>+{activeAllergies.length - 2} more</p>
                                    )}
                                </>
                            )}
                            {!activeAllergies.length && !patient.conditions?.length && (
                                <p className="muted">No conditions or allergies recorded.</p>
                            )}
                        </div>
                    </div>

                    {/* Active Medications card — only when data is present */}
                    {medications.length > 0 && (
                        <div className="pt-card">
                            <div className="pt-card-head">
                                <span className="pt-card-title">Active Medications ({medications.length})</span>
                                <button className="pt-card-link" style={{ background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleTabChange('medications')}>
                                    View all →
                                </button>
                            </div>
                            <div className="pt-card-body">
                                {medications.slice(0, 3).map(rx => (
                                    <div key={rx.id} className="mini-medication">
                                        <span className="med-name">{rx.medication_name}</span>
                                        <span className="med-detail">{rx.dosage} · {rx.frequency_display || rx.frequency}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OverviewTab;
