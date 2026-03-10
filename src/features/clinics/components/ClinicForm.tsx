import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { useNavigate, useParams } from 'react-router-dom';
import { type Workplace } from '../../../shared/types';
import '../../../shared/styles/FormStyles.css';
import api from '../../../shared/services/api';

const ClinicForm = () => {
    const { t } = useTranslation();
    const { id } = useParams<{ id?: string }>();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [formData, setFormData] = useState<Partial<Workplace>>({
        name: '',
        address: '',
        is_public: false,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ... (fetchClinic useEffect, handleChange sont inchangés) ...
    useEffect(() => {
        if (id) {
            const fetchClinic = async () => {
                if (!token) {
                    setError(t('clinics.error.auth'));
                    return;
                }
                try {
                    const response = await api.get('/workplaces/${id}/');
                    setFormData(response.data);
                } catch (err) {
                    console.error("Erreur lors du chargement des données de la clinique :", err);
                    setError(t('clinics.error.not_found'));
                }
            };
            fetchClinic();
        }
    }, [id, token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type, checked } = e.target as HTMLInputElement;
        setFormData(prevData => ({
            ...prevData,
            [name]: type === 'checkbox' ? checked : value,
        }));
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (!token) {
            setError(t('clinics.error.auth'));
            setLoading(false);
            return;
        }

        try {
            if (id) {
                // Mode Modification: Le backend doit valider si l'utilisateur est le créateur
                await api.put('/workplaces/${id}/', formData);
                navigate(`/clinics/${id}`); // Rediriger vers les détails
            } else {
                // Mode Ajout
                const response = await api.post('/workplaces/', formData);
                navigate(`/clinics/${response.data.id}`); // Rediriger vers les détails
            }
        } catch (err) {
            console.error("Erreur lors de l'enregistrement de la clinique :", err);
            if (axios.isAxiosError(err) && err.response) {
                // Afficher le message d'erreur du backend (ex: "Vous n'êtes pas le créateur")
                setError(JSON.stringify(err.response.data));
            } else {
                setError(t('clinics.error.general'));
            }
        } finally {
            setLoading(false);
        }
    };

    // ... (Rendu inchangé) ...
    return (
        <div className="form-overlay">
            <div className="form-container">
                <form onSubmit={handleSubmit} className="form">
                    <h3>{id ? t('clinics.title_edit') : t('clinics.title_add')}</h3>
                    {error && <p className="error-message">{error}</p>}
                    
                    <div className="form-group">
                        <label htmlFor="name">{t('clinics.label.name')}</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name || ''}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="address">{t('clinics.label.address')}</label>
                        <textarea
                            id="address"
                            name="address"
                            value={formData.address || ''}
                            onChange={handleChange}
                            required
                        ></textarea>
                    </div>

                    <div className="form-group checkbox-group">
                        <input
                            type="checkbox"
                            id="is_public"
                            name="is_public"
                            checked={formData.is_public || false}
                            onChange={handleChange}
                        />
                        <label htmlFor="is_public">{t('clinics.label.is_public')}</label>
                    </div>

                    <div className="form-actions">
                        <button type="submit" disabled={loading}>
                            {loading ? t('clinics.submit.processing') : t('clinics.submit.save')}
                        </button>
                        <button type="button" onClick={() => navigate('/clinics')} className="cancel-button">
                            {t('clinics.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ClinicForm;