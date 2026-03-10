import React, { useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import HomescreenHeader from '../../../shared/components/HomescreenHeader';
import '../styles/Auth.css';

import api from '../../../shared/services/api';

const Register = () => {
    const { t } = useTranslation();
    // 1. État pour le code d'enregistrement initial
    const [registrationCode, setRegistrationCode] = useState('');
    
    // 2. État pour déterminer si le code a été saisi (pour afficher le formulaire complet)
    const [codeEntered, setCodeEntered] = useState(false); 

    // 3. État pour les données du formulaire (inclut le code pour la soumission finale)
    const [formData, setFormData] = useState({
        first_name: '', 
        last_name: '',  
        email: '',
        password: '',
        license_number: '',
        specialty: '', // IMPORTANT : maintiens ce champ ici
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const navigate = useNavigate();

    // Gestion des changements pour le formulaire complet
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };
    
    // Logique de validation locale du code (simple vérification de longueur)
    const handleCodeSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Une simple vérification locale avant d'afficher le formulaire
        if (registrationCode.trim().length >= 10) { 
            setCodeEntered(true);
            setSuccess(t('register.success.code_valid'));
        } else {
            setError(t('register.error.code_length'));
        }
    };

    // Soumission du formulaire complet au backend
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        setLoading(true);

        // Assembler les données finales (avec le code)
        const finalData = {
            ...formData,
            registration_code: registrationCode, // AJOUT du code à la soumission
        };

        try {
            const response = await api.post('/register/doctor/', finalData);

            if (response.status === 201) {
                setSuccess(t('register.success.register'));
                setTimeout(() => {
                    navigate('/login', { replace: true });
                }, 2000); 
            }
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const errorData = err.response.data;
                
                // Gestion des erreurs par champ
                let errorMessage = t('register.error.generic');
                if (typeof errorData === 'object' && errorData !== null) {
                    const errorMessages = Object.values(errorData).flat().join(' ');
                    errorMessage = `Erreur: ${errorMessages}`;
                }
                
                // Si l'erreur est spécifiquement liée au code
                if (errorData.registration_code) {
                    setError(`${t('register.error.code_invalid')} ${errorData.registration_code[0]}.`);
                    setCodeEntered(false); // Revenir à l'étape du code
                    setRegistrationCode('');
                } else {
                    setError(errorMessage);
                }
            } else {
                setError(t('register.error.network'));
            }
        } finally {
            setLoading(false);
        }
    };

    // --- Rendu du composant ---

    if (!codeEntered) {
        // AFFICHAGE DU POP-UP / FORMULAIRE DE CODE SEUL
        return (
            <div className="auth-page-wrapper">
                <HomescreenHeader />
                <div className="auth-container">
                    <form onSubmit={handleCodeSubmit} className="auth-form auth-modal">
                        <h2>{t('register.code_title')}</h2>
                        <p>{t('register.code_instruction')}</p>
                        
                        {error && <p className="error-message">{error}</p>}
                        
                        <div className="form-group">
                            <label htmlFor="registrationCode">{t('register.code_label')}</label>
                            <input
                                type="text"
                                id="registrationCode"
                                name="registrationCode"
                                value={registrationCode}
                                onChange={(e) => setRegistrationCode(e.target.value)}
                                required
                                placeholder={t('register.code_placeholder')}
                            />
                        </div>
                        
                        <button type="submit">
                            {t('register.verify_button')}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    // AFFICHAGE DU FORMULAIRE D'INSCRIPTION COMPLET
    return (
        <div className="auth-page-wrapper">
            <HomescreenHeader />
            <div className="auth-container">
                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>{t('register.title')}</h2>
                    {success && <p className="success-message">{success}</p>}
                    {error && <p className="error-message">{error}</p>}
                    
                    {/* Champ du code d'enregistrement: caché mais inclus pour la soumission finale. */}
                    <input type="hidden" name="registration_code" value={registrationCode} />

                    {/* --- Champs du formulaire --- */}
                    <div className="form-group">
                    <label htmlFor="first_name">{t('register.first_name')}</label>
                    <input
                        type="text" id="first_name" name="first_name" value={formData.first_name}
                        onChange={handleChange} required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="last_name">{t('register.last_name')}</label>
                    <input
                        type="text" id="last_name" name="last_name" value={formData.last_name}
                        onChange={handleChange} required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="email">{t('register.email')}</label>
                    <input
                        type="email" id="email" name="email" value={formData.email}
                        onChange={handleChange} required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="license_number">{t('register.license')}</label>
                    <input
                        type="text" id="license_number" name="license_number" value={formData.license_number}
                        onChange={handleChange} required
                    />
                </div>
                {/* Ajout du champ specialty (même s'il est vide) pour éviter l'erreur "field may not be blank" côté DRF */}
                <div className="form-group">
                    <label htmlFor="specialty">{t('register.specialty')}</label>
                    <input
                        type="text" 
                        id="specialty" 
                        name="specialty" 
                        value={formData.specialty}
                        onChange={handleChange} 
                    />
                </div>
                
                <div className="form-group">
                    <label htmlFor="password">{t('register.password')}</label>
                    <input
                        type="password" id="password" name="password" value={formData.password}
                        onChange={handleChange} required
                    />
                </div>
                
                <button type="submit" disabled={loading}>
                    {loading ? t('register.loading') : t('register.submit')}
                </button>
                <p className="link-back" onClick={() => setCodeEntered(false)}>
                    {t('register.back_to_code')}
                </p>
                </form>
            </div>
        </div>
    );
};

export default Register;