// src/features/auth/components/Landing.tsx
// Marketing landing page — first impression for doctors & patients.

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Logo from '../../../shared/components/Logo';
import { useGeoLanguageDetect } from '../hooks/useGeoLanguageDetect';
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

type LegalDoc = 'privacy' | 'terms' | 'cookies';

const Landing = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);
    const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);

    // Auto-pick FR for francophone IPs / browser locales on first visit
    useGeoLanguageDetect();

    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    const scrollToId = (id: string) => {
        setMenuOpen(false);
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const switchLang = (lang: 'en' | 'fr') => {
        i18n.changeLanguage(lang);
    };
    const currentLang: 'en' | 'fr' = i18n.resolvedLanguage?.startsWith('fr') ? 'fr' : 'en';

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
                    <Link to="/" className="landing-nav-brand" aria-label={t('brand.full', 'Altheon Connect')}>
                        <Logo size="md" />
                    </Link>

                    <nav className={`landing-nav-links${menuOpen ? ' open' : ''}`}>
                        <button type="button" onClick={() => scrollToId('features')}>{t('landing_page.nav.features', 'Features')}</button>
                        <button type="button" onClick={() => scrollToId('how')}>{t('landing_page.nav.how', 'How it works')}</button>
                        <button type="button" onClick={() => scrollToId('audience')}>{t('landing_page.nav.for_you', 'For you')}</button>
                        <button type="button" onClick={() => scrollToId('security')}>{t('landing_page.nav.security', 'Security')}</button>
                    </nav>

                    <div className="landing-nav-cta">
                        <div className="landing-lang-toggle" role="group" aria-label={t('landing_page.lang.aria', 'Language')}>
                            <button
                                type="button"
                                className={`landing-lang-btn${currentLang === 'en' ? ' active' : ''}`}
                                onClick={() => switchLang('en')}
                                aria-pressed={currentLang === 'en'}
                            >EN</button>
                            <button
                                type="button"
                                className={`landing-lang-btn${currentLang === 'fr' ? ' active' : ''}`}
                                onClick={() => switchLang('fr')}
                                aria-pressed={currentLang === 'fr'}
                            >FR</button>
                        </div>
                        <Link to="/patient/login" className="landing-btn landing-btn--ghost">{t('landing_page.nav.patient_login', 'Patient login')}</Link>
                        <Link to="/login" className="landing-btn landing-btn--primary">{t('landing_page.nav.doctor_login', 'Doctor login')}</Link>
                        <button
                            type="button"
                            className="landing-hamburger"
                            aria-label={t('landing_page.nav.toggle', 'Toggle navigation')}
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
                                {t('landing_page.hero.pill', 'Trusted by clinicians · HIPAA & GDPR ready')}
                            </span>
                        </Reveal>
                        <Reveal delay={80}>
                            <h1 className="landing-h1">
                                {t('landing_page.hero.title_pre', 'The clinical platform that')}
                                <span className="landing-gradient-text"> {t('landing_page.hero.title_emph', 'connects care')}</span>.
                            </h1>
                        </Reveal>
                        <Reveal delay={160}>
                            <p className="landing-lead">
                                {t('landing_page.hero.lead', 'One secure workspace for doctors and patients — records, appointments, referrals, and lab results in a single, beautifully designed flow.')}
                            </p>
                        </Reveal>
                        <Reveal delay={240}>
                            <div className="landing-hero-actions">
                                <button
                                    type="button"
                                    onClick={() => navigate('/login')}
                                    className="landing-btn landing-btn--primary landing-btn--lg"
                                >
                                    {t('landing_page.hero.cta_doctor', "I'm a doctor")}
                                    <ArrowIcon />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => navigate('/patient/login')}
                                    className="landing-btn landing-btn--outline landing-btn--lg"
                                >
                                    {t('landing_page.hero.cta_patient', "I'm a patient")}
                                    <ArrowIcon />
                                </button>
                            </div>
                        </Reveal>
                        <Reveal delay={320}>
                            <div className="landing-trust-row">
                                <div className="landing-trust">
                                    <strong>4.9/5</strong>
                                    <span>{t('landing_page.trust.rating', 'Clinician rating')}</span>
                                </div>
                                <div className="landing-trust">
                                    <strong>120k+</strong>
                                    <span>{t('landing_page.trust.records', 'Records managed')}</span>
                                </div>
                                <div className="landing-trust">
                                    <strong>99.99%</strong>
                                    <span>{t('landing_page.trust.uptime', 'Uptime')}</span>
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
                                    <div className="hero-card-title">{t('landing_page.hero.todays_schedule', "Today's schedule")}</div>
                                </div>
                                <div className="hero-card-body">
                                    <div className="hero-appt">
                                        <div className="hero-appt-time">09:00</div>
                                        <div className="hero-appt-meta">
                                            <strong>E. Laurent</strong>
                                            <span>{t('landing_page.hero.followup', 'Follow-up · 30 min')}</span>
                                        </div>
                                        <span className="hero-status hero-status--green">{t('landing_page.hero.confirmed', 'Confirmed')}</span>
                                    </div>
                                    <div className="hero-appt">
                                        <div className="hero-appt-time">10:30</div>
                                        <div className="hero-appt-meta">
                                            <strong>M. Okafor</strong>
                                            <span>{t('landing_page.hero.telehealth', 'Telehealth · 20 min')}</span>
                                        </div>
                                        <span className="hero-status hero-status--blue">{t('landing_page.hero.video', 'Video')}</span>
                                    </div>
                                    <div className="hero-appt">
                                        <div className="hero-appt-time">11:15</div>
                                        <div className="hero-appt-meta">
                                            <strong>R. Bianchi</strong>
                                            <span>{t('landing_page.hero.new_patient', 'New patient · 45 min')}</span>
                                        </div>
                                        <span className="hero-status hero-status--purple">{t('landing_page.hero.intake', 'Intake')}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="hero-card hero-card--floater hero-card--lab">
                                <div className="hero-lab-icon">
                                    <FlaskIcon />
                                </div>
                                <div>
                                    <div className="hero-lab-title">{t('landing_page.hero.lab_ready', 'Lab result ready')}</div>
                                    <div className="hero-lab-sub">{t('landing_page.hero.lab_sub', 'CBC · within range')}</div>
                                </div>
                                <span className="hero-status hero-status--green">{t('landing_page.hero.new', 'New')}</span>
                            </div>

                            <div className="hero-card hero-card--floater hero-card--rx">
                                <div className="hero-rx-icon">
                                    <PillIcon />
                                </div>
                                <div>
                                    <div className="hero-rx-title">{t('landing_page.hero.rx_sent', 'Prescription sent')}</div>
                                    <div className="hero-rx-sub">{t('landing_page.hero.rx_sub', 'Amoxicillin · 7 days')}</div>
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
            <section className="landing-ribbon" aria-label={t('landing_page.ribbon.aria', 'Trusted by')}>
                <div className="landing-container">
                    <Reveal>
                        <p className="landing-ribbon-label">{t('landing_page.ribbon.label', 'Trusted by clinics, hospitals & independent practices')}</p>
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
                            <span className="landing-eyebrow">{t('landing_page.features.eyebrow', 'Built for modern care')}</span>
                            <h2 className="landing-h2">{t('landing_page.features.title', 'Everything you need to run a practice — and feel cared for as a patient.')}</h2>
                            <p className="landing-section-sub">
                                {t('landing_page.features.sub', 'A single platform replacing scattered spreadsheets, paper notes, and patchwork tools.')}
                            </p>
                        </div>
                    </Reveal>

                    <div className="landing-features-grid">
                        {FEATURE_KEYS.map((key, i) => (
                            <Reveal key={key} delay={i * 70}>
                                <article className="feature-card">
                                    <div className="feature-icon" style={{ background: FEATURE_TINTS[key] }}>
                                        {FEATURE_ICONS[key]}
                                    </div>
                                    <h3>{t(`landing_page.features.${key}.title`)}</h3>
                                    <p>{t(`landing_page.features.${key}.body`)}</p>
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
                            <span className="landing-eyebrow">{t('landing_page.how.eyebrow', 'How it works')}</span>
                            <h2 className="landing-h2">{t('landing_page.how.title', 'From first sign-in to a finished visit — in minutes.')}</h2>
                        </div>
                    </Reveal>

                    <div className="landing-steps">
                        {[1, 2, 3].map((n, i) => (
                            <Reveal key={n} delay={i * 90}>
                                <div className="step">
                                    <div className="step-num">{String(n).padStart(2, '0')}</div>
                                    <h3>{t(`landing_page.how.step${n}.title`)}</h3>
                                    <p>{t(`landing_page.how.step${n}.body`)}</p>
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
                                <span className="audience-tag">{t('landing_page.audience.doctor_tag', 'For doctors')}</span>
                                <h3>{t('landing_page.audience.doctor_title', 'Spend less time on paperwork. More on patients.')}</h3>
                                <ul>
                                    <li><CheckIcon /> {t('landing_page.audience.doctor.p1', 'Smart scheduling & telehealth')}</li>
                                    <li><CheckIcon /> {t('landing_page.audience.doctor.p2', 'Structured notes with smart phrases')}</li>
                                    <li><CheckIcon /> {t('landing_page.audience.doctor.p3', 'Referrals & lab inbox in one place')}</li>
                                    <li><CheckIcon /> {t('landing_page.audience.doctor.p4', 'Analytics for your practice')}</li>
                                </ul>
                                <Link to="/login" className="landing-btn landing-btn--primary">
                                    {t('landing_page.nav.doctor_login', 'Doctor login')} <ArrowIcon />
                                </Link>
                                <p className="audience-sub">
                                    {t('landing_page.audience.doctor_sub_pre', 'New here?')} <Link to="/register">{t('landing_page.audience.doctor_sub_link', 'Create a clinical account')}</Link>
                                </p>
                            </article>
                        </Reveal>

                        <Reveal delay={120}>
                            <article className="audience-card audience-card--patient">
                                <span className="audience-tag audience-tag--alt">{t('landing_page.audience.patient_tag', 'For patients')}</span>
                                <h3>{t('landing_page.audience.patient_title', 'Your health, finally in one calm place.')}</h3>
                                <ul>
                                    <li><CheckIcon /> {t('landing_page.audience.patient.p1', 'Book & manage appointments')}</li>
                                    <li><CheckIcon /> {t('landing_page.audience.patient.p2', 'Visit summaries you can actually read')}</li>
                                    <li><CheckIcon /> {t('landing_page.audience.patient.p3', 'Medications, labs & conditions tracked')}</li>
                                    <li><CheckIcon /> {t('landing_page.audience.patient.p4', 'Secure messaging with your care team')}</li>
                                </ul>
                                <Link to="/patient/login" className="landing-btn landing-btn--outline">
                                    {t('landing_page.nav.patient_login', 'Patient login')} <ArrowIcon />
                                </Link>
                                <p className="audience-sub">
                                    {t('landing_page.audience.patient_sub_pre', 'New patient?')}{' '}
                                    <Link to="/patient/register">{t('landing_page.audience.patient_sub_link1', 'Create your account')}</Link>{' '}
                                    {t('landing_page.audience.patient_sub_or', 'or')}{' '}
                                    <Link to="/patient/claim">{t('landing_page.audience.patient_sub_link2', 'claim your record')}</Link>.
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
                            <span className="landing-eyebrow landing-eyebrow--light">{t('landing_page.security.eyebrow', 'Security & privacy')}</span>
                            <h2 className="landing-h2 landing-h2--light">
                                {t('landing_page.security.title', 'Compliance-grade by default. No shortcuts.')}
                            </h2>
                            <p className="landing-section-sub landing-section-sub--light">
                                {t('landing_page.security.sub', 'End-to-end encrypted, audit-logged, and built with healthcare regulations in mind from day one.')}
                            </p>
                        </div>
                    </Reveal>
                    <div className="security-badges">
                        {BADGE_KEYS.map((key, i) => (
                            <Reveal key={key} delay={i * 80}>
                                <div className="badge-tile">
                                    <div className="badge-tile-icon">{BADGE_ICONS[key]}</div>
                                    <div>
                                        <strong>{t(`landing_page.security.${key}.title`)}</strong>
                                        <span>{t(`landing_page.security.${key}.body`)}</span>
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
                            <h2 className="landing-h2">{t('landing_page.final_cta.title', 'Ready to feel the difference?')}</h2>
                            <p>{t('landing_page.final_cta.sub', 'Pick your portal and sign in — your data, your patients, your peace of mind.')}</p>
                            <div className="landing-hero-actions landing-hero-actions--center">
                                <Link to="/login" className="landing-btn landing-btn--primary landing-btn--lg">
                                    {t('landing_page.nav.doctor_login', 'Doctor login')} <ArrowIcon />
                                </Link>
                                <Link to="/patient/login" className="landing-btn landing-btn--outline landing-btn--lg">
                                    {t('landing_page.nav.patient_login', 'Patient login')} <ArrowIcon />
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
                        <p>{t('landing_page.footer.tagline', 'The modern clinical platform — secure, connected, calm.')}</p>
                    </div>
                    <div className="landing-footer-cols">
                        <div>
                            <strong>{t('landing_page.footer.product', 'Product')}</strong>
                            <button type="button" onClick={() => scrollToId('features')}>{t('landing_page.nav.features', 'Features')}</button>
                            <button type="button" onClick={() => scrollToId('how')}>{t('landing_page.nav.how', 'How it works')}</button>
                            <button type="button" onClick={() => scrollToId('security')}>{t('landing_page.nav.security', 'Security')}</button>
                        </div>
                        <div>
                            <strong>{t('landing_page.footer.access', 'Access')}</strong>
                            <Link to="/login">{t('landing_page.nav.doctor_login', 'Doctor login')}</Link>
                            <Link to="/patient/login">{t('landing_page.nav.patient_login', 'Patient login')}</Link>
                            <Link to="/register">{t('landing_page.footer.create_clinical', 'Create clinical account')}</Link>
                        </div>
                        <div>
                            <strong>{t('landing_page.footer.legal', 'Legal')}</strong>
                            <button type="button" onClick={() => setLegalDoc('privacy')}>{t('landing_page.footer.privacy', 'Privacy')}</button>
                            <button type="button" onClick={() => setLegalDoc('terms')}>{t('landing_page.footer.terms', 'Terms')}</button>
                            <button type="button" onClick={() => setLegalDoc('cookies')}>{t('landing_page.footer.cookies', 'Cookies')}</button>
                        </div>
                    </div>
                </div>
                <div className="landing-footer-base">
                    <span>{t('landing_page.footer.copy', '© {{year}} Altheon Connect. All rights reserved.', { year: new Date().getFullYear() })}</span>
                </div>
            </footer>

            {legalDoc && (
                <LegalModal
                    doc={legalDoc}
                    title={t(`landing_page.legal.${legalDoc}.title`)}
                    body={t(`landing_page.legal.${legalDoc}.body`)}
                    closeLabel={t('landing_page.legal.close', 'Close')}
                    onClose={() => setLegalDoc(null)}
                />
            )}
        </div>
    );
};

/* ── Legal modal ── */
const LegalModal = ({
    doc,
    title,
    body,
    closeLabel,
    onClose,
}: {
    doc: LegalDoc;
    title: string;
    body: string;
    closeLabel: string;
    onClose: () => void;
}) => {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [onClose]);

    return (
        <div className="legal-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby={`legal-${doc}-title`}>
            <div className="legal-modal" onClick={e => e.stopPropagation()}>
                <div className="legal-modal-head">
                    <h2 id={`legal-${doc}-title`}>{title}</h2>
                    <button type="button" className="legal-modal-close" onClick={onClose} aria-label={closeLabel}>×</button>
                </div>
                <div className="legal-modal-body">
                    {body.split('\n\n').map((para, i) => (
                        <p key={i}>{para}</p>
                    ))}
                </div>
                <div className="legal-modal-foot">
                    <button type="button" className="landing-btn landing-btn--primary" onClick={onClose}>{closeLabel}</button>
                </div>
            </div>
        </div>
    );
};

/* ── Icons ── */
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

const FEATURE_KEYS = ['records', 'scheduling', 'referrals', 'labs', 'rx', 'portal'] as const;
type FeatureKey = typeof FEATURE_KEYS[number];

const FEATURE_TINTS: Record<FeatureKey, string> = {
    records:    'rgba(99,102,241,0.10)',
    scheduling: 'rgba(34,211,238,0.14)',
    referrals:  'rgba(236,72,153,0.12)',
    labs:       'rgba(16,185,129,0.12)',
    rx:         'rgba(245,158,11,0.14)',
    portal:     'rgba(139,92,246,0.14)',
};

const FEATURE_ICONS: Record<FeatureKey, React.ReactNode> = {
    records:    featureIcon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></>),
    scheduling: featureIcon(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>),
    referrals:  featureIcon(<><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></>),
    labs:       featureIcon(<><path d="M9 2v6L4 18a2 2 0 0 0 2 3h12a2 2 0 0 0 2-3L15 8V2"/><line x1="9" y1="2" x2="15" y2="2"/></>),
    rx:         featureIcon(<><rect x="2" y="9" width="20" height="6" rx="3"/><line x1="12" y1="9" x2="12" y2="15"/></>),
    portal:     featureIcon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
};

const BADGE_KEYS = ['enc', 'compliance', 'audit', 'rbac'] as const;
type BadgeKey = typeof BADGE_KEYS[number];

const BADGE_ICONS: Record<BadgeKey, React.ReactNode> = {
    enc:        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
    compliance: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    audit:      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    rbac:       <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
};

export default Landing;
