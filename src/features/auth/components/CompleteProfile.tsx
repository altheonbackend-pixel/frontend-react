import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../shared/services/api';
import { useAuth } from '../hooks/useAuth';
import type { SpecialtyChoice } from '../../../shared/types';
import '../styles/Auth.css';

const CompleteProfile = () => {
    const navigate = useNavigate();
    const { profile, updateProfileData, logout } = useAuth();
    const [specialties, setSpecialties] = useState<SpecialtyChoice[]>([]);
    const [formData, setFormData] = useState({
        specialty: profile?.specialty || 'general_practice',
        phone_number: profile?.phone_number || '',
        address: profile?.address || '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        api.get('/auth/specialties/')
            .then(r => setSpecialties(r.data))
            .catch(() => setSpecialties([{ value: 'general_practice', label: 'General Practice' }]));
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.phone_number.trim() || !formData.address.trim()) {
            setError('Phone number and address are required.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await api.patch('/profile/update/', formData);
            updateProfileData(response.data);
            navigate('/dashboard', { replace: true });
        } catch (err: any) {
            const data = err?.response?.data;
            const msg = typeof data === 'object'
                ? Object.values(data).flat().join(' ')
                : 'Failed to save profile. Please try again.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-wrapper">
            <div className="auth-container">
                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>Complete Your Profile</h2>
                    <p style={{ color: '#718096', fontSize: '14px', marginBottom: '20px' }}>
                        Please provide the following information before accessing the platform.
                    </p>

                    {error && <p className="error-message">{error}</p>}

                    <div className="form-group">
                        <label htmlFor="specialty">Specialty</label>
                        <select
                            id="specialty"
                            name="specialty"
                            value={formData.specialty}
                            onChange={handleChange}
                            required
                        >
                            {specialties.map(s => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="phone_number">Phone Number</label>
                        <input
                            type="tel"
                            id="phone_number"
                            name="phone_number"
                            value={formData.phone_number}
                            onChange={handleChange}
                            placeholder="+213 555 123 456"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="address">Address / City</label>
                        <textarea
                            id="address"
                            name="address"
                            value={formData.address}
                            onChange={handleChange}
                            placeholder="123 Main St, Algiers"
                            rows={3}
                            required
                        />
                    </div>

                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Saving…' : 'Save and Continue'}
                    </button>

                    <button
                        type="button"
                        className="auth-button"
                        style={{ background: '#718096', marginTop: '8px' }}
                        onClick={logout}
                    >
                        Log Out
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CompleteProfile;
