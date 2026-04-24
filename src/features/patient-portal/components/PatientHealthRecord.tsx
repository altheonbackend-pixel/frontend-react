import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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

const TAB_LABELS: Record<Tab, string> = {
    visits: 'Visits',
    labs: 'Lab Results',
    medications: 'Medications',
    conditions: 'Conditions & Allergies',
    referrals: 'Referrals',
};

export default function PatientHealthRecord() {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab');
    const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'visits';

    useEffect(() => {
        document.title = 'My Health — Altheon Connect';
        return () => { document.title = 'Altheon Connect'; };
    }, [activeTab]);

    const setTab = (tab: Tab) => setSearchParams({ tab }, { replace: true });

    return (
        <>
            <PageHeader
                title="My Health"
                subtitle="Your complete medical record in one place."
            />

            <div className="health-record-tabs" role="tablist" aria-label="Health record sections">
                {TABS.map(tab => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        className={`health-tab-btn${activeTab === tab ? ' health-tab-btn--active' : ''}`}
                        onClick={() => setTab(tab)}
                    >
                        {TAB_LABELS[tab]}
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
