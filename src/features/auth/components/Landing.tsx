// src/features/auth/components/Landing.tsx
// Marketing landing page — first impression for doctors & patients.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Logo from '../../../shared/components/Logo';
import '../styles/Landing.css';

/** Lightweight in-view observer for scroll-reveal animations. */
function useReveal<T extends HTMLElement>(threshold = 0.15) {
    const ref = useRef<T | null>(null);
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            entries => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        setVisible(true);
                        io.disconnect();
                        break;
                    }
                }
            },
            { threshold },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [threshold]);
    return { ref, visible };
}

const Reveal = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
    const { ref, visible } = useReveal<HTMLDivElement>();
    return (
        <div
            ref={ref}
            className={`reveal${visible ? ' is-visible' : ''}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </div>
    );
};

const Landing = () => {
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollTo = (id: string) => {
        setMenuOpen(false);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="landing">
            {/* Animated background — soft gradient blobs */}
            <div className="landing-bg" aria-hidden="true">
                <span className="blob blob-1" />
                <span className="blob blob-2" />
                <span className="blob blob-3" />
                <span className="grid-overlay" />
            </div>

            {/* ── Nav ── */}
            <header className={`landing-nav${scrolled ? ' is-scrolled' : ''}`}>
                <div className="landing-container landing-nav-inner">
                    <Link to="/" className="landing-nav-brand" aria-label="Altheon Connect — home">
                        <Logo size="md" />
                    </Link>

                    <nav className={`landing-nav-links${menuOpen ? ' open' : ''}`}>
                        <button type="button" onClick={() => scrollTo('features')}>Features</button>
                        <button type="button" onClick={() => scrollTo('how')}>How it works</button>
                        <button type="button" onClick={() => scrollTo('audience')}>For you</button>
                        <button type="button" onClick={() => scrollTo('security')}>Security</button>
                    </nav>

                    <div className="landing-nav-cta">
                        <Link to="/patient/login" className="landing-btn landing-btn--ghost">Patient login</Link>
                        <Link to="/login" className="landing-btn landing-btn--primary">Doctor login</Link>
                        <button
                            type="button"
                            className="landing-hamburger"
                            aria-label="Toggle navigation"
                            aria-expanded={menuOpen}
                            onClick={() => setMenuOpen(o => !o)}
                        >
                            <span /><span /><span />
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Hero ── */}
            <section className="landing-hero">
                <div className="landing-container landing-hero-inner">
                    <div className="landing-hero-copy">
                        <Reveal>
                            <span className="landing-pill">
                                <span className="landing-pill-dot" />
                                Trusted by clinicians · HIPAA &amp; GDPR ready
                            </span>
                        </Reveal>
                        <Reveal delay={80}>
                            <h1 className="landing-h1">
                                The clinical platform that
                                <span className="landing-gradient-text"> connects care</span>.
                            </h1>
                        </Reveal>
                        <Reveal delay={160}>
                            <p className="landing-lead">
                                One secure workspace for doctors and patients — records, appointments,
                                referrals, and lab results in a single, beautifully designed flow.
                            </p>
                        </Reveal>
                        <Reveal delay={240}>
                            <div className="landing-hero-actions">
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="landing-btn landing-btn--primary landing-btn--lg"
                                >
                                    I'm a doctor
                                    <ArrowIcon />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/patient/login')}
                                    className="landing-btn landing-btn--outline landing-btn--lg"
                                >
                                    I'm a patient
                                    <ArrowIcon />
                                </button>
                            </div>
                        </Reveal>
                        <Reveal delay={320}>
                            <div className="landing-trust-row">
                                <div className="landing-trust">
                                    <strong>4.9/5</strong>
                                    <span>Clinician rating</span>
                                </div>
                                <div className="landing-trust">
                                    <strong>120k+</strong>
                                    <span>Records managed</span>
                                </div>
                                <div className="landing-trust">
                                    <strong>99.99%</strong>
                                    <span>Uptime</span>
                                </div>
                            </div>
                        </Reveal>
                    </div>

                    {/* Hero visual — floating dashboard preview */}
                    <Reveal delay={120}>
                        <div className="landing-hero-visual" aria-hidden="true">
                            <div className="hero-card hero-card--main">
                                <div className="hero-card-header">
                                    <div className="hero-card-dots">
                                        <span /><span /><span />
                                    </div>
                                    <div className="hero-card-title">Today's schedule</div>
                                </div>
                                <div className="hero-card-body">
                                    <div className="hero-appt">
                                        <div className="hero-appt-time">09:00</div>
                                        <div className="hero-appt-meta">
                                            <strong>E. Laurent</strong>
                                            <span>Follow-up · 30 min</span>
                                        </div>
                                        <span className="hero-status hero-status--green">Confirmed</span>
                                    </div>
                                    <div className="hero-appt">
                                        <div className="hero-appt-time">10:30</div>
                                        <div className="hero-appt-meta">
                                            <strong>M. Okafor</strong>
                                            <span>Telehealth · 20 min</span>
                                        </div>
                                        <span className="hero-status hero-status--blue">Video</span>
                                    </div>
                                    <div className="hero-appt">
                                        <div className="hero-appt-time">11:15</div>
                                        <div className="hero-appt-meta">
                                            <strong>R. Bianchi</strong>
                                            <span>New patient · 45 min</span>
                                        </div>
                                        <span className="hero-status hero-status--purple">Intake</span>
                                    </div>
                                </div>
                            </div>

                            <div className="hero-card hero-card--floater hero-card--lab">
                                <div className="hero-lab-icon">
                                    <FlaskIcon />
                                </div>
                                <div>
                                    <div className="hero-lab-title">Lab result ready</div>
                                    <div className="hero-lab-sub">CBC · within range</div>
                                </div>
                                <span className="hero-status hero-status--green">New</span>
                            </div>

                            <div className="hero-card hero-card--floater hero-card--rx">
                                <div className="hero-rx-icon">
                                    <PillIcon />
                                </div>
                                <div>
                                    <div className="hero-rx-title">Prescription sent</div>
                                    <div className="hero-rx-sub">Amoxicillin · 7 days</div>
                                </div>
                            </div>

                            <svg className="hero-pulse" viewBox="0 0 240 60" preserveAspectRatio="none" aria-hidden="true">
                                <polyline
                                    points="0,30 30,30 38,18 46,42 54,12 62,48 70,30 110,30 118,22 126,38 134,30 240,30"
                                    fill="none"
                                    stroke="url(#pulseGradient)"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                                <defs>
                                    <linearGradient id="pulseGradient" x1="0" y1="0" x2="1" y2="0">
                                        <stop offset="0%" stopColor="#22d3ee" />
                                        <stop offset="100%" stopColor="#6366F1" />
                                    </linearGradient>
                                </defs>
                            </svg>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── Social proof ribbon ── */}
            <section className="landing-ribbon" aria-label="Trusted by">
                <div className="landing-container">
                    <Reveal>
                        <p className="landing-ribbon-label">Trusted by clinics, hospitals &amp; independent practices</p>
                    </Reveal>
                    <div className="landing-ribbon-row">
                        {['Northgate Health', 'Saint-Maur Clinic', 'BlueHarbor Med', 'Vita Hospital', 'Lumen Care'].map((name, i) => (
                            <Reveal key={name} delay={i * 80}>
                                <span className="landing-logo-chip">{name}</span>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Features ── */}
            <section id="features" className="landing-section">
                <div className="landing-container">
                    <Reveal>
                        <div className="landing-section-head">
                            <span className="landing-eyebrow">Built for modern care</span>
                            <h2 className="landing-h2">Everything you need to run a practice — and feel cared for as a patient.</h2>
                            <p className="landing-section-sub">
                                A single platform replacing scattered spreadsheets, paper notes, and patchwork tools.
                            </p>
                        </div>
                    </Reveal>

                    <div className="landing-features-grid">
                        {FEATURES.map((f, i) => (
                            <Reveal key={f.title} delay={i * 70}>
                                <article className="feature-card">
                                    <div className="feature-icon" style={{ background: f.tint }}>
                                        {f.icon}
                                    </div>
                                    <h3>{f.title}</h3>
                                    <p>{f.body}</p>
                                </article>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── How it works ── */}
            <section id="how" className="landing-section landing-section--muted">
                <div className="landing-container">
                    <Reveal>
                        <div className="landing-section-head">
                            <span className="landing-eyebrow">How it works</span>
                            <h2 className="landing-h2">From first sign-in to a finished visit — in minutes.</h2>
                        </div>
                    </Reveal>

                    <div className="landing-steps">
                        {STEPS.map((s, i) => (
                            <Reveal key={s.title} delay={i * 90}>
                                <div className="step">
                                    <div className="step-num">{String(i + 1).padStart(2, '0')}</div>
                                    <h3>{s.title}</h3>
                                    <p>{s.body}</p>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Audience split (doctors vs patients) ── */}
            <section id="audience" className="landing-section">
                <div className="landing-container">
                    <div className="audience-grid">
                        <Reveal>
                            <article className="audience-card audience-card--doctor">
                                <span className="audience-tag">For doctors</span>
                                <h3>Spend less time on paperwork. More on patients.</h3>
                                <ul>
                                    <li><CheckIcon /> Smart scheduling &amp; telehealth</li>
                                    <li><CheckIcon /> Structured notes with smart phrases</li>
                                    <li><CheckIcon /> Referrals &amp; lab inbox in one place</li>
                                    <li><CheckIcon /> Analytics for your practice</li>
                                </ul>
                                <Link to="/login" className="landing-btn landing-btn--primary">
                                    Doctor login <ArrowIcon />
                                </Link>
                                <p className="audience-sub">
                                    New here? <Link to="/register">Create a clinical account</Link>
                                </p>
                            </article>
                        </Reveal>

                        <Reveal delay={120}>
                            <article className="audience-card audience-card--patient">
                                <span className="audience-tag audience-tag--alt">For patients</span>
                                <h3>Your health, finally in one calm place.</h3>
                                <ul>
                                    <li><CheckIcon /> Book &amp; manage appointments</li>
                                    <li><CheckIcon /> Visit summaries you can actually read</li>
                                    <li><CheckIcon /> Medications, labs &amp; conditions tracked</li>
                                    <li><CheckIcon /> Secure messaging with your care team</li>
                                </ul>
                                <Link to="/patient/login" className="landing-btn landing-btn--outline">
                                    Patient login <ArrowIcon />
                                </Link>
                                <p className="audience-sub">
                                    New patient? <Link to="/patient/register">Create your account</Link> or <Link to="/patient/claim">claim your record</Link>.
                                </p>
                            </article>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* ── Security ── */}
            <section id="security" className="landing-section landing-section--dark">
                <div className="landing-container security-grid">
                    <Reveal>
                        <div>
                            <span className="landing-eyebrow landing-eyebrow--light">Security &amp; privacy</span>
                            <h2 className="landing-h2 landing-h2--light">
                                Compliance-grade by default. No shortcuts.
                            </h2>
                            <p className="landing-section-sub landing-section-sub--light">
                                End-to-end encrypted, audit-logged, and built with healthcare regulations in mind from day one.
                            </p>
                        </div>
                    </Reveal>
                    <div className="security-badges">
                        {BADGES.map((b, i) => (
                            <Reveal key={b.title} delay={i * 80}>
                                <div className="badge-tile">
                                    <div className="badge-tile-icon">{b.icon}</div>
                                    <div>
                                        <strong>{b.title}</strong>
                                        <span>{b.body}</span>
                                    </div>
                                </div>
                            </Reveal>
                        ))}
                    </div>
                </div>
            </section>

            {/* ── Final CTA ── */}
            <section className="landing-section landing-cta-section">
                <div className="landing-container">
                    <Reveal>
                        <div className="landing-cta">
                            <h2 className="landing-h2">Ready to feel the difference?</h2>
                            <p>Pick your portal and sign in — your data, your patients, your peace of mind.</p>
                            <div className="landing-hero-actions landing-hero-actions--center">
                                <Link to="/login" className="landing-btn landing-btn--primary landing-btn--lg">
                                    Doctor login <ArrowIcon />
                                </Link>
                                <Link to="/patient/login" className="landing-btn landing-btn--outline landing-btn--lg">
                                    Patient login <ArrowIcon />
                                </Link>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ── Footer ── */}
            <footer className="landing-footer">
                <div className="landing-container landing-footer-inner">
                    <div className="landing-footer-brand">
                        <Logo size="md" />
                        <p>The modern clinical platform — secure, connected, calm.</p>
                    </div>
                    <div className="landing-footer-cols">
                        <div>
                            <strong>Product</strong>
                            <button type="button" onClick={() => scrollTo('features')}>Features</button>
                            <button type="button" onClick={() => scrollTo('how')}>How it works</button>
                            <button type="button" onClick={() => scrollTo('security')}>Security</button>
                        </div>
                        <div>
                            <strong>Access</strong>
                            <Link to="/login">Doctor login</Link>
                            <Link to="/patient/login">Patient login</Link>
                            <Link to="/register">Create clinical account</Link>
                        </div>
                        <div>
                            <strong>Legal</strong>
                            <span>Privacy</span>
                            <span>Terms</span>
                            <span>Cookies</span>
                        </div>
                    </div>
                </div>
                <div className="landing-footer-base">
                    <span>© {new Date().getFullYear()} Altheon Connect. All rights reserved.</span>
                </div>
            </footer>
        </div>
    );
};

/* ── Icons (inline so we don't depend on lucide) ── */
const ArrowIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);
const CheckIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
const FlaskIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L15 8V2" />
        <line x1="9" y1="2" x2="15" y2="2" />
    </svg>
);
const PillIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="9" width="20" height="6" rx="3" />
        <line x1="12" y1="9" x2="12" y2="15" />
    </svg>
);

const featureIcon = (path: React.ReactNode) => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {path}
    </svg>
);

const FEATURES = [
    {
        title: 'Unified patient records',
        body: 'A single, structured chart — history, allergies, conditions, labs and visits — that travels with the patient.',
        tint: 'rgba(99,102,241,0.10)',
        icon: featureIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></>),
    },
    {
        title: 'Smart scheduling',
        body: 'Conflict-free booking, telehealth links, and reminders that actually reduce no-shows.',
        tint: 'rgba(34,211,238,0.14)',
        icon: featureIcon(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
    },
    {
        title: 'Secure referrals',
        body: 'Send and receive referrals with full context — no more chasing PDFs across inboxes.',
        tint: 'rgba(236,72,153,0.12)',
        icon: featureIcon(<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>),
    },
    {
        title: 'Lab inbox',
        body: 'New results land in one inbox, flagged, sortable, and ready to share with the patient.',
        tint: 'rgba(16,185,129,0.12)',
        icon: featureIcon(<><path d="M9 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L15 8V2"/><line x1="9" y1="2" x2="15" y2="2"/></>),
    },
    {
        title: 'Prescriptions',
        body: 'Write, sign and send prescriptions with built-in interaction checks and reusable templates.',
        tint: 'rgba(245,158,11,0.14)',
        icon: featureIcon(<><rect x="2" y="9" width="20" height="6" rx="3"/><line x1="12" y1="9" x2="12" y2="15"/></>),
    },
    {
        title: 'Patient portal',
        body: 'Patients see their visits, medications and results — and book the next appointment themselves.',
        tint: 'rgba(139,92,246,0.14)',
        icon: featureIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
    },
];

const STEPS = [
    { title: 'Sign in to your portal', body: 'Doctors and patients each get a dedicated, secure workspace tailored to their role.' },
    { title: 'See everything at a glance', body: 'Today\'s schedule, your inbox, urgent labs and recent activity — surfaced where you need them.' },
    { title: 'Move care forward', body: 'Document a visit, send a referral, share a result. Every action is captured and audit-logged.' },
];

const BADGES = [
    {
        title: 'End-to-end encryption',
        body: 'Data is encrypted in transit and at rest with industry-standard ciphers.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    },
    {
        title: 'HIPAA & GDPR ready',
        body: 'Designed around healthcare regulation and data-protection best practices.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    },
    {
        title: 'Full audit trail',
        body: 'Every access and change is logged — accountability without effort.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
        title: 'Role-based access',
        body: 'Granular permissions ensure only the right eyes see each record.',
        icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    },
];

export default Landing;
