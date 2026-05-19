import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast } from '../../../shared/components/ui';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import { patientPortalService } from '../services/patientPortalService';

const ACCESS_REQUESTS_KEY = ['patient-portal', 'access-requests'] as const;

/**
 * Workflow B2 — inbox of doctor → patient access requests.
 *
 * Each pending request can be Approved (grants a 24h one-time-visit
 * CareTeamMembership) or Rejected. Approved/rejected/expired requests stay
 * in the list for transparency.
 */
export default function PatientAccessRequests() {
    const { t } = useTranslation();
    const qc = useQueryClient();
    const { formatDateTime } = useFormatDateTime();
    usePageTitle(t('patient_portal.access_requests.document_title', 'Access requests'));

    const { data, isLoading, isError } = useQuery({
        queryKey: ACCESS_REQUESTS_KEY,
        queryFn: patientPortalService.listAccessRequests,
        staleTime: 30_000,
        refetchInterval: 30_000,
    });

    const approve = useMutation({
        mutationFn: patientPortalService.approveAccessRequest,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_REQUESTS_KEY });
            toast.success(t('patient_portal.access_requests.approved_toast', 'Access granted.'));
        },
        onError: () => {
            toast.error(t('patient_portal.access_requests.error_generic', 'Something went wrong.'));
        },
    });

    const reject = useMutation({
        mutationFn: patientPortalService.rejectAccessRequest,
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ACCESS_REQUESTS_KEY });
            toast.success(t('patient_portal.access_requests.rejected_toast', 'Request declined.'));
        },
        onError: () => {
            toast.error(t('patient_portal.access_requests.error_generic', 'Something went wrong.'));
        },
    });

    const results = data?.results ?? [];

    return (
        <>
            <PageHeader
                title={t('patient_portal.access_requests.title', 'Access requests')}
                subtitle={t(
                    'patient_portal.access_requests.subtitle',
                    'Doctors who have asked to view your medical record.',
                )}
            />
            <SectionCard>
                {isLoading && (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)' }}>
                        {t('patient_portal.common.loading')}
                    </div>
                )}
                {isError && (
                    <div className="error-message" style={{ padding: '1rem' }}>
                        {t('patient_portal.access_requests.error.load', 'Could not load requests.')}
                    </div>
                )}
                {!isLoading && !isError && results.length === 0 && (
                    <div
                        style={{
                            padding: '2rem',
                            color: 'var(--text-muted)',
                            textAlign: 'center',
                        }}
                    >
                        {t('patient_portal.access_requests.empty', 'No access requests right now.')}
                    </div>
                )}
                {results.map(req => {
                    const pending = req.status === 'pending';
                    const expired = new Date(req.expires_at).getTime() < Date.now();
                    const showActions = pending && !expired;
                    return (
                        <div
                            key={req.id}
                            style={{
                                padding: '1rem',
                                borderBottom: '1px solid var(--border-muted, #e5e7eb)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                                <strong>Dr. {req.doctor_name}</strong>
                                <span
                                    style={{
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    {req.status}{expired && pending ? ' · expired' : ''}
                                </span>
                            </div>
                            {req.doctor_specialty && (
                                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                                    {req.doctor_specialty}
                                </div>
                            )}
                            {req.reason && (
                                <div style={{ fontSize: '0.875rem' }}>{req.reason}</div>
                            )}
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {t('patient_portal.access_requests.created', 'Requested')}{' '}
                                {formatDateTime(req.created_at)}
                                {pending && !expired && (
                                    <> · {t('patient_portal.access_requests.expires', 'expires')}{' '}
                                    {formatDateTime(req.expires_at)}</>
                                )}
                            </div>
                            {showActions && (
                                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem' }}>
                                    <button
                                        type="button"
                                        className="btn btn-primary btn-sm"
                                        onClick={() => approve.mutate(req.id)}
                                        disabled={approve.isPending}
                                    >
                                        {t('patient_portal.access_requests.approve', 'Approve')}
                                    </button>
                                    <button
                                        type="button"
                                        className="btn btn-secondary btn-sm"
                                        onClick={() => reject.mutate(req.id)}
                                        disabled={reject.isPending}
                                    >
                                        {t('patient_portal.access_requests.reject', 'Decline')}
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </SectionCard>
        </>
    );
}
