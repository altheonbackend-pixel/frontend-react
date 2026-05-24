import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { Icon, type IconName } from '../../../shared/components/Icons';
import PatientProfile from './PatientProfile';
import PatientSettings, { type PatientSettingsSection } from './PatientSettings';
import '../../../shared/styles/settings-ui.css';
import '../../profile/styles/Settings.css';
import './PatientAccount.css';

const SECTIONS = [
    { id: 'profile',       icon: 'profile'  as IconName },
    { id: 'preferences',   icon: 'settings' as IconName },
    { id: 'notifications', icon: 'bell'     as IconName },
    { id: 'location',      icon: 'home'     as IconName },
    { id: 'security',      icon: 'shield'   as IconName },
    { id: 'requests',      icon: 'mail'     as IconName },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

export default function PatientAccount() {
    const { t } = useTranslation();
    const [searchParams, setSearchParams] = useSearchParams();
    const raw = searchParams.get('section') ?? searchParams.get('tab');
    const active: SectionId = SECTIONS.some(s => s.id === raw) ? (raw as SectionId) : 'profile';

    useEffect(() => {
        document.title = t('patient_portal.account.document_title');
        return () => { document.title = 'Altheon Connect'; };
    }, [active, t]);

    const setSection = (id: SectionId) => setSearchParams({ section: id }, { replace: true });

    return (
        <>
            <PageHeader
                title={t('patient_portal.account.title')}
                subtitle={t('patient_portal.account.subtitle')}
            />

            <div className="settings-layout">
                <nav className="settings-nav" role="tablist" aria-label={t('patient_portal.account.sections_aria')}>
                    {SECTIONS.map(s => (
                        <button
                            key={s.id}
                            type="button"
                            role="tab"
                            aria-selected={active === s.id}
                            className={`settings-nav-item${active === s.id ? ' active' : ''}`}
                            onClick={() => setSection(s.id)}
                        >
                            <Icon name={s.icon} size={18} className="settings-nav-icon" />
                            {t(`patient_portal.account.sections.${s.id}`)}
                        </button>
                    ))}
                </nav>

                <div className="settings-content" role="tabpanel">
                    {active === 'profile'
                        ? <PatientProfile asTab />
                        : <PatientSettings asTab section={active as PatientSettingsSection} />}
                </div>
            </div>
        </>
    );
}
