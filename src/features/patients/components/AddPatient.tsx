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
 *   1. Scan code (B1) — patient shows a QR / clinic code in their portal.
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
    const [tab, setTab] = useState<Tab>('scan');

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
            key: 'scan',
            label: t('add_patient.tabs.scan.label', 'Scan code'),
            hint: t(
                'add_patient.tabs.scan.hint',
                'Patient has the Altheon app open — scan their 60s clinic code.',
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
            key: 'new',
            label: t('add_patient.tabs.new.label', 'Register new'),
            hint: t(
                'add_patient.tabs.new.hint',
                'First-time visit, no Altheon account yet — create a new chart.',
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
                        'Choose how this patient is reaching you. The Altheon access model means a confirmed appointment, scanned code, OTP, walk-in consultation, or new registration is the only way to see medical history.',
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
                <AddPatientSearchTab onAccessGranted={handleAccessGranted} />
            )}

            {tab === 'new' && (
                <PatientForm
                    onSuccess={handleNewPatientSuccess}
                    onCancel={() => navigate('/patients')}
                />
            )}
        </div>
    );
};

export default AddPatient;
