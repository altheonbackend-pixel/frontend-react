import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { usePatientPortal } from '../context/PatientPortalContext';
import { patientPortalService } from '../services/patientPortalService';
import type { PatientNotification } from '../services/patientPortalService';
import '../../../shared/components/NotificationBell.css';

export function PatientNotificationBell() {
    const { unreadCount, invalidateUnreadCount } = usePatientPortal();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<PatientNotification[]>([]);
    const [loading, setLoading] = useState(false);
    const [dropPos, setDropPos] = useState({ top: 0, left: 0 });
    const bellRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const items = await patientPortalService.getNotifications();
            setNotifications(items);
        } catch { /* silently fail */ }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                drawerRef.current && !drawerRef.current.contains(target) &&
                bellRef.current && !bellRef.current.contains(target)
            ) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [open]);

    const handleOpen = () => {
        const next = !open;
        if (next && bellRef.current) {
            const rect = bellRef.current.getBoundingClientRect();
            const left = Math.min(rect.left, window.innerWidth - 348);
            setDropPos({ top: rect.bottom + 8, left });
        }
        setOpen(next);
        if (next) fetchAll();
    };

    const markAll = async () => {
        await patientPortalService.markAllNotificationsRead();
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        invalidateUnreadCount();
    };

    const handleClick = async (n: PatientNotification) => {
        if (!n.is_read) {
            await patientPortalService.markNotificationRead(n.id);
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
            invalidateUnreadCount();
        }
        setOpen(false);
        if (n.link) navigate(n.link);
    };

    const timeAgo = (iso: string) => {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'just now';
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div className="notif-bell-wrapper">
            <button ref={bellRef} className="notif-bell-btn" onClick={handleOpen} aria-label="Notifications">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unreadCount > 0 && (
                    <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
                )}
            </button>

            {open && createPortal(
                <div
                    ref={drawerRef}
                    className="notif-drawer"
                    style={{ top: dropPos.top, left: dropPos.left }}
                    role="dialog"
                    aria-label="Notifications"
                >
                    <div className="notif-drawer__header">
                        <span className="notif-drawer__title">Notifications</span>
                        {unreadCount > 0 && (
                            <button className="notif-mark-all" onClick={markAll}>
                                Mark all read
                            </button>
                        )}
                    </div>
                    <div className="notif-drawer__body">
                        {loading && <p className="notif-empty">Loading…</p>}
                        {!loading && notifications.length === 0 && (
                            <p className="notif-empty">No notifications yet.</p>
                        )}
                        {!loading && notifications.map(n => (
                            <div
                                key={n.id}
                                className={`notif-item${n.is_read ? '' : ' notif-item--unread'}`}
                                onClick={() => handleClick(n)}
                            >
                                <div className="notif-item__title">{n.title}</div>
                                {n.body && <div className="notif-item__body">{n.body}</div>}
                                <div className="notif-item__time">{timeAgo(n.created_at)}</div>
                            </div>
                        ))}
                    </div>
                    <div className="notif-drawer__footer">
                        <button
                            className="notif-view-all"
                            onClick={() => { setOpen(false); navigate('/patient/notifications'); }}
                        >
                            View all notifications →
                        </button>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
}

export default PatientNotificationBell;
