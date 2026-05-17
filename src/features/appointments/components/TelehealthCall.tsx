// CR-P3-11 — GetStream-powered telehealth visit.
//
// Architecture:
//   - Backend `GET /telehealth/credentials/` issues a short-lived JWT for the
//     current user (doctor OR patient).
//   - Backend `GET /telehealth/<id>/join/` returns call ID + joinability gate.
//   - Frontend uses `@stream-io/video-react-sdk` to actually open the room.
//   - The component is INTENTIONALLY pluggable: if `@stream-io/video-react-sdk`
//     is not yet installed, we render a "Install GetStream SDK" call-to-action
//     and fall back to the legacy `telehealth_room_url` (Jitsi/Daily) so the
//     feature is never blocked on the JS install. This keeps the route
//     usable in CI / staging without API keys.
//
// Install steps (run once at the repo root):
//
//     cd frontend-react
//     npm install @stream-io/video-react-sdk
//
// Then set `STREAM_API_KEY` + `STREAM_API_SECRET` in the Django env and
// `TELEHEALTH_PROVIDER=getstream` (already the default).
//
// The component handles a clinical-grade UX:
//   - PiP-style minimize while charting (CR-P3-11 UI #10)
//   - Doctor sees patient name + appointment reason as overlay
//   - "End visit" button transitions Appointment → completed
//   - Patient-side gets a simple "Connecting…" → in-call → "Visit ended" flow

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { toast } from '../../../shared/components/ui';
import { Icon } from '../../../shared/components/Icons';

// GetStream Video SDK is optional at install time. Until the package is
// installed (`npm i @stream-io/video-react-sdk`) we type it as `any` so
// the production build doesn't fail. The component's runtime fallback
// path renders a setup CTA if the dynamic import throws.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamSdk = any;

interface TelehealthCredentials {
    api_key: string;
    user_id: string;
    user_name: string;
    token: string;
    configured: boolean;
}

interface TelehealthJoin {
    appointment_id: number;
    provider: string;
    call_id: string;
    call_type: string;
    call_cid: string;
    fallback_url: string | null;
    starts_at: string;
    window_opens_at: string;
    window_closes_at: string;
    can_join: boolean;
    why_not: string | null;
    patient_name: string;
    doctor_name: string;
    reason: string;
}

interface TelehealthCallProps {
    appointmentId: number;
    role: 'doctor' | 'patient';
    minimized?: boolean;
    onToggleMinimize?: () => void;
    onEnd?: () => void;
}

