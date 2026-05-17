// CR-P3-11 — GetStream-powered telehealth visit.
//
// Architecture:
//   - Backend `GET /telehealth/credentials/` issues a short-lived JWT for the
//     current user (doctor OR patient).
//   - Backend `GET /telehealth/<id>/join/` returns call ID + joinability gate.
//   - Frontend uses `@stream-io/video-react-sdk` to actually open the room.
//     The SDK is bundled as a separate chunk via dynamic import, so it only
//     loads on telehealth routes. If the import fails at runtime, we fall
//     back to the legacy `telehealth_room_url` (Jitsi/Daily).
//
// Backend env: set `STREAM_API_KEY` + `STREAM_API_SECRET` in Django and
// `TELEHEALTH_PROVIDER=getstream` (already the default).
//
// Clinical UX:
//   - Dark immersive stage, speaker layout, custom control bar
//   - Mic toggle, camera toggle, screen share, end visit
//   - Doctor: collapsible side panel hosting the live consultation form,
//     so charting happens without leaving the call.
//   - Minimize → floating PiP card while charting elsewhere

import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../shared/services/api';
import { toast } from '../../../shared/components/ui';
import { useFormatDateTime } from '../../../shared/hooks/useUserTimezone';
import '../styles/Telehealth.css';

// Lazy-load the consultation form so it doesn't bloat the call bundle.
const ConsultationForm = lazy(() => import('../../consultations/components/ConsultationForm'));

