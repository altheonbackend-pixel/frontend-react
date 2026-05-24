// src/shared/components/LiveCameraCapture.tsx
//
// Live-camera-only capture for profile photos.
//
// Used directly by the DOCTOR avatar flow (no device upload by policy) and
// embedded by <AvatarPicker /> for patients (where it's one of two options).
//
// Contract:
//   - Calls `onCapture(blob)` with a JPEG Blob when the user accepts the shot.
//   - Calls `onCancel()` if provided when the user backs out.
//   - Streams cleanly stop on unmount or after capture/cancel.
//   - Front camera ("user") preferred; falls back to whatever the browser
//     provides if there's only one camera (laptop).
//
// Permission UX:
//   - First render asks for camera permission via getUserMedia.
//   - If denied / unavailable, renders a clear, actionable error with retry.

import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
    onCapture: (blob: Blob) => void;
    onCancel?: () => void;
    /** Output JPEG quality 0..1 (default 0.9 — server re-encodes regardless). */
    quality?: number;
    /** Max output dimension in pixels (default 1024 — matches server target). */
    maxDimension?: number;
}

type Phase = 'requesting' | 'streaming' | 'previewing' | 'denied' | 'error';

export function LiveCameraCapture({
    onCapture,
    onCancel,
    quality = 0.9,
    maxDimension = 1024,
}: Props) {
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [phase, setPhase] = useState<Phase>('requesting');
    const [errMsg, setErrMsg] = useState<string>('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
    }, []);

    const startStream = useCallback(async () => {
        setErrMsg('');
        setPhase('requesting');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
                audio: false,
            });
            streamRef.current = stream;
            // Do NOT touch videoRef here — the <video> element is only mounted
            // once phase === 'streaming'. Attaching the stream is handled by the
            // effect below, which runs AFTER the video element renders.
            setPhase('streaming');
        } catch (err) {
            const e = err as DOMException;
            if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
                setPhase('denied');
            } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
                setPhase('error');
                setErrMsg('No camera detected on this device.');
            } else {
                setPhase('error');
                setErrMsg(e?.message || 'Could not start the camera.');
            }
        }
    }, []);

    // Attach the live stream once the <video> element is actually in the DOM.
    // This fixes the "black video" bug: setting srcObject during the 'requesting'
    // phase did nothing because the element hadn't rendered yet.
    useEffect(() => {
        if (phase !== 'streaming') return;
        const video = videoRef.current;
        const stream = streamRef.current;
        if (!video || !stream) return;
        video.srcObject = stream;
        video.play().catch(() => { /* autoplay may need the muted attr — it's set */ });
    }, [phase]);

    useEffect(() => {
        startStream();
        return () => {
            stopStream();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSnap = useCallback(() => {
        const video = videoRef.current;
        if (!video || video.readyState < 2) return;

        // Scale to maxDimension on the long edge, preserve aspect.
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return;
        const scale = Math.min(1, maxDimension / Math.max(vw, vh));
        const w = Math.round(vw * scale);
        const h = Math.round(vh * scale);

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, w, h);

        canvas.toBlob((blob) => {
            if (!blob) return;
            setPendingBlob(blob);
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);
            setPhase('previewing');
            // Free the camera while previewing — re-acquired only on retake.
            stopStream();
        }, 'image/jpeg', quality);
    }, [maxDimension, quality, stopStream]);

    const handleRetake = useCallback(() => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPendingBlob(null);
        startStream();
    }, [previewUrl, startStream]);

    const handleAccept = useCallback(() => {
        if (!pendingBlob) return;
        onCapture(pendingBlob);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPendingBlob(null);
    }, [pendingBlob, onCapture, previewUrl]);

    const handleCancel = useCallback(() => {
        stopStream();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPendingBlob(null);
        onCancel?.();
    }, [stopStream, previewUrl, onCancel]);

    return (
        <div className="live-camera">
            {phase === 'requesting' && (
                <div className="live-camera__status">Requesting camera access…</div>
            )}

            {phase === 'denied' && (
                <div className="live-camera__status live-camera__status--error">
                    <p>Camera access was blocked. Allow camera in your browser settings, then retry.</p>
                    <div className="live-camera__actions">
                        <button type="button" className="btn btn-primary" onClick={startStream}>Retry</button>
                        {onCancel && (
                            <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                        )}
                    </div>
                </div>
            )}

            {phase === 'error' && (
                <div className="live-camera__status live-camera__status--error">
                    <p>{errMsg}</p>
                    <div className="live-camera__actions">
                        <button type="button" className="btn btn-primary" onClick={startStream}>Retry</button>
                        {onCancel && (
                            <button type="button" className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                        )}
                    </div>
                </div>
            )}

            {(phase === 'streaming' || phase === 'previewing') && (
                <>
                    <div className="live-camera__viewport">
                        {phase === 'streaming' ? (
                            <video
                                ref={videoRef}
                                playsInline
                                muted
                                className="live-camera__video"
                            />
                        ) : (
                            previewUrl && (
                                <img
                                    src={previewUrl}
                                    alt="Captured preview"
                                    className="live-camera__preview"
                                />
                            )
                        )}
                    </div>
                    <div className="live-camera__actions">
                        {phase === 'streaming' && (
                            <>
                                <button type="button" className="btn btn-primary" onClick={handleSnap}>
                                    Capture
                                </button>
                                {onCancel && (
                                    <button type="button" className="btn btn-secondary" onClick={handleCancel}>
                                        Cancel
                                    </button>
                                )}
                            </>
                        )}
                        {phase === 'previewing' && (
                            <>
                                <button type="button" className="btn btn-primary" onClick={handleAccept}>
                                    Use this photo
                                </button>
                                <button type="button" className="btn btn-secondary" onClick={handleRetake}>
                                    Retake
                                </button>
                            </>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}

export default LiveCameraCapture;
