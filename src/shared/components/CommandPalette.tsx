// CR-P4-10 + CR-P2-12: Global Cmd+K / Ctrl+K search palette.
//
// Opens with Cmd/Ctrl+K from anywhere. Searches patients, appointments,
// and consultations live (debounced 200ms). Also includes built-in
// "quick actions" like "+ New Patient" so power users can navigate
// without using the mouse.
//
// Keyboard contract:
//   Cmd/Ctrl+K  — toggle palette
//   ↑ / ↓        — move selection
//   Enter        — open selected result
//   Esc          — close

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

interface ResultItem {
    kind: 'patient' | 'appointment' | 'consultation' | 'action';
    id: string;
    label: string;
    subtitle?: string;
    url: string;
    icon?: string;
}

const QUICK_ACTIONS: ResultItem[] = [
    { kind: 'action', id: 'new-patient', label: '+ New patient',          url: '/patients/add',     icon: '👤' },
    { kind: 'action', id: 'new-appt',    label: '+ New appointment',     url: '/appointments',     icon: '📅' },
    { kind: 'action', id: 'new-ref',     label: '+ New referral',         url: '/referrals',        icon: '↗' },
    { kind: 'action', id: 'all-pats',    label: 'View all patients',      url: '/patients',         icon: '🏥' },
    { kind: 'action', id: 'all-labs',    label: 'View pending lab reviews', url: '/lab-results',    icon: '🧪' },
    { kind: 'action', id: 'dashboard',   label: 'Go to dashboard',        url: '/dashboard',        icon: '⌂' },
    { kind: 'action', id: 'profile',     label: 'My profile',             url: '/profile',          icon: '⚙' },
];

export function CommandPalette() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<ResultItem[]>(QUICK_ACTIONS);
    const [highlight, setHighlight] = useState(0);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Cmd/Ctrl+K global shortcut.
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                setOpen(o => !o);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // Reset state on close, focus input on open.
    useEffect(() => {
        if (open) {
            setTerm('');
            setResults(QUICK_ACTIONS);
            setHighlight(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [open]);

    // Debounced backend search.
    useEffect(() => {
        if (!open) return;
        if (!term || term.length < 2) {
            setResults(QUICK_ACTIONS.filter(a =>
                !term || a.label.toLowerCase().includes(term.toLowerCase())
            ));
            return;
        }
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(async () => {
            setLoading(true);
            try {
                const res = await api.get('/search/', { params: { q: term, limit: 6 } });
                const found: ResultItem[] = (res.data.results || []).map((r: ResultItem) => ({
                    ...r,
                    icon: r.kind === 'patient' ? '👤'
                        : r.kind === 'appointment' ? '📅'
                        : r.kind === 'consultation' ? '📝' : '•',
                }));
                const actions = QUICK_ACTIONS.filter(a => a.label.toLowerCase().includes(term.toLowerCase()));
                setResults([...found, ...actions]);
                setHighlight(0);
            } catch {
                setResults([]);
            } finally {
                setLoading(false);
            }
        }, 200);
        return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, [term, open]);

    const select = (item: ResultItem) => {
        setOpen(false);
        navigate(item.url);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => Math.min(h + 1, results.length - 1)); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => Math.max(h - 1, 0)); }
        else if (e.key === 'Enter' && results[highlight]) { e.preventDefault(); select(results[highlight]); }
        else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); }
    };

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-label={t('cmdk.aria_label', 'Quick search')}
            onClick={() => setOpen(false)}
            style={{
                position: 'fixed', inset: 0, zIndex: 9000,
                background: 'rgba(15,23,42,0.45)',
                display: 'flex', justifyContent: 'center',
                paddingTop: '12vh',
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: 'min(640px, 92vw)', maxHeight: '70vh',
                    background: 'var(--bg-elevated, white)',
                    borderRadius: 'var(--radius-md, 12px)',
                    boxShadow: 'var(--shadow-xl, 0 16px 48px rgba(0,0,0,0.2))',
                    display: 'flex', flexDirection: 'column', overflow: 'hidden',
                }}
            >
                <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderBottom: '1px solid var(--border-default, #e5e7eb)',
                }}>
                    <span style={{ color: 'var(--text-muted, #6b7280)' }}>🔎</span>
                    <input
                        ref={inputRef}
                        type="text"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={t('cmdk.placeholder', 'Search patients, appointments, consultations…  (Cmd+K)')}
                        style={{
                            border: 'none', outline: 'none', flex: 1,
                            fontSize: '1rem', background: 'transparent',
                            color: 'var(--text-primary)',
                        }}
                        aria-autocomplete="list"
                    />
                    {loading && <small style={{ color: 'var(--text-muted)' }}>{t('common.loading', 'Loading…')}</small>}
                </div>
                <ul
                    role="listbox"
                    style={{
                        listStyle: 'none', margin: 0, padding: 0,
                        overflowY: 'auto', maxHeight: '50vh',
                    }}
                >
                    {results.length === 0 && (
                        <li style={{ padding: '1.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                            {t('cmdk.no_results', 'No matching results')}
                        </li>
                    )}
                    {results.map((r, idx) => (
                        <li
                            key={`${r.kind}-${r.id}`}
                            role="option"
                            aria-selected={idx === highlight}
                            onMouseEnter={() => setHighlight(idx)}
                            onClick={() => select(r)}
                            style={{
                                padding: '0.6rem 1rem',
                                display: 'flex', gap: '0.75rem', alignItems: 'center',
                                cursor: 'pointer',
                                background: idx === highlight ? 'var(--accent-lighter, #F3F0FF)' : 'transparent',
                                borderLeft: idx === highlight ? '3px solid var(--accent, #6366F1)' : '3px solid transparent',
                            }}
                        >
                            <span style={{ fontSize: '1.1rem' }}>{r.icon}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    fontWeight: 500, color: 'var(--text-primary)',
                                }}>{r.label}</div>
                                {r.subtitle && (
                                    <div style={{
                                        fontSize: '0.75rem', color: 'var(--text-muted)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>{r.subtitle}</div>
                                )}
                            </div>
                            <small style={{
                                color: 'var(--text-muted)', textTransform: 'uppercase',
                                fontSize: '0.65rem', letterSpacing: '0.05em',
                            }}>{r.kind}</small>
                        </li>
                    ))}
                </ul>
                <div style={{
                    padding: '0.5rem 1rem',
                    borderTop: '1px solid var(--border-default, #e5e7eb)',
                    fontSize: '0.7rem', color: 'var(--text-muted)',
                    display: 'flex', justifyContent: 'space-between',
                }}>
                    <span>↑↓ {t('cmdk.navigate', 'navigate')} · Enter {t('cmdk.open', 'open')} · Esc {t('cmdk.close', 'close')}</span>
                    <span>Cmd/Ctrl+K</span>
                </div>
            </div>
        </div>
    );
}

export default CommandPalette;
