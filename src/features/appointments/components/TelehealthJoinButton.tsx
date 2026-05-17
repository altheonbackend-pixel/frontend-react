// CR-P3-11 — "Join visit" button used on appointment rows.
// Becomes active 10 min before the slot; before that, shows a countdown.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { Icon } from '../../../shared/components/Icons';

interface Props {
    appointmentId: number;
    onJoin: () => void;
    refreshIntervalMs?: number;
}

interface JoinResponse {
    can_join: boolean;
    why_not: string | null;
    starts_at: string;
    window_opens_at: string;
}

export function TelehealthJoinButton({ appointmentId, onJoin, refreshIntervalMs = 30_000 }: Props) {
    const { t } = useTranslation();
    const [state, setState] = useState<JoinResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        const fetchState = async () => {
            try {
                const r = await api.get<JoinResponse>(`/telehealth/${appointmentId}/join/`);
                if (!cancelled) setState(r.data);
            } catch (e: unknown) {
                if (!cancelled) setError(
                    (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                    || 'Unable to load telehealth state.',
                );
            }
        };
        fetchState();
        const id = setInterval(fetchState, refreshIntervalMs);
        return () => { cancelled = true; clearInterval(id); };
    }, [appointmentId, refreshIntervalMs]);

    if (error) {
        return <span className="text-muted" style={{ fontSize: '0.8rem' }}>{error}</span>;
    }
    if (!state) {
        return <span className="text-muted" style={{ fontSize: '0.8rem' }}>{t('common.loading', 'Loading…')}</span>;
    }

    if (!state.can_join) {
        return (
            <span className="badge badge-muted" title={state.why_not || ''}>
                <Icon name="clock" size={14} /> {t('telehealth.locked', 'Opens')} {new Date(state.window_opens_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
        );
    }

    return (
        <button
            type="button"
            className="btn btn-primary btn-sm telehealth-join-btn"
            onClick={onJoin}
            style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}
        >
            <Icon name="video" size={14} /> {t('telehealth.join', 'Join visit')}
        </button>
    );
}

export default TelehealthJoinButton;
