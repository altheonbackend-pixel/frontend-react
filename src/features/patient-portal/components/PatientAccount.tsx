import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import PatientProfile from './PatientProfile';
import PatientSettings from './PatientSettings';
import './PatientHealthRecord.css';

const TABS = ['profile', 'settings'] as const;
type Tab = typeof TABS[number];

export default function PatientAccount() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const rawTab = searchParams.get('tab');
    const activeTab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : 'profile';

    useEffect(() => {
        document.title = t('patient_portal.account.document_title');
        return () => { document.title = 'Altheon Connect'; };
    }, [activeTab, t]);

    const setTab = (tab: Tab) => setSearchParams({ tab }, { replace: true });

    return (
        <>
            <PageHeader
                title={t('patient_portal.account.title')}
                subtitle={t('patient_portal.account.subtitle')}
            />

            <div className="health-record-tabs" role="tablist" aria-label={t('patient_portal.account.sections_aria')}>
                {TABS.map(tab => (
                    <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        className={`health-tab-btn${activeTab === tab ? ' health-tab-btn--active' : ''}`}
                        onClick={() => setTab(tab)}
                    >
                        {t(`patient_portal.account.tabs.${tab}`)}
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
