import React from 'react';
import { useTranslation } from 'react-i18next';
import './ConfirmModal.css';

interface ConfirmModalProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmLabel?: string;
    cancelLabel?: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel, confirmLabel, cancelLabel }) => {
    const { t } = useTranslation();
    return (
        <div className="confirm-modal-overlay" onClick={onCancel}>
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                <p className="confirm-modal-message">{message}</p>
                <div className="confirm-modal-actions">
                    <button className="action-button delete-button" onClick={onConfirm}>
                        {confirmLabel ?? t('common.confirm')}
                    </button>
                    <button className="action-button cancel-button" onClick={onCancel}>
                        {cancelLabel ?? t('common.cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
