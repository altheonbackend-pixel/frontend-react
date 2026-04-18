import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard, TabSkeleton } from '../../../shared/components/SectionCard';
import { Avatar } from '../../../shared/components/Avatar';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast, parseApiError } from '../../../shared/components/ui/toast';
import { queryKeys } from '../../../shared/queryKeys';
import { patientPortalService } from '../services/patientPortalService';

export default function PatientProfile() {
    usePageTitle('Patient Profile');
    const queryClient = useQueryClient();

    const { data: profile, isLoading, isError } = useQuery({
        queryKey: queryKeys.patientPortal.profile(),
        queryFn: patientPortalService.getProfile,
        staleTime: 5 * 60_000,
    });

    const [formData, setFormData] = useState({
        phone_number: '',
        address: '',
        emergency_contact_name: '',
        emergency_contact_number: '',
    });

    useEffect(() => {
        if (profile) {
            setFormData({
                phone_number: profile.phone_number ?? '',
                address: profile.address ?? '',
                emergency_contact_name: profile.emergency_contact_name ?? '',
                emergency_contact_number: profile.emergency_contact_number ?? '',
            });
        }
    }, [profile]);

    const { mutate: saveProfile, isPending: isSaving } = useMutation({
        mutationFn: () => patientPortalService.updateProfile(formData),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.patientPortal.profile() });
            toast.success('Profile updated successfully.');
        },
        onError: (err) => toast.error(parseApiError(err, 'Failed to update profile.')),
    });

    if (isLoading) {
        return (
            <>
                <PageHeader title="Profile" subtitle="Manage your contact details." />
                <SectionCard title="Loading…"><TabSkeleton rows={5} /></SectionCard>
            </>
        );
    }

    if (isError || !profile) {
        return (
            <>
                <PageHeader title="Profile" subtitle="" />
                <div className="error-message" style={{ margin: '1rem' }}>Failed to load profile. Please refresh.</div>
            </>
        );
    }

    return (
        <>
            <PageHeader
                title="Profile"
                subtitle="Manage your contact details and the core information used in your portal."
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)', gap: '1rem' }}>
                <SectionCard>
                    <div style={{ display: 'grid', justifyItems: 'center', gap: '0.75rem' }}>
                        <Avatar name={profile.full_name} size="xl" ring />
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{profile.full_name}</div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{profile.email}</div>
                        </div>
                        <div style={{ width: '100%', display: 'grid', gap: '0.65rem', marginTop: '0.5rem' }}>
                            {[
                                { label: 'Patient ID', value: profile.patient_id },
                                { label: 'Date of birth', value: profile.date_of_birth ?? '—' },
                                { label: 'Blood group', value: profile.blood_group ?? '—' },
                                { label: 'Primary doctor', value: profile.primary_doctor_name ?? '—' },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</div>
                                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Contact details">
                    <form className="form" onSubmit={e => { e.preventDefault(); saveProfile(); }}>
                        <div className="form-group">
                            <label htmlFor="phone_number">Phone number</label>
                            <input id="phone_number" value={formData.phone_number} onChange={e => setFormData(p => ({ ...p, phone_number: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="address">Address</label>
                            <textarea id="address" rows={3} value={formData.address} onChange={e => setFormData(p => ({ ...p, address: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label htmlFor="emergency_contact_name">Emergency contact name</label>
                                <input id="emergency_contact_name" value={formData.emergency_contact_name} onChange={e => setFormData(p => ({ ...p, emergency_contact_name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="emergency_contact_number">Emergency contact number</label>
                                <input id="emergency_contact_number" value={formData.emergency_contact_number} onChange={e => setFormData(p => ({ ...p, emergency_contact_number: e.target.value }))} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary" disabled={isSaving}>
                                {isSaving ? 'Saving…' : 'Save changes'}
                            </button>
                        </div>
                    </form>
                </SectionCard>
            </div>
        </>
    );
}
