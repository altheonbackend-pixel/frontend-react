// src/features/profile/components/Profile.tsx

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/hooks/useAuth';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { PageHeader } from '../../../shared/components/PageHeader';
import { Avatar } from '../../../shared/components/Avatar';
import { Pagination } from '../../../shared/components/Pagination';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import api from '../../../shared/services/api';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';

interface AuditEntry {
    id: number;
    action: string;
    description: string;
    ip_address: string | null;
    timestamp: string;
}

const Profile = () => {
    const { t } = useTranslation();
    usePageTitle(t('pages.profile', 'Profile'));
    const { profile, authIsLoading } = useAuth();
    const [activityPage, setActivityPage] = useState(1);
    const PAGE_SIZE = 10;

    // Change password form state
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState('');
    const [pwSuccess, setPwSuccess] = useState('');

    const { data: activityData, isLoading: activityLoading } = useQuery({
        queryKey: ['my-activity', activityPage],
        queryFn: () => api.get(`/audit/my-activity/?page=${activityPage}&page_size=${PAGE_SIZE}`).then(r => r.data),
        staleTime: 60_000,
    });

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError('');
        setPwSuccess('');

        if (newPassword !== confirmPassword) {
            setPwError('New passwords do not match.');
            return;
        }
        if (newPassword.length < 8) {
            setPwError('Password must be at least 8 characters.');
            return;
        }

        setPwLoading(true);
        try {
            await api.post('/change-password/', { current_password: currentPassword, new_password: newPassword });
            setPwSuccess('Password changed successfully.');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                'Failed to change password. Please try again.';
            setPwError(msg);
        } finally {
            setPwLoading(false);
        }
    };

    if (authIsLoading) {
        return <div className="loading-message">{t('profile.loading')}</div>;
    }

    if (!profile) {
        return <div className="no-profile-data">{t('profile.no_data')}</div>;
    }

    const doctorName = profile.full_name ?? '';
    const activityItems: AuditEntry[] = activityData?.results ?? activityData ?? [];
    const activityCount: number = activityData?.count ?? activityItems.length;
    const activityPages = Math.ceil(activityCount / PAGE_SIZE);

    return (
        <>
            <PageHeader
                title={t('profile.title', 'My Profile')}
                actions={
                    <Link to="/edit-profile" className="btn btn-secondary btn-sm">
                        {t('profile.edit', 'Edit Profile')}
                    </Link>
                }
            />

            <div style={{ maxWidth: 640 }}>
                {/* Profile card */}
                <div className="section-card" style={{ marginBottom: '1.25rem' }}>
                    <div className="section-card-body" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                            <Avatar name={doctorName} size="xl" ring />
                        </div>
                        <h2 style={{ fontWeight: 800, fontSize: '1.25rem', color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                            Dr. {doctorName}
                        </h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
                            {profile.specialty_display || profile.specialty || t('profile.unspecified', 'Unspecified specialty')}
                        </p>
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '1rem 1.25rem' }}>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.email', 'Email')}</span>
                            <span className="profile-info-value">{profile.email}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.license', 'License')}</span>
                            <span className="profile-info-value">{profile.license_number || '—'}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.phone', 'Phone')}</span>
                            <span className="profile-info-value">{profile.phone_number || '—'}</span>
                        </div>
                        <div className="profile-info-item">
                            <span className="profile-info-label">{t('profile.address', 'Address')}</span>
                            <span className="profile-info-value">{profile.address || '—'}</span>
                        </div>
                    </div>
                </div>

                {/* Security — Change Password */}
                <div className="section-card" style={{ marginBottom: '1.25rem' }}>
                    <div className="section-card-header">
                        <span className="section-card-title">Security</span>
                    </div>
                    <div className="section-card-body">
                        <form onSubmit={handleChangePassword}>
                            {pwError && (
                                <div className="error-message" style={{ marginBottom: '1rem' }}>{pwError}</div>
                            )}
                            {pwSuccess && (
                                <div style={{
                                    background: 'var(--color-success-light, #f0fff4)',
                                    border: '1px solid var(--color-success-border, #9ae6b4)',
                                    color: 'var(--color-success-dark, #276749)',
                                    padding: '0.625rem 1rem',
                                    borderRadius: 'var(--radius-md)',
                                    fontSize: '0.875rem',
                                    marginBottom: '1rem',
                                }}>
                                    {pwSuccess}
                                </div>
                            )}
                            <div className="form-group">
                                <label htmlFor="current-password">Current Password</label>
                                <input
                                    id="current-password"
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    autoComplete="current-password"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="new-password">New Password</label>
                                <input
                                    id="new-password"
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="confirm-password">Confirm New Password</label>
                                <input
                                    id="confirm-password"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    placeholder="Repeat new password"
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={pwLoading}
                                    style={{ minWidth: 140 }}
                                >
                                    {pwLoading ? 'Saving…' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>

                {/* Activity log */}
                <div className="section-card">
                    <div className="section-card-header">
                        <span className="section-card-title">Recent Activity</span>
                    </div>
                    <div className="section-card-body section-card-body--flush">
                        {activityLoading ? (
                            <div style={{ padding: '1rem' }}><TabSkeleton rows={4} /></div>
                        ) : activityItems.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                                No activity recorded yet.
                            </div>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1.5px solid var(--border-subtle)', background: 'var(--bg-muted)' }}>
                                                <th style={{ textAlign: 'left', padding: '0.5rem 1rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Action</th>
                                                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>Description</th>
                                                <th style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em' }}>IP</th>
                                                <th style={{ textAlign: 'right', padding: '0.5rem 1rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>Time</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activityItems.map((entry, idx) => (
                                                <tr
                                                    key={entry.id}
                                                    style={{
                                                        borderBottom: '1px solid var(--border-subtle)',
                                                        background: idx % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-subtle)',
                                                    }}
                                                >
                                                    <td style={{ padding: '0.5rem 1rem', color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                        {entry.action}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {entry.description || '—'}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                        {entry.ip_address || '—'}
                                                    </td>
                                                    <td style={{ padding: '0.5rem 1rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                        {new Date(entry.timestamp).toLocaleString(undefined, {
                                                            month: 'short', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit',
                                                        })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {activityPages > 1 && (
                                    <div style={{ padding: '0.75rem 1rem' }}>
                                        <Pagination
                                            currentPage={activityPage}
                                            totalPages={activityPages}
                                            totalCount={activityCount}
                                            onPageChange={setActivityPage}
                                            isLoading={activityLoading}
                                        />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Profile;
