import { useState } from 'react';
import api from '../../../shared/services/api';
import { toast } from '../../../shared/components/ui';

export interface RxItem {
    medication_name: string;
    dosage: string;
    frequency: string;
    duration_days: number | null;
    consultation: number;
    patient: string;
}

interface Props {
    failed: RxItem[];
    onItemSaved: (item: RxItem) => void;
}

export const FailedPrescriptionsPanel = ({ failed, onItemSaved }: Props) => {
    const [retrying, setRetrying] = useState<Record<number, boolean>>({});

    if (failed.length === 0) return null;

    const retrySingle = async (item: RxItem, index: number) => {
        setRetrying(r => ({ ...r, [index]: true }));
        try {
            await api.post('/prescriptions/', item);
            onItemSaved(item);
            toast.success(`${item.medication_name} saved.`);
        } catch {
            toast.error(`${item.medication_name} still could not be saved. Check your connection.`);
        } finally {
            setRetrying(r => ({ ...r, [index]: false }));
        }
    };

    return (
        <div
            style={{
                border: '1.5px solid var(--color-danger)',
                borderRadius: 'var(--radius-lg, 12px)',
                marginTop: '16px',
                overflow: 'hidden',
            }}
        >
            <div
                style={{
                    padding: '12px 16px',
                    background: 'color-mix(in srgb, var(--color-danger) 8%, transparent)',
                    borderBottom: '1px solid color-mix(in srgb, var(--color-danger) 20%, transparent)',
                }}
            >
                <span style={{ fontWeight: 600, color: 'var(--color-danger)', fontSize: '14px' }}>
                    Unsaved prescriptions — action required
                </span>
            </div>
            <div style={{ padding: '12px 16px' }}>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px', marginTop: 0 }}>
                    These prescriptions were not saved. Retry now or re-enter them from the Medications tab.
                    Do not close this form until all medications are confirmed on record.
                </p>
                {failed.map((rx, i) => (
                    <div
                        key={i}
                        style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 0',
                            borderBottom: i < failed.length - 1 ? '0.5px solid var(--border-subtle, #e5e7eb)' : 'none',
                        }}
                    >
                        <span style={{ fontSize: '13px' }}>
                            {rx.medication_name}
                            {rx.dosage ? ` · ${rx.dosage}` : ''}
                            {rx.frequency ? ` · ${rx.frequency.replace(/_/g, ' ')}` : ''}
                            {rx.duration_days ? ` · ${rx.duration_days}d` : ''}
                        </span>
                        <button
                            type="button"
                            className="btn btn-sm btn-primary"
                            onClick={() => retrySingle(rx, i)}
                            disabled={retrying[i]}
                            style={{ flexShrink: 0, marginLeft: '12px' }}
                        >
                            {retrying[i] ? 'Saving...' : 'Retry'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
};
