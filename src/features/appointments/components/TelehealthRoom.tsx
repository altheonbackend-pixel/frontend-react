// Full-page wrapper for /telehealth/:appointmentId.
// Doctor (or patient on /patient/telehealth/:id) uses this to join a visit.
// The actual UI is rendered by <TelehealthCall/>, which is position:fixed and
// covers the app sidebar/header for an immersive call experience.

import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TelehealthCall } from './TelehealthCall';
import { useAuth } from '../../auth/hooks/useAuth';

export function TelehealthRoom() {
    const { t } = useTranslation();
    const { appointmentId } = useParams<{ appointmentId: string }>();
    const navigate = useNavigate();
    const { userType } = useAuth();
    const [minimized, setMinimized] = useState(false);
    const id = Number(appointmentId);
    if (!id) {
        return <div className="page-wrapper">{t('telehealth.bad_id', 'Invalid appointment.')}</div>;
    }

    return (
        <TelehealthCall
            appointmentId={id}
            role={userType === 'patient' ? 'patient' : 'doctor'}
            minimized={minimized}
            onToggleMinimize={() => setMinimized(m => !m)}
            onEnd={() => navigate(userType === 'patient' ? '/patient/appointments' : '/appointments')}
        />
    );
}

export default TelehealthRoom;
