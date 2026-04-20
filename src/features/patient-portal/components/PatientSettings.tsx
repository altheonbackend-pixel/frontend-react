import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService, type PatientPortalSettings } from '../services/patientPortalService';

export default function PatientSettings() {
    usePageTitle('Patient Settings');
    const queryClient = useQueryClient();
    const [pwForm, setPwForm] = useState({ current_password: '', new_password: '', confirm_password: '' });
    const [pwError, setPwError] = useState('');

    const { mutate: changePassword, isPending: isChangingPw } = useMutation({
        mutationFn: () => patientPortalService.changePassword(pwForm),
        onSuccess: () => {
            toast.success('Password changed successfully.');
            setPwForm({ current_password: '', new_password: '', confirm_password: '' });
            setPwError('');
        },
        onError: (err) => setPwError(parseApiError(err, 'Failed to change password.')),
    });

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (pwForm.new_password !== pwForm.confirm_password) {
            setPwError('New passwords do not match.');
            return;
        }
        if (pwForm.new_password.length < 8) {
            setPwError('Password must be at least 8 characters.');
            return;
        }
        setPwError('');
        changePassword();
    };

    const { data: settings, isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.settings(),
        queryFn: patientPortalService.getSettings,
        staleTime: 5 * 60_000,
    });

    const { mutate: save, isPending } = useMutation({
        mutationFn: (data: Partial<PatientPortalSettings>) => patientPortalService.updateSettings(data),
        onSuccess: (updated) => {
            queryClient.setQueryData(queryKeys.patientPortal.settings(), updated);
            toast.success('Preference saved.');
        },
        onError: (err) => toast.error(parseApiError(err, 'Failed to save preference.')),
    });

    if (isLoading) {
        return (
            <>
                <PageHeader title="Settings" subtitle="" />
                <SectionCard title="Loading…"><TabSkeleton rows={4} /></SectionCard>
            </>
        );
    }

    if (isError || !settings) {
        return (
            <>
                <PageHeader title="Settings" subtitle="" />
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load settings. Please refresh.</div>
            </>
        );
    }

    const toggle = (key: keyof Omit<PatientPortalSettings, 'preferred_language'>) => {
        save({ [key]: !settings[key] });
    };

    return (
        <>
            <PageHeader
                title="Settings"
                subtitle="Control how the patient portal communicates with you and how information is displayed."
            />

            <div style={{ display: 'grid', gap: '1rem' }}>
                <SectionCard title="Language & communication">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label htmlFor="preferred_language">Preferred language</label>
                        <select
                            id="preferred_language"
                            value={settings.preferred_language}
                            disabled={isPending}
                            onChange={e => save({ preferred_language: e.target.value })}
                        >
                            <option value="en">English</option>
                            <option value="ur">Urdu</option>
                            <option value="fr">French</option>
                            <option value="ar">Arabic</option>
                        </select>
                    </div>
                </SectionCard>

                <SectionCard title="Change password">
                    <form onSubmit={handlePasswordSubmit} className="form" style={{ maxWidth: 440 }}>
                        {pwError && <div className="error-message" style={{ marginBottom: '0.75rem' }}>{pwError}</div>}
                        <div className="form-group">
                            <label htmlFor="current_password">Current password</label>
                            <input
                                id="current_password"
                                type="password"
                                value={pwForm.current_password}
                                autoComplete="current-password"
                                onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="new_password">New password</label>
                            <input
                                id="new_password"
                                type="password"
                                value={pwForm.new_password}
                                autoComplete="new-password"
                                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="confirm_password">Confirm new password</label>
                            <input
                                id="confirm_password"
                                type="password"
                                value={pwForm.confirm_password}
                                autoComplete="new-password"
                                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                                required
                            />
                        </div>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={isChangingPw} style={{ marginTop: '1rem' }}>
                            {isChangingPw ? 'Saving…' : 'Change password'}
                        </button>
                    </form>
                </SectionCard>

                <SectionCard title="Notification preferences">
                    <div style={{ display: 'grid', gap: '0.875rem' }}>
                        {([
                            ['email_notifications', 'General email notifications', 'Allow portal activity summaries and major updates by email.'],
                            ['appointment_reminders', 'Appointment reminders', 'Receive reminders for confirmed appointments and pending approvals.'],
                            ['lab_result_notifications', 'Lab result notifications', 'Get notified when a new lab result is released to the portal.'],
                            ['visit_summary_notifications', 'Visit summary notifications', 'Receive a notice when a doctor shares a new consultation summary.'],
                            ['marketing_emails', 'Product updates', 'Allow non-clinical product announcements and educational updates.'],
                        ] as [keyof Omit<PatientPortalSettings, 'preferred_language'>, string, string][]).map(([key, title, subtitle]) => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{subtitle}</div>
                                </div>
                                <button
                                    type="button"
                                    disabled={isPending}
                                    className={`btn btn-sm ${settings[key] ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => toggle(key)}
                                >
                                    {settings[key] ? 'On' : 'Off'}
                                </button>
                            </div>
                        ))}
                    </div>
                </SectionCard>
            </div>
        </>
    );
}
