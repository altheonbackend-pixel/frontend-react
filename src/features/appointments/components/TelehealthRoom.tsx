// Full-page wrapper for /telehealth/:appointmentId.
// Doctor uses this when joining a visit from the appointment row.

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
    if (!id) return <div className="page-wrapper">{t('telehealth.bad_id', 'Invalid appointment.')}</div>;

    return (
        <div className="page-wrapper" style={{ paddingTop: 0 }}>
            <TelehealthCall
                appointmentId={id}
                role={userType === 'patient' ? 'patient' : 'doctor'}
                minimized={minimized}
                onToggleMinimize={() => setMinimized(m => !m)}
                onEnd={() => navigate('/appointments')}
            />
        </div>
    );
}

export default TelehealthRoom;
