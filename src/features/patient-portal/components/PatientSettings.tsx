import { toast } from '../../../shared/components/ui';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { usePatientPortal } from '../context/PatientPortalContext';

export default function PatientSettings() {
    const { settings, updateSettings } = usePatientPortal();
    usePageTitle('Patient Settings');

    const toggle = (key: keyof typeof settings) => {
        if (key === 'preferred_language') return;
        updateSettings({ [key]: !settings[key] } as Partial<typeof settings>);
        toast.success('Preference updated in the demo portal.');
    };

    return (
        <>
            <PageHeader
                title="Settings"
                subtitle="Control how the patient portal communicates with you and how information is displayed."
            />

            <div style={{ display: 'grid', gap: '1rem' }}>
                <SectionCard title="Language & communication">
                    <div style={{ display: 'grid', gap: '1rem' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label htmlFor="preferred_language">Preferred language</label>
                            <select
                                id="preferred_language"
                                value={settings.preferred_language}
                                onChange={e => {
                                    updateSettings({ preferred_language: e.target.value });
                                    toast.success('Language preference updated.');
                                }}
                            >
                                <option value="en">English</option>
                                <option value="ur">Urdu</option>
                                <option value="fr">French</option>
                                <option value="ar">Arabic</option>
                            </select>
                        </div>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                            These settings are frontend-only for now and are meant to preview the patient portal UX.
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Notification preferences">
                    <div style={{ display: 'grid', gap: '0.875rem' }}>
                        {[
                            ['email_notifications', 'General email notifications', 'Allow portal activity summaries and major updates by email.'],
                            ['appointment_reminders', 'Appointment reminders', 'Receive reminders for confirmed appointments and pending approvals.'],
                            ['lab_result_notifications', 'Lab result notifications', 'Get notified when a new lab result is released to the portal.'],
                            ['visit_summary_notifications', 'Visit summary notifications', 'Receive a notice when a doctor shares a new consultation summary.'],
                            ['marketing_emails', 'Product updates', 'Allow non-clinical product announcements and educational updates.'],
                        ].map(([key, title, subtitle]) => (
                            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', padding: '0.95rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                <div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{title}</div>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{subtitle}</div>
                                </div>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${settings[key as keyof typeof settings] ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => toggle(key as keyof typeof settings)}
                                >
                                    {settings[key as keyof typeof settings] ? 'On' : 'Off'}
                                </button>
                            </div>
                        ))}
                    </div>
                </SectionCard>

                <SectionCard title="Phase 1 notes">
                    <div style={{ display: 'grid', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                        <div>Security settings, password change, consent records, and session management are planned for backend integration.</div>
                        <div>The current screen is intentionally aligned to the existing design system and ready to wire into real APIs next.</div>
                    </div>
                </SectionCard>
            </div>
        </>
    );
}
