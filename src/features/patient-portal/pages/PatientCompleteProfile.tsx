import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import { toast } from '../../../shared/components/ui';
import api from '../../../shared/services/api';

const FIELD_META: Record<string, { label: string; type: string; placeholder: string }> = {
    date_of_birth: { label: 'Date of birth',  type: 'date',  placeholder: '' },
    phone_number:  { label: 'Phone number',   type: 'tel',   placeholder: 'e.g. +1 555 000 0000' },
    address:       { label: 'Address',        type: 'text',  placeholder: 'Street, city, country' },
};

export default function PatientCompleteProfile() {
    usePageTitle('Complete Your Profile — Patient Portal');
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const fields = (searchParams.get('fields') || '').split(',').filter(f => f in FIELD_META);

    const [values, setValues] = useState<Record<string, string>>(() =>
        Object.fromEntries(fields.map(f => [f, '']))
    );
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (fields.length === 0) {
        navigate('/patient/dashboard', { replace: true });
        return null;
    }

    const handleChange = (field: string, value: string) => {
        setValues(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);
        try {
            const payload: Record<string, string | null> = {};
            for (const field of fields) {
                payload[field] = values[field] || null;
            }
            await api.patch('/patient/profile/', payload);
            toast.success('Profile updated. Welcome to your portal!');
            navigate('/patient/dashboard', { replace: true });
        } catch {
            setError('Failed to save. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = () => navigate('/patient/dashboard', { replace: true });

    return (
        <div className="patient-auth-shell">
            <div className="patient-auth-left">
                <div className="patient-auth-brand">
                    <div className="patient-auth-logo">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                            <circle cx="18" cy="18" r="18" fill="var(--accent)" />
                            <path d="M18 10v16M10 18h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                    </div>
                    <div className="patient-auth-brand-name">Altheon Patient Portal</div>
                </div>
                <div className="patient-auth-left-body">
                    <div className="patient-auth-headline">One last step.</div>
                    <div className="patient-auth-sub">
                        Your doctor's records didn't include all of your contact details. Fill them in now so we can reach you and keep your record complete.
                    </div>
                    <ul className="patient-auth-features">
                        <li><span className="feature-dot feature-dot--green" />Helps your doctor contact you</li>
                        <li><span className="feature-dot feature-dot--blue" />Used for appointment reminders</li>
                        <li><span className="feature-dot feature-dot--purple" />You can update these anytime in Account settings</li>
                    </ul>
                </div>
            </div>

            <div className="patient-auth-right">
                <div className="patient-auth-card">
                    <div className="patient-auth-card-header">
                        <div className="patient-auth-card-title">Complete your profile</div>
                        <div className="patient-auth-card-sub">
                            The fields below were not on file with your doctor. You can skip and fill them in later from your Account settings.
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="patient-auth-form" noValidate>
                        {error && <div className="patient-auth-error" role="alert">{error}</div>}

                        {fields.map(field => {
                            const meta = FIELD_META[field];
                            return (
                                <div className="form-group" key={field}>
                                    <label htmlFor={field}>{meta.label}</label>
                                    <input
                                        id={field}
                                        type={meta.type}
                                        value={values[field]}
                                        onChange={e => handleChange(field, e.target.value)}
                                        placeholder={meta.placeholder}
                                        disabled={loading}
                                    />
                                </div>
                            );
                        })}

                        <button
                            type="submit"
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}
                            disabled={loading}
                        >
                            {loading ? 'Saving…' : 'Save and continue'}
                        </button>
                    </form>

                    <div className="patient-auth-divider"><span>or</span></div>

                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={handleSkip}
                        disabled={loading}
                    >
                        Skip for now
                    </button>

                    <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        You can always update these from <strong>Account → Profile</strong>.
                    </div>
                </div>
            </div>
        </div>
    );
}