// GetStream Video SDK is optional at install time.
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
    patient_id?: number;
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
    const { formatDateTimeLong } = useFormatDateTime();
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

    useEffect(() => {
        if (!creds?.configured || !join?.can_join) return;
        (async () => {
            try {
                // Stream ships its own stylesheet; without it, layouts render unstyled.
                await import('@stream-io/video-react-sdk/dist/css/styles.css');
                const mod = await import('@stream-io/video-react-sdk');
                setSdk(mod);
            } catch {
                setSdkUnavailable(true);
            }
        })();
    }, [creds?.configured, join?.can_join]);

    const handleStart = async () => {
        if (role !== 'doctor') return;
        try { await api.post(`/telehealth/${appointmentId}/start/`); }
        catch { /* idempotent best-effort */ }
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
        return (
            <div className="th-shell th-shell--center">
                <div className="th-spinner" aria-hidden />
                <p>{t('common.loading', 'Loading…')}</p>
            </div>
        );
    }
    if (error) {
        return (
            <div className="th-shell th-shell--center">
                <div className="th-gate-icon">!</div>
                <h3>{t('telehealth.error.title', 'Unable to start visit')}</h3>
                <p>{error}</p>
            </div>
        );
    }
    if (!join?.can_join) {
        return (
            <div className="th-shell th-shell--center">
                <div className="th-gate-icon">
                    <VideoIcon />
                </div>
                <h3>{t('telehealth.gate.title', 'Telehealth visit')}</h3>
                <p>{join?.why_not || t('telehealth.gate.locked', 'Room not yet open.')}</p>
                {join?.window_opens_at && (
                    <small>
                        {t('telehealth.gate.window', 'Window opens')}{' '}
                        {formatDateTimeLong(join.window_opens_at, { appendTzLabel: true })}
                    </small>
                )}
            </div>
        );
    }
    if (!creds?.configured) {
        return (
            <div className="th-shell th-shell--center">
                <h3>{t('telehealth.config.missing', 'Telehealth is not configured.')}</h3>
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
            <div className="th-shell th-shell--center">
                <h3>{t('telehealth.sdk.missing', 'Stream Video SDK is not installed.')}</h3>
                <p><code>npm install @stream-io/video-react-sdk</code></p>
                {join.fallback_url && (
                    <a href={join.fallback_url} target="_blank" rel="noreferrer" className="btn btn-secondary">
                        {t('telehealth.fallback.open', 'Open external room')}
                    </a>
                )}
            </div>
        );
    }
    if (!sdk) {
        return (
            <div className="th-shell th-shell--center">
                <div className="th-spinner" aria-hidden />
                <p>{t('telehealth.loading_sdk', 'Loading video…')}</p>
            </div>
        );
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

// ────────────────────────────────────────────────────────────────────────────
// Stage with live SDK
// ────────────────────────────────────────────────────────────────────────────

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
    const { StreamVideoClient, StreamVideo, StreamCall } = sdk;

    const clientRef = useRef<unknown>(null);
    const callRef = useRef<unknown>(null);

    if (!clientRef.current) {
        clientRef.current = new StreamVideoClient({
            apiKey: creds.api_key,
            user: { id: creds.user_id, name: creds.user_name },
            token: creds.token,
        });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const client = clientRef.current as any;
    if (!callRef.current) {
        callRef.current = client.call(join.call_type, join.call_id);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = callRef.current as any;

    useEffect(() => {
        let mounted = true;
        call.join({ create: true })
            .then(() => { if (mounted) onStart(); })
            .catch(() => undefined);
        return () => {
            mounted = false;
            call.leave().catch(() => undefined);
            client.disconnectUser().catch(() => undefined);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <StreamVideo client={client}>
            <StreamCall call={call}>
                <CallStageInner
                    sdk={sdk}
                    join={join}
                    role={role}
                    minimized={minimized}
                    onToggleMinimize={onToggleMinimize}
                    onEnd={onEnd}
                    joined={joined}
                />
            </StreamCall>
        </StreamVideo>
    );
}

interface CallStageInnerProps {
    sdk: StreamSdk;
    join: TelehealthJoin;
    role: 'doctor' | 'patient';
    minimized: boolean;
    onToggleMinimize?: () => void;
    onEnd: () => void;
    joined: boolean;
}

function CallStageInner({ sdk, join, role, minimized, onToggleMinimize, onEnd, joined }: CallStageInnerProps) {
    const { t } = useTranslation();
    const { SpeakerLayout, PaginatedGridLayout, useCallStateHooks } = sdk;
    const [notesOpen, setNotesOpen] = useState(false);
    const [confirmEnd, setConfirmEnd] = useState(false);

    const { useMicrophoneState, useCameraState, useScreenShareState, useCallCallingState, useHasOngoingScreenShare } = useCallStateHooks();
    const mic = useMicrophoneState();
    const cam = useCameraState();
    const screen = useScreenShareState();
    const callingState = useCallCallingState?.();
    const hasScreenShare = useHasOngoingScreenShare?.() ?? false;

    const remoteName = role === 'doctor' ? join.patient_name : `Dr. ${join.doctor_name}`;
    const subtitle = role === 'doctor' ? join.reason : t('telehealth.with_doctor', 'Telehealth visit');

    const stageClass = [
        'th-stage',
        minimized ? 'th-stage--mini' : 'th-stage--full',
        notesOpen && !minimized ? 'th-stage--with-panel' : '',
    ].filter(Boolean).join(' ');

    return (
        <div className={stageClass} role="region" aria-label={t('telehealth.aria_room', 'Telehealth video room')}>
            {/* Top status bar */}
            <header className="th-topbar">
                <div className="th-topbar__left">
                    <span className={`th-presence ${joined ? 'th-presence--live' : ''}`} aria-hidden />
                    <div className="th-topbar__meta">
                        <strong className="th-topbar__name">{remoteName}</strong>
                        <span className="th-topbar__sub">{subtitle}</span>
                    </div>
                </div>
                <div className="th-topbar__right">
                    <CallTimer joined={joined} />
                    {onToggleMinimize && (
                        <button
                            type="button"
                            className="th-iconbtn th-iconbtn--ghost"
                            onClick={onToggleMinimize}
                            aria-label={minimized ? t('telehealth.expand', 'Expand') : t('telehealth.minimize', 'Minimize')}
                            title={minimized ? t('telehealth.expand', 'Expand') : t('telehealth.minimize', 'Minimize')}
                        >
                            {minimized ? <ExpandIcon /> : <MinimizeIcon />}
                        </button>
                    )}
                </div>
            </header>

            {/* Main stage: video + optional side panel */}
            <div className="th-main">
                <div className="th-video">
                    {hasScreenShare ? (
                        <SpeakerLayout participantsBarPosition={minimized ? null : 'bottom'} />
                    ) : (
                        <PaginatedGridLayout groupSize={minimized ? 1 : 4} excludeLocalParticipant={false} pageArrowsVisible={false} />
                    )}
                    {callingState && callingState !== 'joined' && (
                        <div className="th-connecting">
                            <div className="th-spinner" aria-hidden />
                            <p>{t('telehealth.connecting', 'Connecting…')}</p>
                        </div>
                    )}
                </div>

                {role === 'doctor' && notesOpen && !minimized && join.patient_id && (
                    <aside className="th-panel" aria-label={t('telehealth.notes_panel', 'Consultation form')}>
                        <div className="th-panel__head">
                            <h3>{t('telehealth.notes_title', 'Consultation form')}</h3>
                            <button
                                type="button"
                                className="th-iconbtn th-iconbtn--ghost"
                                onClick={() => setNotesOpen(false)}
                                aria-label={t('common.close', 'Close')}
                            >
                                <CloseIcon />
                            </button>
                        </div>
                        <div className="th-panel__body">
                            <Suspense fallback={<div className="th-panel__loading">{t('common.loading', 'Loading…')}</div>}>
                                <ConsultationForm
                                    embedded
                                    patientId={String(join.patient_id)}
                                    onSuccess={() => {
                                        toast.success(t('telehealth.notes_saved', 'Consultation saved.'));
                                    }}
                                    onCancel={() => setNotesOpen(false)}
                                />
                            </Suspense>
                        </div>
                    </aside>
                )}
            </div>

            {/* Bottom control bar */}
            <footer className="th-controls" role="toolbar" aria-label={t('telehealth.controls', 'Call controls')}>
                <div className="th-controls__group">
                    <ControlButton
                        active={!mic.isMute}
                        onClick={() => mic.microphone.toggle()}
                        label={mic.isMute ? t('telehealth.unmute', 'Unmute') : t('telehealth.mute', 'Mute')}
                        danger={mic.isMute}
                    >
                        {mic.isMute ? <MicOffIcon /> : <MicIcon />}
                    </ControlButton>

                    <ControlButton
                        active={!cam.isMute}
                        onClick={() => cam.camera.toggle()}
                        label={cam.isMute ? t('telehealth.cam_on', 'Turn camera on') : t('telehealth.cam_off', 'Turn camera off')}
                        danger={cam.isMute}
                    >
                        {cam.isMute ? <CamOffIcon /> : <CamIcon />}
                    </ControlButton>

                    {role === 'doctor' && (
                        <ControlButton
                            active={!screen.isMute}
                            onClick={() => screen.screenShare.toggle()}
                            label={screen.isMute ? t('telehealth.share', 'Share screen') : t('telehealth.stop_share', 'Stop sharing')}
                        >
                            <ScreenIcon />
                        </ControlButton>
                    )}
                </div>

                {role === 'doctor' && join.patient_id && (
                    <div className="th-controls__group">
                        <button
                            type="button"
                            className={`th-actionbtn ${notesOpen ? 'th-actionbtn--active' : ''}`}
                            onClick={() => setNotesOpen(o => !o)}
                            aria-pressed={notesOpen}
                        >
                            <NotesIcon />
                            <span>{notesOpen ? t('telehealth.close_notes', 'Hide consultation form') : t('telehealth.open_notes', 'Open consultation form')}</span>
                        </button>
                    </div>
                )}

                <div className="th-controls__group">
                    <button
                        type="button"
                        className="th-endbtn"
                        onClick={() => (role === 'doctor' ? setConfirmEnd(true) : onEnd())}
                        aria-label={role === 'doctor' ? t('telehealth.end_visit', 'End visit') : t('telehealth.leave', 'Leave call')}
                    >
                        <PhoneOffIcon />
                        <span>{role === 'doctor' ? t('telehealth.end_visit', 'End visit') : t('telehealth.leave', 'Leave')}</span>
                    </button>
                </div>
            </footer>

            {confirmEnd && (
                <div className="th-confirm" role="dialog" aria-modal="true">
                    <div className="th-confirm__card">
                        <h3>{t('telehealth.end_confirm_title', 'End this visit?')}</h3>
                        <p>{t('telehealth.end_confirm_body', 'Both parties will be disconnected and the appointment will be marked complete.')}</p>
                        <div className="th-confirm__actions">
                            <button type="button" className="btn btn-secondary" onClick={() => setConfirmEnd(false)}>
                                {t('common.cancel', 'Cancel')}
                            </button>
                            <button type="button" className="btn btn-danger" onClick={() => { setConfirmEnd(false); onEnd(); }}>
                                {t('telehealth.end_visit', 'End visit')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Control button + timer
// ────────────────────────────────────────────────────────────────────────────

interface ControlButtonProps {
    active: boolean;
    onClick: () => void;
    label: string;
    danger?: boolean;
    children: React.ReactNode;
}

function ControlButton({ active, onClick, label, danger, children }: ControlButtonProps) {
    const cls = [
        'th-ctrl',
        active ? 'th-ctrl--on' : 'th-ctrl--off',
        danger ? 'th-ctrl--danger' : '',
    ].filter(Boolean).join(' ');
    return (
        <button type="button" className={cls} onClick={onClick} aria-label={label} title={label}>
            {children}
        </button>
    );
}

function CallTimer({ joined }: { joined: boolean }) {
    const [start] = useState(() => Date.now());
    const [tick, setTick] = useState(0);
    useEffect(() => {
        if (!joined) return;
        const id = setInterval(() => setTick(t => t + 1), 1000);
        return () => clearInterval(id);
    }, [joined]);
    if (!joined) return null;
    const elapsed = Math.floor((Date.now() - start) / 1000);
    const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const ss = String(elapsed % 60).padStart(2, '0');
    return <span className="th-timer" aria-live="polite">{mm}:{ss}<span className="sr-only"> elapsed (tick {tick})</span></span>;
}

// ────────────────────────────────────────────────────────────────────────────
// Inline icons (Lucide-style)
// ────────────────────────────────────────────────────────────────────────────

const Svg = (p: React.SVGProps<SVGSVGElement>) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p} />
);

const MicIcon = () => (
    <Svg><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></Svg>
);
const MicOffIcon = () => (
    <Svg><line x1="1" y1="1" x2="23" y2="23" /><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" /><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23" /><line x1="12" y1="19" x2="12" y2="23" /><line x1="8" y1="23" x2="16" y2="23" /></Svg>
);
const CamIcon = () => (
    <Svg><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></Svg>
);
const CamOffIcon = () => (
    <Svg><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10" /><line x1="1" y1="1" x2="23" y2="23" /></Svg>
);
const ScreenIcon = () => (
    <Svg><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></Svg>
);
const PhoneOffIcon = () => (
    <Svg><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-3.55-2.9" /><line x1="23" y1="1" x2="1" y2="23" /></Svg>
);
const NotesIcon = () => (
    <Svg><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /></Svg>
);
const VideoIcon = () => (
    <Svg width="36" height="36"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></Svg>
);
const MinimizeIcon = () => (
    <Svg width="18" height="18"><polyline points="4 14 10 14 10 20" /><polyline points="20 10 14 10 14 4" /><line x1="14" y1="10" x2="21" y2="3" /><line x1="3" y1="21" x2="10" y2="14" /></Svg>
);
const ExpandIcon = () => (
    <Svg width="18" height="18"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></Svg>
);
const CloseIcon = () => (
    <Svg width="18" height="18"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Svg>
);

export default TelehealthCall;
