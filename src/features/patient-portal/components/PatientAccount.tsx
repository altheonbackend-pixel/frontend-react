import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../../shared/components/PageHeader';
import PatientProfile from './PatientProfile';
import PatientSettings from './PatientSettings';
import './PatientHealthRecord.css';

const TABS = ['profile', 'settings'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
    profile: 'Profile',
    settings: 'Settings & Security',
};

export default function PatientAccount() {
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab');
    const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'profile';

    useEffect(() => {
        document.title = 'Account — Altheon Connect';
        return () => { document.title = 'Altheon Connect'; };
    }, [activeTab]);

    const setTab = (tab: Tab) => setSearchParams({ tab }, { replace: true });

    return (
        <>
            <PageHeader
                title="Account"
                subtitle="Manage your personal information, preferences, and security settings."
            />

            <div className="health-record-tabs" role="tablist" aria-label="Account sections">
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
                {activeTab === 'profile' && <PatientProfile asTab />}
                {activeTab === 'settings' && <PatientSettings asTab />}
            </div>
        </>
    );
}
