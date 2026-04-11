import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from './Modal';
import './Dialog.css';

export type DialogTone = 'info' | 'warning' | 'danger';

export interface DialogProps {
    open: boolean;
    onClose: () => void;
    onConfirm: (reason?: string) => void | Promise<void>;
    title: ReactNode;
    message?: ReactNode;
    tone?: DialogTone;
    confirmLabel?: string;
    cancelLabel?: string;
    /** If set, shows a textarea. `requireReason` makes it mandatory. */
    reasonLabel?: string;
    reasonPlaceholder?: string;
    requireReason?: boolean;
}

const Dialog = ({
    open,
    onClose,
    onConfirm,
    title,
    message,
    tone = 'info',
    confirmLabel,
    cancelLabel,
    reasonLabel,
    reasonPlaceholder,
    requireReason = false,
}: DialogProps) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const close = () => {
        if (submitting) return;
        setReason('');
        onClose();
    };

    const confirm = async () => {
        if (requireReason && !reason.trim()) return;
        setSubmitting(true);
        try {
            await onConfirm(reasonLabel ? reason.trim() : undefined);
            setReason('');
        } finally {
            setSubmitting(false);
        }
    };

    const confirmDisabled = submitting || (requireReason && !reason.trim());

    return (
        <Modal
            open={open}
            onClose={close}
            title={title}
            size="sm"
            dismissOnBackdrop="always"
            footer={
                <>
                    <button
                        type="button"
                        className="ui-dialog__btn ui-dialog__btn--cancel"
                        onClick={close}
                        disabled={submitting}
                    >
                        {cancelLabel ?? t('common.cancel')}
                    </button>
                    <button
                        type="button"
                        className={`ui-dialog__btn ui-dialog__btn--confirm ui-dialog__btn--${tone}`}
                        onClick={confirm}
                        disabled={confirmDisabled}
                    >
                        {submitting ? t('common.loading') : (confirmLabel ?? t('common.confirm'))}
                    </button>
                </>
            }
        >
            {message && <p className="ui-dialog__message">{message}</p>}
            {reasonLabel && (
                <div className="ui-dialog__field">
                    <label className="ui-dialog__label">
                        {reasonLabel}{requireReason && <span className="ui-dialog__required"> *</span>}
                    </label>
                    <textarea
                        className="ui-dialog__textarea"
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        placeholder={reasonPlaceholder}
                        rows={3}
                    />
                </div>
            )}
        </Modal>
    );
};

export default Dialog;
