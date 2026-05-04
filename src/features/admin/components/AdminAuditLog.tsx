import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../../shared/services/api';

interface AuditEntry {
    id: number;
    actor_name: string | null;
    action: string;
    action_display: string;
    target_model: string;
    target_id: string;
    description: string;
    ip_address: string | null;
    timestamp: string;
}

interface Doctor { id: number; full_name: string }

const ACTION_CHOICES = [
    { value: '', label: 'All actions' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'patient_create', label: 'Patient Created' },
    { value: 'patient_update', label: 'Patient Updated' },
    { value: 'patient_delete', label: 'Patient Deleted' },
    { value: 'patient_view', label: 'Patient Record Viewed' },
    { value: 'consultation_create', label: 'Consultation Created' },
    { value: 'consultation_update', label: 'Consultation Updated' },
    { value: 'consultation_view', label: 'Consultation Viewed' },
    { value: 'referral_create', label: 'Referral Created' },
    { value: 'referral_respond', label: 'Referral Responded' },
    { value: 'document_upload', label: 'Document Uploaded' },
    { value: 'document_download', label: 'Document Downloaded' },
    { value: 'lab_result_view', label: 'Lab Result Viewed' },
    { value: 'prescription_view', label: 'Prescription Viewed' },
    { value: 'gdpr_erasure', label: 'GDPR Erasure Request' },
    { value: 'admin_access_level_change', label: 'Access Level Changed' },
    { value: 'admin_doctor_deactivated', label: 'Doctor Deactivated' },
    { value: 'admin_doctor_activated', label: 'Doctor Activated' },
    { value: 'other', label: 'Other' },
];

function formatTimestamp(value: string) {
    return new Date(value).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function AdminAuditLog() {
    const [filters, setFilters] = useState({ doctor: '', action: '', target: '', date_from: '', date_to: '' });
    const [applied, setApplied] = useState(filters);

    const { data: doctors = [] } = useQuery<Doctor[]>({
        queryKey: ['admin', 'doctors-list'],
        queryFn: () => api.get('/admin/doctors/', { params: { status: 'active', limit: 500 } }).then(r =>
            (r.data.results ?? r.data).map((d: any) => ({ id: d.id, full_name: d.full_name }))
        ),
        staleTime: 5 * 60_000,
    });

    const params: Record<string, string> = {};
    if (applied.doctor) params.doctor = applied.doctor;
    if (applied.action) params.action = applied.action;
    if (applied.target) params.target = applied.target;
    if (applied.date_from) params.date_from = applied.date_from;
    if (applied.date_to) params.date_to = applied.date_to;

    const { data: entries = [], isLoading, isError } = useQuery<AuditEntry[]>({
        queryKey: ['admin', 'audit', applied],
        queryFn: () => api.get('/admin/audit-log/', { params }).then(r => r.data.results ?? r.data),
        staleTime: 30_000,
    });

    const th: React.CSSProperties = { padding: '0.5rem 0.75rem', color: 'var(--text-muted)', fontWeight: 600, textAlign: 'left', whiteSpace: 'nowrap' };
    const td: React.CSSProperties = { padding: '0.625rem 0.75rem', verticalAlign: 'top' };

    return (
        <div style={{ padding: '28px 32px', width: '100%', boxSizing: 'border-box' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Audit Log</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Full system audit trail — filter by doctor, patient, action, or date range.
                </p>
            </div>

            {/* Filters */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '10px', padding: '1rem 1.25rem', marginBottom: '1.25rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 180px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Doctor</label>
                    <select
                        className="select-input"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={filters.doctor}
                        onChange={e => setFilters(p => ({ ...p, doctor: e.target.value }))}
                    >
                        <option value="">All doctors</option>
                        {doctors.map(d => <option key={d.id} value={d.id}>{d.full_name}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 180px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Action</label>
                    <select
                        className="select-input"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={filters.action}
                        onChange={e => setFilters(p => ({ ...p, action: e.target.value }))}
                    >
                        {ACTION_CHOICES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '1 1 150px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Patient ID / Target</label>
                    <input
                        type="text"
                        className="input"
                        style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        placeholder="UUID or ID"
                        value={filters.target}
                        onChange={e => setFilters(p => ({ ...p, target: e.target.value }))}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '0 0 auto' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>From</label>
                    <input type="date" className="input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={filters.date_from} onChange={e => setFilters(p => ({ ...p, date_from: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: '0 0 auto' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>To</label>
                    <input type="date" className="input" style={{ padding: '0.4rem 0.6rem', fontSize: '0.85rem' }}
                        value={filters.date_to} onChange={e => setFilters(p => ({ ...p, date_to: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setApplied(filters)}>Apply</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => {
                        const empty = { doctor: '', action: '', target: '', date_from: '', date_to: '' };
                        setFilters(empty);
                        setApplied(empty);
                    }}>Clear</button>
                </div>
            </div>

            {/* Table */}
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '10px', overflow: 'hidden' }}>
                {isLoading && <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>Loading…</div>}
                {isError && <div style={{ padding: '2rem', color: 'var(--color-danger, #dc2626)' }}>Failed to load audit log.</div>}
                {!isLoading && !isError && entries.length === 0 && (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No audit entries match these filters.</div>
                )}
                {!isLoading && !isError && entries.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-subtle)' }}>
                                    <th style={th}>Timestamp</th>
                                    <th style={th}>Actor</th>
                                    <th style={th}>Action</th>
                                    <th style={th}>Target</th>
                                    <th style={th}>Details</th>
                                    <th style={th}>IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, i) => (
                                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-subtle)', background: i % 2 === 0 ? 'var(--bg-base)' : 'var(--bg-subtle)' }}>
                                        <td style={{ ...td, whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{formatTimestamp(entry.timestamp)}</td>
                                        <td style={{ ...td, fontWeight: 600 }}>{entry.actor_name ?? <span style={{ color: 'var(--text-muted)' }}>System</span>}</td>
                                        <td style={td}>
                                            <span style={{
                                                display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600,
                                                background: entry.action.startsWith('admin_') ? '#fef3c7' : '#eff6ff',
                                                color: entry.action.startsWith('admin_') ? '#92400e' : '#1e40af',
                                            }}>
                                                {entry.action_display}
                                            </span>
                                        </td>
                                        <td style={{ ...td, color: 'var(--text-secondary)' }}>
                                            {entry.target_model && <span>{entry.target_model}{entry.target_id && <span style={{ color: 'var(--text-muted)' }}> #{entry.target_id.slice(0, 8)}</span>}</span>}
                                        </td>
                                        <td style={{ ...td, color: 'var(--text-secondary)', maxWidth: '280px' }}>{entry.description || '—'}</td>
                                        <td style={{ ...td, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{entry.ip_address || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
