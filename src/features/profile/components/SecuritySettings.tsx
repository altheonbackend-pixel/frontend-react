// CR-P1-16 — Profile → Security route. Hosts the TwoFactorSetup component.

import { useTranslation } from 'react-i18next';
import { TwoFactorSetup } from './TwoFactorSetup';

export function SecuritySettings() {
    const { t } = useTranslation();
    return (
        <div className="page-wrapper-tight">
            <h1>{t('security.title', 'Security')}</h1>
            <TwoFactorSetup />
        </div>
    );
}

export default SecuritySettings;
