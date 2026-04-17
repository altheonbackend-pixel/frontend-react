import { useState, useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from './useFocusTrap';
import { useBodyScrollLock } from './useBodyScrollLock';
import './Modal.css';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    size?: ModalSize;
    /** `confirm` asks before closing when `dirty` is true. */
    dismissOnBackdrop?: 'never' | 'always' | 'confirm';
    dismissOnEscape?: boolean;
    dirty?: boolean;
    footer?: ReactNode;
    ariaLabel?: string;
    children: ReactNode;
}

const Modal = ({
    open,
    onClose,
    title,
    size = 'md',
    dismissOnBackdrop = 'confirm',
    dismissOnEscape = true,
    dirty = false,
    footer,
    ariaLabel,
    children,
}: ModalProps) => {
    const { t } = useTranslation();
    const titleId = useId();
    const containerRef = useFocusTrap<HTMLDivElement>(open);
    useBodyScrollLock(open);
    const [discardOpen, setDiscardOpen] = useState(false);

    useEffect(() => {
        if (!open || !dismissOnEscape) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                attemptClose();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, dismissOnEscape, dirty]);

    const attemptClose = () => {
        if (dismissOnBackdrop === 'never') return;
        if (dismissOnBackdrop === 'confirm' && dirty) {
            setDiscardOpen(true);
            return;
        }
        onClose();
    };

    if (!open) return null;

    return createPortal(
        <div className="ui-modal-overlay" onMouseDown={attemptClose}>
            <div
                ref={containerRef}
                className={`ui-modal ui-modal--${size}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-label={!title ? ariaLabel : undefined}
                tabIndex={-1}
                onMouseDown={e => e.stopPropagation()}
            >
                {title && (
                    <header className="ui-modal__header">
                        <h2 id={titleId} className="ui-modal__title">{title}</h2>
                        <button
                            type="button"
                            className="ui-modal__close"
                            onClick={attemptClose}
                            aria-label={t('common.close')}
                        >
                            ✕
                        </button>
                    </header>
                )}
                <div className="ui-modal__body">{children}</div>
                {footer && <footer className="ui-modal__footer">{footer}</footer>}
            </div>
            {discardOpen && (
                <div className="ui-discard-overlay" onMouseDown={e => e.stopPropagation()}>
                    <div className="ui-discard-dialog" role="alertdialog" aria-modal="true">
                        <p className="ui-discard-msg">{t('common.discard_changes')}</p>
                        <div className="ui-discard-actions">
                            <button type="button" className="ui-discard-btn ui-discard-btn--cancel" onClick={() => setDiscardOpen(false)}>
                                {t('common.cancel')}
                            </button>
                            <button type="button" className="ui-discard-btn ui-discard-btn--confirm" onClick={() => { setDiscardOpen(false); onClose(); }}>
                                {t('common.discard')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body,
    );
};

export default Modal;
