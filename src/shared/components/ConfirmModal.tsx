import React from 'react';
import './ConfirmModal.css';

interface ConfirmModalProps {
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ message, onConfirm, onCancel }) => {
    return (
        <div className="confirm-modal-overlay" onClick={onCancel}>
            <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                <p className="confirm-modal-message">{message}</p>
                <div className="confirm-modal-actions">
                    <button className="action-button delete-button" onClick={onConfirm}>
                        Confirmer
                    </button>
                    <button className="action-button cancel-button" onClick={onCancel}>
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmModal;
