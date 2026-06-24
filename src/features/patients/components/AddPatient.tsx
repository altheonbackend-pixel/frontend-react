import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import PatientForm from './PatientForm';
import AddPatientScanTab from './AddPatientScanTab';
import AddPatientSearchTab from './AddPatientSearchTab';
import type { Patient } from '../../../shared/types';

/**
 * Workflow B Add Patient — three paths to start a visit:
 *   1. Enter code (B1) — patient reads their 6-digit clinic code from the portal.
 *   2. Search & request (B-search + B2) — find an existing Altheon patient
 *      by exact email / phone / (last name + DOB) and request access.
 *   3. Register new (B3) — no Altheon account yet; create one. The backend
 *      enforces the enhanced duplicate match (email + phone exact) before
 *      allowing the create.
 */
type Tab = 'scan' | 'search' | 'new';

const AddPatient = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const [tab, setTab] = useState<Tab>('new');
    // Email carried over when the new-patient form detects an existing account
    // and the doctor opts to request access via OTP instead.
    const [searchPrefillEmail, setSearchPrefillEmail] = useState<string>('');

    const handleRequestExistingAccess = (email: string) => {
        setSearchPrefillEmail(email);
        setTab('search');
    };

    const handleNewPatientSuccess = (_patient: Patient) => {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        navigate('/patients');
    };

    const handleAccessGranted = (patientUniqueId: string) => {
        queryClient.invalidateQueries({ queryKey: ['patients'] });
        navigate(`/patients/${patientUniqueId}`);
    };

    const tabs: Array<{ key: Tab; label: string; hint: string }> = [
        {
            key: 'new',
            label: t('add_patient.tabs.new.label', 'Register new'),
            hint: t(
                'add_patient.tabs.new.hint',
                'First-time visit, no Altheon account yet — create a new chart. If the email is already registered, you’ll be offered access via OTP instead.',
            ),
        },
        {
            key: 'search',
            label: t('add_patient.tabs.search.label', 'Search & request'),
            hint: t(
                'add_patient.tabs.search.hint',
                'Patient already has an Altheon account — find them and request access.',
            ),
        },
        {
            key: 'scan',
            label: t('add_patient.tabs.scan.label', 'Enter code'),
            hint: t(
                'add_patient.tabs.scan.hint',
                'Patient has the Altheon app open — enter the 6-digit code they read you.',
            ),
        },
    ];

    return (
        <div className="page-wrapper">
            <header style={{ marginBottom: '1rem' }}>
                <h1 style={{ margin: 0 }}>{t('add_patient.title', 'Add patient')}</h1>
                <p style={{ color: 'var(--text-muted)', margin: '0.25rem 0 0' }}>
                    {t(
                        'add_patient.subtitle',
                        'Choose how this patient is reaching you. The Altheon access model means a confirmed appointment, clinic code, OTP, walk-in consultation, or new registration is the only way to see medical history.',
                    )}
                </p>
            </header>

            <div className="db-tabs" style={{ marginBottom: '1rem' }}>
                {tabs.map(tabDef => (
                    <button
                        key={tabDef.key}
                        type="button"
                        className={`db-tab-btn${tab === tabDef.key ? ' active' : ''}`}
                        onClick={() => setTab(tabDef.key)}
                    >
                        {tabDef.label}
                    </button>
                ))}
            </div>

            <p
                style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-muted)',
                    marginTop: 0,
                    marginBottom: '1rem',
                }}
            >
                {tabs.find(x => x.key === tab)?.hint}
            </p>

            {tab === 'scan' && <AddPatientScanTab onAccessGranted={handleAccessGranted} />}

            {tab === 'search' && (
                <AddPatientSearchTab
                    onAccessGranted={handleAccessGranted}
                    initialEmail={searchPrefillEmail}
                />
            )}

            {tab === 'new' && (
                <PatientForm
                    onSuccess={handleNewPatientSuccess}
                    onCancel={() => navigate('/patients')}
                    onRequestExistingAccess={handleRequestExistingAccess}
                />
            )}
        </div>
    );
};

export default AddPatient;
