// src/shared/components/AvatarPicker.tsx
//
// Avatar source picker for PATIENTS (live camera OR pick from device).
// Doctors use <LiveCameraCapture /> directly — no device upload is offered.
//
// Contract:
//   - Calls `onPick(blob, source)` when the user finalizes a choice.
//     `source` is 'camera' | 'device' (mainly for analytics / logs).
//   - Calls `onCancel()` if provided.
//   - Client-side file rejection mirrors the server's avatar rules (image
//     MIME + size cap). Server still validates regardless.

import { useRef, useState } from 'react';
import LiveCameraCapture from './LiveCameraCapture';

interface Props {
    onPick: (file: Blob, source: 'camera' | 'device') => void;
    onCancel?: () => void;
    /** Client-side size cap in bytes (default 8 MB, matches server AVATAR_MAX_UPLOAD_BYTES). */
    maxBytes?: number;
}

type Mode = 'choose' | 'camera';

const ALLOWED_MIME_PREFIX = 'image/';
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

export function AvatarPicker({ onPick, onCancel, maxBytes = DEFAULT_MAX_BYTES }: Props) {
    const [mode, setMode] = useState<Mode>('choose');
    const [error, setError] = useState<string>('');
    const fileInput = useRef<HTMLInputElement | null>(null);

    const handleFile = (file: File | undefined) => {
        setError('');
        if (!file) return;
        if (!file.type.startsWith(ALLOWED_MIME_PREFIX)) {
            setError('Please choose an image file.');
            return;
        }
        if (file.size > maxBytes) {
            const mb = Math.round(maxBytes / (1024 * 1024));
            setError(`Image is too large. Maximum size is ${mb} MB.`);
            return;
        }
        onPick(file, 'device');
    };

    if (mode === 'camera') {
        return (
            <LiveCameraCapture
                onCapture={(blob) => onPick(blob, 'camera')}
                onCancel={() => setMode('choose')}
            />
        );
    }

    return (
        <div className="avatar-picker">
            <p className="avatar-picker__intro">Add a profile photo</p>
            <div className="avatar-picker__choices">
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => { setError(''); setMode('camera'); }}
                >
                    Use camera
                </button>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fileInput.current?.click()}
                >
                    Upload from device
                </button>
            </div>
            <input
                ref={fileInput}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])}
            />
            {error && <p className="error-message" style={{ marginTop: '0.75rem' }}>{error}</p>}
            {onCancel && (
                <div className="avatar-picker__actions">
                    <button type="button" className="btn btn-text" onClick={onCancel}>Cancel</button>
                </div>
            )}
        </div>
    );
}

export default AvatarPicker;