export function TelehealthCall({ appointmentId, role, minimized, onToggleMinimize, onEnd }: TelehealthCallProps) {
    const { t } = useTranslation();
    const [creds, setCreds] = useState<TelehealthCredentials | null>(null);
    const [join, setJoin] = useState<TelehealthJoin | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sdk, setSdk] = useState<StreamSdk | null>(null);
    const [sdkUnavailable, setSdkUnavailable] = useState(false);
    const [callJoined, setCallJoined] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const [c, j] = await Promise.all([
                    api.get<TelehealthCredentials>('/telehealth/credentials/'),
                    api.get<TelehealthJoin>(`/telehealth/${appointmentId}/join/`),
                ]);
                if (cancelled) return;
                setCreds(c.data);
                setJoin(j.data);
            } catch (e: unknown) {
                setError((e as { response?: { data?: { detail?: string } } })?.response?.data?.detail
                    || 'Could not load telehealth session.');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [appointmentId]);

    // Try to dynamically import the GetStream SDK. If the package isn't installed
    // (no `npm i` yet), we fall back to a "Open external room" link so the
    // appointment still has a working video path.
    useEffect(() => {
        if (!creds?.configured || !join?.can_join) return;
        (async () => {
            try {
                // Dynamic + variable so Vite doesn't try to resolve the
                // optional dep at build time. Falls back to fallback URL
                // when the SDK isn't installed.
                const pkg = '@stream-io/video-react-sdk';
                const mod = await import(/* @vite-ignore */ pkg);
                setSdk(mod);
            } catch {
                setSdkUnavailable(true);
            }
        })();
    }, [creds?.configured, join?.can_join]);

    const handleStart = async () => {
        if (role !== 'doctor') return;
        try { await api.post(`/telehealth/${appointmentId}/start/`); }
        catch { /* ignore — start is idempotent best-effort */ }
    };

    const handleEnd = async () => {
        if (role !== 'doctor') {
            onEnd?.();
            return;
        }
        try {
            await api.post(`/telehealth/${appointmentId}/end/`);
            toast.success(t('telehealth.toast.ended', 'Visit ended.'));
        } catch { /* ignore */ }
        onEnd?.();
    };

    if (loading) {
        return <div className="telehealth-stage telehealth-stage--loading">{t('common.loading', 'Loading…')}</div>;
    }
    if (error) {
        return <div className="telehealth-stage telehealth-stage--error">{error}</div>;
    }
    if (!join?.can_join) {
        return (
            <div className="telehealth-stage telehealth-stage--gate">
                <Icon name="video" size={48} />
                <h3>{t('telehealth.gate.title', 'Telehealth visit')}</h3>
                <p>{join?.why_not || t('telehealth.gate.locked', 'Room not yet open.')}</p>
                <small>{t('telehealth.gate.window', 'Window opens')} {new Date(join?.window_opens_at || '').toLocaleString()}</small>
            </div>
        );
    }
    if (!creds?.configured) {
        return (
            <div className="telehealth-stage telehealth-stage--gate">
                <h3>⚠ {t('telehealth.config.missing', 'Telehealth is not configured.')}</h3>
                <p>{t('telehealth.config.help', 'Set STREAM_API_KEY and STREAM_API_SECRET on the backend.')}</p>
                {join.fallback_url && (
                    <a href={join.fallback_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                        {t('telehealth.fallback.open', 'Open fallback room (Jitsi)')}
                    </a>
                )}
            </div>
        );
    }
    if (sdkUnavailable) {
        return (
            <div className="telehealth-stage telehealth-stage--gate">
                <h3>{t('telehealth.sdk.missing', 'Stream Video SDK is not installed.')}</h3>
                <p>
                    <code>npm install @stream-io/video-react-sdk</code>
                </p>
                {join.fallback_url && (
                    <a href={join.fallback_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                        {t('telehealth.fallback.open', 'Open external room')}
                    </a>
                )}
            </div>
        );
    }
    if (!sdk) {
        return <div className="telehealth-stage">{t('telehealth.loading_sdk', 'Loading video…')}</div>;
    }

    return (
        <StreamCallStage
            sdk={sdk} creds={creds} join={join}
            role={role}
            minimized={!!minimized}
            onToggleMinimize={onToggleMinimize}
            onStart={() => { handleStart(); setCallJoined(true); }}
            onEnd={handleEnd}
            joined={callJoined}
        />
    );
}


interface StreamCallStageProps {
    sdk: StreamSdk;
    creds: TelehealthCredentials;
    join: TelehealthJoin;
    role: 'doctor' | 'patient';
    minimized: boolean;
    onToggleMinimize?: () => void;
    onStart: () => void;
    onEnd: () => void;
    joined: boolean;
}

function StreamCallStage({ sdk, creds, join, role, minimized, onToggleMinimize, onStart, onEnd, joined }: StreamCallStageProps) {
    const { t } = useTranslation();
    const {
        StreamVideoClient, StreamVideo, StreamCall, SpeakerLayout, CallControls,
    } = sdk;

    const [client] = useState(() => {
        return new StreamVideoClient({
            apiKey: creds.api_key,
            user: { id: creds.user_id, name: creds.user_name },
            token: creds.token,
        });
    });
    const [call] = useState(() => client.call(join.call_type, join.call_id));

    useEffect(() => {
        call.join({ create: true }).then(() => onStart()).catch(() => undefined);
        return () => {
            call.leave().catch(() => undefined);
            // Allow client disconnect to be best-effort.
            client.disconnectUser().catch(() => undefined);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stageClass = `telehealth-stage telehealth-stage--live${minimized ? ' telehealth-stage--mini' : ''}`;

    return (
        <div className={stageClass} role="region" aria-label={t('telehealth.aria_room', 'Telehealth video room')}>
            <div className="telehealth-bar">
                <div className="telehealth-bar-meta">
                    <Icon name="video" size={16} />
                    <strong>{role === 'doctor' ? join.patient_name : `Dr. ${join.doctor_name}`}</strong>
                    {role === 'doctor' && <span className="telehealth-bar-reason"> · {join.reason}</span>}
                    {joined && <span className="telehealth-presence-dot" title={t('telehealth.live', 'Live')} />}
                </div>
                <div className="telehealth-bar-actions">
                    {onToggleMinimize && (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={onToggleMinimize}>
                            {minimized ? t('telehealth.expand', '↗ Expand') : t('telehealth.minimize', '⤵ Minimize')}
                        </button>
                    )}
                    {role === 'doctor' && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={onEnd}>
                            {t('telehealth.end_visit', 'End visit')}
                        </button>
                    )}
                </div>
            </div>
            <StreamVideo client={client}>
                <StreamCall call={call}>
                    <SpeakerLayout />
                    <CallControls />
                </StreamCall>
            </StreamVideo>
        </div>
    );
}

export default TelehealthCall;
