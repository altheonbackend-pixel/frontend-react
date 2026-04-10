import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import type { Notification } from '../types';
import './NotificationBell.css';

const POLL_INTERVAL = 30_000; // 30 seconds

const NotificationBell = () => {
    const [unread, setUnread] = useState(0);
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const navigate = useNavigate();

    const fetchCount = useCallback(async () => {
        try {
            const res = await api.get('/notifications/unread-count/');
            setUnread(res.data.unread_count);
        } catch { /* silently fail */ }
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/notifications/');
            const items: Notification[] = res.data.results ?? res.data;
            setNotifications(items);
            setUnread(items.filter((n: Notification) => !n.is_read).length);
        } catch { /* silently fail */ }
        finally { setLoading(false); }
    }, []);

    // Poll unread count
    useEffect(() => {
        fetchCount();
        const id = setInterval(fetchCount, POLL_INTERVAL);
        return () => clearInterval(id);
    }, [fetchCount]);

    // Close on outside click
    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    const handleOpen = () => {
        setOpen(o => !o);
        if (!open) fetchAll();
    };

    const markAll = async () => {
        await api.post('/notifications/mark-read/');
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnread(0);
    };

    const handleClick = async (n: Notification) => {
        if (!n.is_read) {
            await api.post(`/notifications/${n.id}/mark-read/`);
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, is_read: true } : x));
            setUnread(prev => Math.max(0, prev - 1));
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
        <div className="notif-bell-wrapper" ref={drawerRef}>
            <button className="notif-bell-btn" onClick={handleOpen} aria-label="Notifications">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                {unread > 0 && (
                    <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>
                )}
            </button>

            {open && (
                <div className="notif-drawer">
                    <div className="notif-drawer__header">
                        <span className="notif-drawer__title">Notifications</span>
                        {unread > 0 && (
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
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
