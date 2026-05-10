import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import PatientVisits from './PatientVisits';
import PatientLabs from './PatientLabs';
import PatientMedications from './PatientMedications';
import PatientConditions from './PatientConditions';
import PatientAllergies from './PatientAllergies';
import PatientReferrals from './PatientReferrals';
import './PatientHealthRecord.css';

const TABS = ['visits', 'labs', 'medications', 'conditions', 'referrals'] as const;
type Tab = typeof TABS[number];

export default function PatientHealthRecord() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab');
    const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'visits';

    useEffect(() => {
        document.title = t('patient_portal.health.document_title');
        return () => { document.title = 'Altheon Connect'; };
    }, [activeTab, t]);

    const setTab = (tab: Tab) => setSearchParams({ tab }, { replace: true });

    return (
        <>
            <PageHeader
                title={t('patient_portal.health.title')}
                subtitle={t('patient_portal.health.subtitle')}
            />

            <div className="health-record-tabs" role="tablist" aria-label={t('patient_portal.health.sections_aria')}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        className={`health-tab-btn${activeTab === tab ? ' health-tab-btn--active' : ''}`}
                        onClick={() => setTab(tab)}
                    >
                        {t(`patient_portal.health.tabs.${tab}`)}
                    </button>
                ))}
            </div>

            <div className="health-record-content" role="tabpanel">
                {activeTab === 'visits' && <PatientVisits asTab />}
                {activeTab === 'labs' && <PatientLabs asTab />}
                {activeTab === 'medications' && <PatientMedications asTab />}
                {activeTab === 'conditions' && (
                    <div style={{ display: 'grid', gap: '1.5rem' }}>
                        <PatientConditions asTab />
                        <PatientAllergies asTab />
                    </div>
                )}
                {activeTab === 'referrals' && <PatientReferrals asTab />}
            </div>
        </>
    );
}
