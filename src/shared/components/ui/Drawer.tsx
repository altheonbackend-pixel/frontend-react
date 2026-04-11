import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useFocusTrap } from './useFocusTrap';
import { useBodyScrollLock } from './useBodyScrollLock';
import './Drawer.css';

export type DrawerSize = 'sm' | 'md' | 'lg';

export interface DrawerProps {
    open: boolean;
    onClose: () => void;
    title?: ReactNode;
    size?: DrawerSize;
    side?: 'right' | 'left';
    dismissOnBackdrop?: 'never' | 'always' | 'confirm';
    dismissOnEscape?: boolean;
    dirty?: boolean;
    footer?: ReactNode;
    ariaLabel?: string;
    children: ReactNode;
}

const Drawer = ({
    open,
    onClose,
    title,
    size = 'md',
    side = 'right',
    dismissOnBackdrop = 'confirm',
    dismissOnEscape = true,
    dirty = false,
    footer,
    ariaLabel,
    children,
}: DrawerProps) => {
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
        <div className="ui-drawer-overlay" onMouseDown={attemptClose}>
            <aside
                ref={containerRef}
                className={`ui-drawer ui-drawer--${size} ui-drawer--${side}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleId : undefined}
                aria-label={!title ? ariaLabel : undefined}
                tabIndex={-1}
                onMouseDown={e => e.stopPropagation()}
            >
                {title && (
                    <header className="ui-drawer__header">
                        <h2 id={titleId} className="ui-drawer__title">{title}</h2>
                        <button
                            type="button"
                            className="ui-drawer__close"
                            onClick={attemptClose}
                            aria-label={t('common.close')}
                        >
                            ✕
                        </button>
                    </header>
                )}
                <div className="ui-drawer__body">{children}</div>
                {footer && <footer className="ui-drawer__footer">{footer}</footer>}
            </aside>
        </div>,
        document.body,
    );
};

export default Drawer;
