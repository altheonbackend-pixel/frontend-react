import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import api from '../../../../shared/services/api';
import { toast, parseApiError } from '../../../../shared/components/ui';
import { useDoctorProfile } from '../../hooks/useDoctorProfile';
import { Switch } from '../../../../shared/components/Switch';

interface DoctorOption {
    id: number;
    full_name: string;
    specialty_display?: string;
}

const toLocalInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 16) : '');
const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

export default function AvailabilitySection() {
    const { t } = useTranslation();
    const { profile, saveProfile } = useDoctorProfile();

    const [acceptingReferrals, setAcceptingReferrals] = useState(true);
    const [nextAvailable, setNextAvailable] = useState('');
    const [oooUntil, setOooUntil] = useState('');
    const [coverageId, setCoverageId] = useState<string>('');
    const [saving, setSaving] = useState(false);

    const { data: doctors = [] } = useQuery<DoctorOption[]>({
        queryKey: ['doctors', 'coverage'],
        queryFn: () => api.get('/doctors/').then(r => r.data),
        staleTime: 5 * 60_000,
    });

    useEffect(() => {
        if (!profile) return;
        setAcceptingReferrals(profile.accepting_referrals ?? true);
        setNextAvailable(toLocalInput(profile.next_available));
        setOooUntil(toDateInput(profile.out_of_office_until));
        setCoverageId(profile.coverage_doctor != null ? String(profile.coverage_doctor) : '');
    }, [profile]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveProfile({
                accepting_referrals: acceptingReferrals,
                next_available: nextAvailable || null,
                out_of_office_until: oooUntil || null,
                coverage_doctor: coverageId ? Number(coverageId) : null,
            });
            toast.success(t('settings.availability.saved'));
        } catch (err) {
            toast.error(parseApiError(err, t('settings.availability.save_error')));
        } finally {
            setSaving(false);
        }
    };

    const coverageOptions = doctors.filter(d => d.id !== profile?.id);

    return (
        <div className="settings-card">
            <div className="settings-card-head">
                <h2 className="settings-card-title">{t('settings.availability.title')}</h2>
                <p className="settings-card-subtitle">{t('settings.availability.subtitle')}</p>
            </div>

            <div className="settings-card-body">
                <div className="settings-toggle-row">
                    <div>
                        <div className="settings-toggle-text-title">{t('edit_profile.accepting_referrals')}</div>
                        <div className="settings-toggle-text-sub">{t('edit_profile.accepting_referrals_hint')}</div>
                    </div>
                    <Switch
                        checked={acceptingReferrals}
                        onChange={setAcceptingReferrals}
                        label={t('edit_profile.accepting_referrals')}
                    />
                </div>

                <div className="form-group" style={{ marginTop: '1.25rem' }}>
                    <label htmlFor="next_available">{t('edit_profile.next_available_slot')}</label>
                    <input
                        id="next_available"
                        type="datetime-local"
                        className="input"
                        value={nextAvailable}
                        onChange={e => setNextAvailable(e.target.value)}
                    />
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('edit_profile.next_available_hint')}</span>
                </div>

                <div style={{ marginTop: '0.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-subtle)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
                        {t('settings.availability.ooo_title')}
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 1rem' }}>
                        {t('settings.availability.ooo_subtitle')}
                    </p>
                    <div className="settings-grid-2">
                        <div className="form-group">
                            <label htmlFor="ooo_until">{t('settings.availability.ooo_until')}</label>
                            <input
                                id="ooo_until"
                                type="date"
                                className="input"
                                min={new Date().toISOString().slice(0, 10)}
                                value={oooUntil}
                                onChange={e => setOooUntil(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label htmlFor="coverage_doctor">{t('settings.availability.coverage_doctor')}</label>
                            <select
                                id="coverage_doctor"
                                className="select-input"
                                value={coverageId}
                                onChange={e => setCoverageId(e.target.value)}
                            >
                                <option value="">{t('settings.availability.coverage_none')}</option>
                                {coverageOptions.map(d => (
                                    <option key={d.id} value={d.id}>
                                        Dr. {d.full_name}{d.specialty_display ? ` · ${d.specialty_display}` : ''}
                                    </option>
                                ))}
                            </select>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('settings.availability.coverage_hint')}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="settings-card-footer">
                <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={handleSave}>
                    {saving ? t('common.saving') : t('settings.save_changes')}
                </button>
            </div>
        </div>
    );
}
