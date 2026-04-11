import { useEffect, useId, type ReactNode } from 'react';
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
            if (!window.confirm(t('common.discard_changes'))) return;
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
        </div>,
        document.body,
    );
};

export default Modal;
