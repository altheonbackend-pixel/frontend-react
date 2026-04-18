import { useState } from 'react';
import { PageHeader } from '../../../shared/components/PageHeader';
import { SectionCard } from '../../../shared/components/SectionCard';
import { Avatar } from '../../../shared/components/Avatar';
import { toast } from '../../../shared/components/ui';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { usePatientPortal } from '../context/PatientPortalContext';

export default function PatientProfile() {
    const { profile, updateProfile } = usePatientPortal();
    const [formData, setFormData] = useState({
        phone_number: profile.phone_number,
        address: profile.address,
        emergency_contact_name: profile.emergency_contact_name,
        emergency_contact_number: profile.emergency_contact_number,
    });

    usePageTitle('Patient Profile');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateProfile(formData);
        toast.success('Profile details updated in the demo patient portal.');
    };

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
                            <div style={{ padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Patient ID</div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{profile.patient_id}</div>
                            </div>
                            <div style={{ padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Date of birth</div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{profile.date_of_birth}</div>
                            </div>
                            <div style={{ padding: '0.75rem 0.875rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-subtle)' }}>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Primary doctor</div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{profile.primary_doctor_name}</div>
                            </div>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Contact details">
                    <form className="form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="phone_number">Phone number</label>
                            <input id="phone_number" value={formData.phone_number} onChange={e => setFormData(prev => ({ ...prev, phone_number: e.target.value }))} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="address">Address</label>
                            <textarea id="address" rows={3} value={formData.address} onChange={e => setFormData(prev => ({ ...prev, address: e.target.value }))} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <div className="form-group">
                                <label htmlFor="emergency_contact_name">Emergency contact name</label>
                                <input id="emergency_contact_name" value={formData.emergency_contact_name} onChange={e => setFormData(prev => ({ ...prev, emergency_contact_name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label htmlFor="emergency_contact_number">Emergency contact number</label>
                                <input id="emergency_contact_number" value={formData.emergency_contact_number} onChange={e => setFormData(prev => ({ ...prev, emergency_contact_number: e.target.value }))} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary">Save changes</button>
                        </div>
                    </form>
                </SectionCard>
            </div>
        </>
    );
}
