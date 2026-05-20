import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '../../../shared/components/PageHeader';
import { TabSkeleton } from '../../../shared/components/SectionCard';
import { Icon, type IconName } from '../../../shared/components/Icons';
import { usePageTitle } from '../../../shared/hooks/usePageTitle';
import '../../../shared/styles/settings-ui.css';
import '../styles/Settings.css';

const AccountSection       = lazy(() => import('./sections/AccountSection'));
const ScheduleSection      = lazy(() => import('./sections/ScheduleSection'));
const AvailabilitySection  = lazy(() => import('./sections/AvailabilitySection'));
const NotificationsSection = lazy(() => import('./sections/NotificationsSection'));
const BillingSection       = lazy(() => import('./sections/BillingSection'));
const SecuritySection      = lazy(() => import('./sections/SecuritySection'));
const PreferencesSection   = lazy(() => import('./sections/PreferencesSection'));

const SECTIONS = [
    { id: 'account',       icon: 'profile'  as IconName },
    { id: 'schedule',      icon: 'calendar' as IconName },
    { id: 'availability',  icon: 'clock'    as IconName },
    { id: 'notifications', icon: 'bell'     as IconName },
    { id: 'billing',       icon: 'stats'    as IconName },
    { id: 'security',      icon: 'shield'   as IconName },
    { id: 'preferences',   icon: 'settings' as IconName },
] as const;

type SectionId = typeof SECTIONS[number]['id'];

export default function DoctorSettings() {
    const { t } = useTranslation();
    usePageTitle(t('settings.title', 'Settings'));
    const [searchParams, setSearchParams] = useSearchParams();

    const raw = searchParams.get('section');
    const active: SectionId = SECTIONS.some(s => s.id === raw) ? (raw as SectionId) : 'account';

    const setSection = (id: SectionId) => setSearchParams({ section: id }, { replace: true });

    return (
        <>
            <PageHeader title={t('settings.title', 'Settings')} subtitle={t('settings.subtitle')} />

            <div className="settings-layout">
                <nav className="settings-nav" role="tablist" aria-label={t('settings.sections_aria')}>
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
                            {t(`settings.nav.${s.id}`)}
                        </button>
                    ))}
                </nav>

                <div className="settings-content" role="tabpanel">
                    <Suspense fallback={<div className="settings-card"><div className="settings-card-body"><TabSkeleton rows={5} /></div></div>}>
                        {active === 'account'       && <AccountSection />}
                        {active === 'schedule'      && <ScheduleSection />}
                        {active === 'availability'  && <AvailabilitySection />}
                        {active === 'notifications' && <NotificationsSection />}
                        {active === 'billing'       && <BillingSection />}
                        {active === 'security'      && <SecuritySection />}
                        {active === 'preferences'   && <PreferencesSection />}
                    </Suspense>
                </div>
            </div>
        </>
    );
}
