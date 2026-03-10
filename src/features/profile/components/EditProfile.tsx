// Fichier : src/components/EditProfile.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Select from 'react-select';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { type DoctorProfile, type Workplace } from '../../../shared/types';
import '../../../shared/styles/FormStyles.css';
import api from '../../../shared/services/api';

const EditProfile = () => {
    const { t } = useTranslation();
    const { profile, updateProfileData, token } = useAuth();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        specialty: '',
        license_number: '',
        phone_number: '',
        address: '',
    });
    const [workplaces, setWorkplaces] = useState<Workplace[]>([]);
    const [selectedWorkplaces, setSelectedWorkplaces] = useState<Workplace[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            if (!token) {
                setError(t('edit_profile.error.auth'));
                setInitialLoading(false);
                return;
            }
            
            try {
                // Récupérer la liste de toutes les cliniques
                const workplacesResponse = await api.get('/workplaces/');
                const allWorkplaces: Workplace[] = workplacesResponse.data;
                setWorkplaces(allWorkplaces);

                // Charger les données du profil du médecin
                if (profile) {
                    const nameParts = profile.full_name.split(' ');
                    const firstName = nameParts.shift() || '';
                    const lastName = nameParts.join(' ');
                    
                    setFormData({
                        first_name: firstName,
                        last_name: lastName,
                        email: profile.email,
                        specialty: profile.specialty || '',
                        license_number: profile.license_number || '',
                        phone_number: profile.phone_number || '',
                        address: profile.address || '',
                    });
                    
                    // Pré-sélectionner les cliniques du médecin
                    if (profile.workplaces) {
                        const preselected = allWorkplaces.filter(w => 
                            profile.workplaces?.some(pw => pw.id === w.id)
                        );
                        setSelectedWorkplaces(preselected);
                    }
                }
            } catch (err) {
                console.error("Erreur lors du chargement des données :", err);
                if (axios.isAxiosError(err) && err.response) {
                    setError(`Erreur de l'API : ${JSON.stringify(err.response.data)}`);
                } else {
                    setError(t('edit_profile.error.load'));
                }
            } finally {
                setInitialLoading(false);
            }
        };

        fetchData();
    }, [profile, token]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value,
        }));
    };

    const handleSelectChange = (newValue: any) => {
        setSelectedWorkplaces(newValue);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // Créer le payload en incluant le tableau d'IDs de lieux de travail
            const payload = {
                ...formData,
                workplaces: selectedWorkplaces.map(w => w.id),
            };

            const response = await api.put('/profile/update/', payload);
            
            // Reconstruire l'objet DoctorProfile complet à partir de la réponse de l'API
            // IMPORTANT: Assurez-vous que l'API renvoie les objets Workplace complets,
            // ou bien récupérez-les à nouveau ici pour mettre à jour le contexte.
            // La solution la plus simple est d'attendre que le backend renvoie la bonne structure.
            // Sinon, il faudrait faire une nouvelle requête ici.
            
            // Pour l'instant, nous faisons confiance au backend pour renvoyer la bonne structure.
            const updatedProfile: DoctorProfile = {
                id: response.data.id,
                full_name: `${response.data.first_name} ${response.data.last_name}`,
                email: response.data.email,
                specialty: response.data.specialty,
                license_number: response.data.license_number,
                phone_number: response.data.phone_number,
                address: response.data.address,
                workplaces: response.data.workplaces,
            };
            
            updateProfileData(updatedProfile);
            
            navigate('/profile');
        } catch (err) {
            console.error("Erreur lors de la mise à jour du profil :", err);
            if (axios.isAxiosError(err) && err.response) {
                setError(JSON.stringify(err.response.data));
            } else {
                setError(t('edit_profile.error.save'));
            }
        } finally {
            setLoading(false);
        }
    };
    
    if (initialLoading) {
        return <div>{t('edit_profile.loading')}</div>;
    }

    if (!profile) {
        return <div>{t('edit_profile.error.load')}</div>;
    }

    const options = workplaces.map(w => ({
        value: w.id,
        label: w.name,
        ...w
    }));

    const defaultValues = selectedWorkplaces.map(w => ({
        value: w.id,
        label: w.name,
        ...w
    }));

    return (
        <div className="form-overlay">
            <div className="form-container">
                <form onSubmit={handleSubmit} className="form">
                    <h3>{t('edit_profile.title')}</h3>
                    {error && <p className="error-message">{error}</p>}
                    
                    <div className="form-group">
                        <label htmlFor="first_name">{t('edit_profile.labels.first_name')}</label>
                        <input type="text" id="first_name" name="first_name" value={formData.first_name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="last_name">{t('edit_profile.labels.last_name')}</label>
                        <input type="text" id="last_name" name="last_name" value={formData.last_name} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="email">{t('edit_profile.labels.email')}</label>
                        <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
                    </div>
                    <div className="form-group">
                        <label htmlFor="specialty">{t('edit_profile.labels.specialty')}</label>
                        <input type="text" id="specialty" name="specialty" value={formData.specialty} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="license_number">{t('edit_profile.labels.license')}</label>
                        <input type="text" id="license_number" name="license_number" value={formData.license_number} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone_number">{t('edit_profile.labels.phone')}</label>
                        <input type="text" id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} />
                    </div>
                    <div className="form-group">
                        <label htmlFor="address">{t('edit_profile.labels.address')}</label>
                        <textarea id="address" name="address" value={formData.address} onChange={handleChange}></textarea>
                    </div>

                    <div className="form-group">
                        <label>{t('edit_profile.labels.workplaces')}</label>
                        <Select
                            isMulti
                            options={options}
                            value={defaultValues}
                            onChange={handleSelectChange}
                            placeholder={t('edit_profile.placeholders.workplaces')}
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" disabled={loading}>
                            {loading ? t('edit_profile.saving') : t('edit_profile.save')}
                        </button>
                        <button type="button" onClick={() => navigate('/profile')} className="cancel-button">
                            {t('edit_profile.cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfile;