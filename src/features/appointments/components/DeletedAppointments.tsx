// src/features/appointments/components/DeletedAppointments.tsx
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import '../styles/Appointments.css';
import api from '../../../shared/services/api';
import { PageHeader } from '../../../shared/components/PageHeader';
import { TabSkeleton } from '../../../shared/components/SectionCard';

const DeletedAppointments = () => {
    const { t, i18n } = useTranslation();
    const { isAuthenticated } = useAuth();
    const [deletedAppointments, setDeletedAppointments] = useState<Array<{
        id: number;
        patient_details: { first_name: string; last_name: string };
        doctor_details: { full_name: string };
        appointment_date: string;
        deletion_date: string;
        deletion_reason: string;
        deletion_comment?: string;
    }>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDeletedAppointments = async () => {
        setIsLoading(true);
        setError(null);
        if (!isAuthenticated) {
            setError(t('deleted_appointments.error.auth'));
            setIsLoading(false);
            return;
        }

        try {
            const response = await api.get('/appointments/deleted/');
            setDeletedAppointments(response.data.results ?? response.data);
        } catch {
            setError(t('deleted_appointments.error.fetch'));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDeletedAppointments();
    }, [isAuthenticated]);

    return (
        <>
            <PageHeader
                title={t('deleted_appointments.title', 'Deleted Appointments')}
                breadcrumb={[{ label: t('appointments.title', 'Appointments'), href: '/appointments' }]}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {isLoading && (
                    <div className="section-card"><div className="section-card-body"><TabSkeleton rows={3} /></div></div>
                )}
                {error && <div className="error-message">{error}</div>}
                {!isLoading && deletedAppointments.length === 0 && !error && (
                    <div className="section-card">
                        <div className="section-card-body">
                            <div className="empty-state">
                                <div className="empty-state-icon">🗑️</div>
                                <div className="empty-state-title">{t('deleted_appointments.no_data', 'No deleted appointments.')}</div>
                            </div>
                        </div>
                    </div>
                )}
                {!isLoading && deletedAppointments.map(appt => (
                    <div key={appt.id} className="section-card">
                        <div className="section-card-body">
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem', fontSize: '0.875rem' }}>
                                <div><span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Patient</span><div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{appt.patient_details.first_name} {appt.patient_details.last_name}</div></div>
                                <div><span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Doctor</span><div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{appt.doctor_details.full_name}</div></div>
                                <div><span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Original Date</span><div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{new Date(appt.appointment_date).toLocaleString(i18n.language)}</div></div>
                                <div><span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deleted On</span><div style={{ color: 'var(--text-primary)', marginTop: '2px' }}>{new Date(appt.deletion_date).toLocaleString(i18n.language)}</div></div>
                                <div><span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</span><div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{t(`delete_appointment.reason.${appt.deletion_reason}`, appt.deletion_reason)}</div></div>
                                {appt.deletion_comment && (
                                    <div><span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comment</span><div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{appt.deletion_comment}</div></div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </>
    );
};

export default DeletedAppointments;