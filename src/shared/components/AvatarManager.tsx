// src/shared/components/AvatarManager.tsx
//
// Reusable "manage my profile photo" block for settings screens.
//   - mode="camera" → live camera only (doctors, by policy).
//   - mode="both"   → camera OR device upload (patients).
//
// The parent supplies the async upload/remove handlers (which call the right
// endpoint); this component owns the capture UI + busy/error state and shows
// the current avatar with an initials fallback.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Avatar from './Avatar';
import LiveCameraCapture from './LiveCameraCapture';
import AvatarPicker from './AvatarPicker';

interface Props {
    name: string;
    currentUrl?: string | null;
    mode: 'camera' | 'both';
    onUpload: (file: Blob) => Promise<void>;
    onRemove: () => Promise<void>;
}

export function AvatarManager({ name, currentUrl, mode, onUpload, onRemove }: Props) {
    const { t } = useTranslation();
    const [capturing, setCapturing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const handlePicked = async (blob: Blob) => {
        setCapturing(false);
        setError('');
        setBusy(true);
        try {
            await onUpload(blob);
        } catch {
            setError(t('settings.avatar.upload_error'));
        } finally {
            setBusy(false);
        }
    };

    const handleRemove = async () => {
        setError('');
        setBusy(true);
        try {
            await onRemove();
        } catch {
            setError(t('settings.avatar.remove_error'));
        } finally {
            setBusy(false);
        }
    };

    if (capturing) {
        return (
            <div className="avatar-manager">
                {mode === 'camera' ? (
                    <LiveCameraCapture onCapture={handlePicked} onCancel={() => setCapturing(false)} />
                ) : (
                    <AvatarPicker onPick={(blob) => handlePicked(blob)} onCancel={() => setCapturing(false)} />
                )}
            </div>
        );
    }

    return (
        <div className="avatar-manager">
            <Avatar name={name} src={currentUrl} size="xl" ring />
            <div className="avatar-manager__actions">
                <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setError(''); setCapturing(true); }}
                    disabled={busy}
                >
                    {busy
                        ? t('common.saving')
                        : currentUrl
                            ? t('settings.avatar.change')
                            : t('settings.avatar.add')}
                </button>
                {currentUrl && (
                    <button
                        type="button"
                        className="btn btn-text btn-sm"
                        onClick={handleRemove}
                        disabled={busy}
                    >
                        {t('common.remove')}
                    </button>
                )}
            </div>
            {mode === 'camera' && (
                <p className="avatar-manager__hint">{t('settings.avatar.camera_only_hint')}</p>
            )}
            {error && <p className="error-message">{error}</p>}
        </div>
    );
}

export default AvatarManager;
