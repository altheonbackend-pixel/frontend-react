# Altheon Connect — Feature-Based Architecture Restructuring

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Problems with Previous Structure](#problems-with-previous-structure)
3. [Solution: Feature-Based Architecture](#solution-feature-based-architecture)
4. [New Folder Structure](#new-folder-structure)
5. [Centralized Configuration — Before vs After](#centralized-configuration)
6. [Backend Enterprise Setup](#backend-enterprise-setup)
7. [Migration Details](#migration-details)

---

## 1. Executive Summary

The Altheon Connect medical platform has been restructured from a **flat monolithic** layout to a **feature-based modular** architecture. This applies to both the **React/TypeScript frontend** and the **Django/DRF backend**.

**Key outcomes:**
- 11 feature modules (auth, patients, appointments, consultations, procedures, clinics, referrals, forum, notes, profile, statistics)
- Centralized API configuration (eliminates 20+ hardcoded URLs)
- Shared service layer with axios interceptors
- Each feature owns its components, services, and types
- Backend split from 1 monolithic app into 11 focused Django apps
- Enterprise-grade backend: `config/` with split settings (base/dev/prod), `apps/` directory, environment files, split requirements

---

## 2. Problems with Previous Structure

### 2.1 Frontend Problems

| # | Problem | Severity | Details |
|---|---------|----------|---------|
| 1 | **Flat component folder** | HIGH | 35+ files dumped in `src/components/` with no grouping. Finding files required searching through an alphabetical list. |
| 2 | **Hardcoded API URLs everywhere** | CRITICAL | `http://127.0.0.1:8000/api` was hardcoded in 20+ component files (Patients.tsx, Appointments.tsx, Register.tsx, Clinics.tsx, etc.). Changing the API URL required editing every file. |
| 3 | **No service layer** | HIGH | Each component made its own `axios.get/post` calls with manual header setup. No reusable API abstraction. |
| 4 | **Scattered error handling** | MEDIUM | Error handling patterns (token check, 401/403 handling, error messages) were duplicated across every component. |
| 5 | **config.tsx not actually used** | HIGH | `config.tsx` exported `BASE_URL` and `API_ENDPOINTS`, but components ignored it and used hardcoded URLs instead. |
| 6 | **Single types.tsx** | MEDIUM | All 15+ interfaces in one file. No domain separation — auth types mixed with stats types mixed with patient types. |
| 7 | **CSS file sprawl** | MEDIUM | 14 CSS files in `components/` folder. Some were empty (AddPatient.css, Patients.css, Statistics.css). Shared styles duplicated. |
| 8 | **api.tsx utility barely used** | HIGH | `src/utils/api.tsx` defined `fetchProtectedData()` but had its own hardcoded URL and was only used by Statistics_Globale.tsx. |

### 2.2 Backend Problems

| # | Problem | Severity | Details |
|---|---------|----------|---------|
| 1 | **Single monolithic app** | HIGH | `auth_app` contained ALL 12 models, ALL views, ALL serializers, ALL URLs. The app name "auth_app" was misleading — it handled patients, appointments, forum, notes, etc. |
| 2 | **Single models.py (~180 lines)** | MEDIUM | 12 models (RegistrationCode, Doctor, Patient, Workplace, Appointment, Consultation, MedicalProcedure, Referral, ForumPost, ForumComment, DeletedAppointment, Note) crammed into one file. |
| 3 | **Single views.py (~300 lines)** | MEDIUM | 20+ view classes in one file mixing authentication, CRUD, and analytics logic. |
| 4 | **Single serializers.py (~280 lines)** | MEDIUM | 15+ serializer classes with no domain separation. |
| 5 | **Single urls.py** | LOW | All URL patterns in one file — auth routes mixed with CRUD routes mixed with stats routes. |
| 6 | **No code reuse across domains** | MEDIUM | Permission classes, base models, and utility functions all bundled together. |
| 7 | **Monolithic settings.py** | HIGH | Single `settings.py` with no dev/prod separation. Secret key hardcoded. DEBUG toggled manually. No `.env` file. |
| 8 | **Apps scattered at root level** | MEDIUM | 11 Django apps dumped alongside `manage.py`, `db.sqlite3`, and unrelated folders (`mon_projet_kivy/`, `altheon-frontend/`). No grouping. |
| 9 | **Single requirements.txt** | LOW | Dev-only and prod-only deps mixed. No way to install a lightweight dev environment vs production with gunicorn/whitenoise. |
| 10 | **No .gitignore** | LOW | No `.gitignore` for the backend — `.env`, `db.sqlite3`, `__pycache__/`, `.venv/` not excluded. |

### 2.3 Centralized Config Problem (Detailed)

**BEFORE — The config was DEFINED but NEVER USED:**

```
// src/config.tsx — Existed but was ignored
export const BASE_URL = import.meta.env.PROD 
    ? 'https://backend-django-el3o.onrender.com' 
    : 'http://127.0.0.1:8000';
```

Meanwhile in components:
```
// Patients.tsx — hardcoded
await axios.get('http://127.0.0.1:8000/api/doctors/me/patients/', ...);

// Register.tsx — hardcoded
const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Appointments.tsx — hardcoded
const API_BASE_URL = 'http://127.0.0.1:8000/api';

// AuthContext.tsx — hardcoded  
const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Clinics.tsx — hardcoded
await axios.get('http://127.0.0.1:8000/api/workplaces/', ...);

// ConsultationForm.tsx — hardcoded
const API_BASE_URL = 'http://127.0.0.1:8000/api';

// ... 15+ more files with the same hardcoded URL
```

**Impact:** Deploying to production required finding and editing every single file. Easy to miss one, causing mixed dev/prod API calls.

---

## 3. Solution: Feature-Based Architecture

### 3.1 Core Principles

1. **Feature isolation** — Each domain (patients, appointments, etc.) is a self-contained module with its own components, services, and types.
2. **Centralized API layer** — One axios instance configured in `shared/services/api.ts`. All API calls go through it. URL defined once.
3. **Shared resources** — Common UI (Header, PdfViewer), shared styles, and reusable hooks live in `shared/`.
4. **Co-located types** — Each feature defines its own TypeScript interfaces. Shared types remain in `shared/types.ts`.
5. **Service layer per feature** — Each feature has a `services/` folder with typed API functions. Components never call axios directly.

### 3.2 Centralized Config Solution (Detailed)

**AFTER — Single source of truth:**

```typescript
// src/config.ts — THE ONLY place the API URL is defined
export const BASE_URL = import.meta.env.PROD 
    ? 'https://backend-django-el3o.onrender.com' 
    : 'http://127.0.0.1:8000';

export const API_BASE_URL = `${BASE_URL}/api`;
```

```typescript
// src/shared/services/api.ts — Central axios instance
import axios from 'axios';
import { API_BASE_URL } from '../../config';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' }
});

// Interceptors handle auth token + 401/403 automatically
api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

export default api;
```

```typescript
// Feature service — uses central api, no hardcoded URLs
// src/features/patients/services/patientService.ts
import api from '../../../shared/services/api';

export const getMyPatients = () => api.get('/doctors/me/patients/');
export const getPatient = (id: string) => api.get(`/patients/${id}/`);
export const deletePatient = (id: string) => api.delete(`/patients/${id}/`);
```

**Result:** Changing the API URL means editing ONE file (`config.ts`). Zero risk of mixed environments.

---

## 4. New Folder Structure

### 4.1 Frontend Structure

```
frontend-react/src/
├── config.ts                          # API URL (single source of truth)
├── i18n.ts                            # i18next config
├── translations.ts                    # FR/EN strings  
├── main.tsx                           # React root
├── index.css                          # Global reset styles
│
├── app/                               # App shell
│   ├── App.tsx                        # Routes definition
│   └── App.css                        # App-level styles
│
├── features/
│   ├── auth/                          
│   │   ├── components/
│   │   │   ├── Login.tsx
│   │   │   ├── Register.tsx
│   │   │   └── LandingPage.tsx
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── hooks/
│   │   │   └── useAuth.ts
│   │   ├── services/
│   │   │   └── authService.ts
│   │   ├── styles/
│   │   │   └── Auth.css
│   │   └── types.ts
│   │
│   ├── patients/
│   │   ├── components/
│   │   │   ├── Patients.tsx
│   │   │   ├── PatientDetail.tsx
│   │   │   ├── PatientForm.tsx
│   │   │   ├── AddPatient.tsx
│   │   │   └── EditPatientPage.tsx
│   │   ├── services/
│   │   │   └── patientService.ts
│   │   └── types.ts
│   │
│   ├── appointments/
│   │   ├── components/
│   │   │   ├── Appointments.tsx
│   │   │   ├── AppointmentForm.tsx
│   │   │   ├── DeleteAppointmentModal.tsx
│   │   │   └── DeletedAppointments.tsx
│   │   ├── services/
│   │   │   └── appointmentService.ts
│   │   ├── styles/
│   │   │   ├── Appointments.css
│   │   │   └── AppointmentForm.css
│   │   └── types.ts
│   │
│   ├── consultations/
│   │   ├── components/
│   │   │   └── ConsultationForm.tsx
│   │   ├── services/
│   │   │   └── consultationService.ts
│   │   ├── styles/
│   │   │   └── ConsultationForm.css
│   │   └── types.ts
│   │
│   ├── procedures/
│   │   ├── components/
│   │   │   └── MedicalProcedureForm.tsx
│   │   ├── services/
│   │   │   └── procedureService.ts
│   │   └── types.ts
│   │
│   ├── clinics/
│   │   ├── components/
│   │   │   ├── Clinics.tsx
│   │   │   ├── ClinicDetail.tsx
│   │   │   ├── ClinicForm.tsx
│   │   │   └── ClinicEditForm.tsx
│   │   ├── services/
│   │   │   └── clinicService.ts
│   │   └── types.ts
│   │
│   ├── referrals/
│   │   ├── components/
│   │   │   ├── ReferralForm.tsx
│   │   │   └── ReferralsList.tsx
│   │   ├── services/
│   │   │   └── referralService.ts
│   │   └── types.ts
│   │
│   ├── forum/
│   │   ├── components/
│   │   │   └── Forum.tsx
│   │   ├── services/
│   │   │   └── forumService.ts
│   │   └── types.ts
│   │
│   ├── notes/
│   │   ├── components/
│   │   │   └── Notes.tsx
│   │   ├── services/
│   │   │   └── noteService.ts
│   │   └── types.ts
│   │
│   ├── profile/
│   │   ├── components/
│   │   │   ├── Profile.tsx
│   │   │   └── EditProfile.tsx
│   │   ├── services/
│   │   │   └── profileService.ts
│   │   └── types.ts
│   │
│   └── statistics/
│       ├── components/
│       │   ├── Statistics.tsx
│       │   └── StatisticsGlobale.tsx
│       ├── services/
│       │   └── statsService.ts
│       ├── styles/
│       │   └── Statistics.css
│       └── types.ts
│
└── shared/
    ├── components/
    │   ├── Header.tsx
    │   ├── HomescreenHeader.tsx
    │   ├── PdfViewer.tsx
    │   └── PrivateRoutes.tsx
    ├── services/
    │   └── api.ts                     # Central axios instance
    ├── styles/
    │   ├── Header.css
    │   ├── HomescreenHeader.css
    │   ├── PdfViewer.css
    │   ├── Dashboard.css
    │   ├── FormStyles.css
    │   ├── ListStyles.css
    │   ├── DetailStyles.css
    │   └── TextStyles.css
    └── types.ts                       # Shared interfaces (User, DoctorProfile, etc.)
```

### 4.2 Backend Structure

```
backend-django/
├── manage.py                          # Updated: DJANGO_SETTINGS_MODULE='config.settings'
├── .env                               # Environment variables (gitignored)
├── .env.example                       # Template for team onboarding
├── .gitignore                         # Python/Django/IDE exclusions
├── db.sqlite3                         # SQLite database
│
├── config/                            # Project configuration (enterprise-standard)
│   ├── __init__.py
│   ├── settings/
│   │   ├── __init__.py                # Auto-detects DJANGO_ENV (development|production)
│   │   ├── base.py                    # Shared settings (apps, middleware, DRF, JWT, DB)
│   │   ├── development.py             # DEBUG=True, CORS_ALLOW_ALL, no compression
│   │   └── production.py              # Security headers, HTTPS cookies, WhiteNoise
│   ├── urls.py                        # Root URL routing with grouped api_v1_patterns
│   ├── wsgi.py                        # WSGI entrypoint (Gunicorn)
│   └── asgi.py                        # ASGI entrypoint
│
├── apps/                              # All domain apps grouped under one directory
│   ├── __init__.py
│   │
│   ├── core/                          # Shared utilities
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── permissions.py             # IsDoctor, IsCreator
│   │   └── utils.py                   # Admin group helper
│   │
│   ├── accounts/                      # Auth + Doctor profiles
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # RegistrationCode, Doctor
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── patients/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # Patient (UUID PK)
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── appointments/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # Appointment, DeletedAppointment
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── consultations/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # Consultation (vitals tracking)
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── clinics/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # Workplace
│   │   ├── serializers.py
│   │   ├── views.py                   # WorkplaceViewSet + statistics action
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── procedures/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # MedicalProcedure
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── referrals/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # Referral
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── forum/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # ForumPost, ForumComment
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   ├── notes/
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── models.py                  # Note
│   │   ├── serializers.py
│   │   ├── views.py
│   │   ├── urls.py
│   │   └── migrations/
│   │
│   └── stats/                         # Renamed from statistics (Python stdlib conflict)
│       ├── __init__.py
│       ├── apps.py
│       ├── models.py
│       ├── serializers.py             # GlobalStatsSerializer
│       ├── views.py                   # DoctorStats, GlobalStats
│       ├── urls.py
│       └── migrations/
│
├── requirements/
│   ├── base.txt                       # Core dependencies
│   ├── development.txt                # -r base.txt (dev tools)
│   └── production.txt                 # -r base.txt + gunicorn, whitenoise
│
├── media/                             # File uploads (procedure attachments, etc.)
│   └── procedure_attachments/
│
└── staticfiles/                       # Collected static files (gitignored, .gitkeep)
    └── .gitkeep
```
---

## 5. Centralized Configuration — Before vs After

### Frontend Config Flow

| Aspect | BEFORE | AFTER |
|--------|--------|-------|
| API URL definition | Hardcoded in 20+ files | Single `config.ts` |
| Axios instance | Created per-request in components | Shared instance in `shared/services/api.ts` |
| Auth token header | Manually set in each component | Auto-injected via request interceptor |
| Error handling (401/403) | Duplicated in each component | Centralized response interceptor |
| Feature API calls | `axios.get('http://127.0.0.1:8000/api/patients/')` | `patientService.getMyPatients()` |
| Environment switching | Edit 20+ files | Edit `config.ts` (or set env var) |

### Backend Config Flow

| Aspect | BEFORE | AFTER |
|--------|--------|-------|
| App structure | 1 monolithic `auth_app` | 11 focused apps inside `apps/` directory |
| Models location | 12 models in 1 file | 1-2 models per app |
| URL routing | All in `auth_app/urls.py` | Per-app `urls.py`, grouped in `config/urls.py` via `api_v1_patterns` |
| Permissions | In `auth_app/permissions.py` | Shared in `apps/core/permissions.py` |
| Admin | 3 models registered in 1 admin.py | Per-app admin registration |
| Settings | Single `telemedicine_project/settings.py` | `config/settings/` with `base.py`, `development.py`, `production.py` |
| Environment | Hardcoded secrets, manual DEBUG toggle | `.env` file with `DJANGO_ENV` auto-detection |
| Requirements | Single `requirements.txt` | `requirements/base.txt`, `development.txt`, `production.txt` |
| Project layout | Apps scattered at root level | Clean root: `config/`, `apps/`, `requirements/`, `media/`, `staticfiles/` |

---

## 6. Backend Enterprise Setup

### 6.1 Split Settings

The settings module auto-detects the environment via `DJANGO_ENV`:

```python
# config/settings/__init__.py
import os
environment = os.environ.get('DJANGO_ENV', 'development')

if environment == 'production':
    from .production import *
else:
    from .development import *
```

| File | Purpose |
|------|---------|
| `base.py` | Shared config: INSTALLED_APPS, MIDDLEWARE, DRF, JWT, DB, templates, static/media paths |
| `development.py` | `DEBUG=True`, `CORS_ALLOW_ALL_ORIGINS=True`, no static compression, fallback SECRET_KEY |
| `production.py` | `DEBUG=False`, HTTPS cookies, XSS/content-type headers, WhiteNoise compression, required `SECRET_KEY` from env |

### 6.2 Apps Directory with sys.path

All 11 apps live under `apps/`. The `apps/` directory is added to `sys.path` in `base.py`, `manage.py`, `wsgi.py`, and `asgi.py`:

```python
# config/settings/base.py
APPS_DIR = BASE_DIR / 'apps'
if str(APPS_DIR) not in sys.path:
    sys.path.insert(0, str(APPS_DIR))
```

This means all imports remain clean — no `apps.` prefix needed:
```python
from accounts.models import Doctor      # ✅ works as before
from core.permissions import IsDoctor   # ✅ works as before
```

### 6.3 Environment Files

```bash
# .env (gitignored — local secrets)
DJANGO_ENV=development
SECRET_KEY=django-insecure-...
DEBUG=True

# .env.example (committed — template for team)
DJANGO_ENV=development          # development | production
SECRET_KEY=your-secret-key-here
CORS_ALLOWED_ORIGINS=http://localhost:5173
```

### 6.4 Split Requirements

```bash
pip install -r requirements/development.txt   # Dev: core deps only
pip install -r requirements/production.txt     # Prod: + gunicorn + whitenoise
```

| File | Contains |
|------|----------|
| `base.txt` | Django, DRF, SimpleJWT, CORS, Pillow, requests, reportlab, python-docx |
| `development.txt` | `-r base.txt` (extends base) |
| `production.txt` | `-r base.txt` + gunicorn + whitenoise |

### 6.5 URL Grouping for Future Versioning

```python
# config/urls.py
api_v1_patterns = [
    path('', include('accounts.urls')),
    path('', include('patients.urls')),
    # ... all app URLs grouped
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(api_v1_patterns)),    # Ready for path('api/v2/', ...) later
]
```

---

## 7. Migration Details

### 7.1 Database Migration Strategy

The backend restructuring moves models to new apps. Django tracks models by `app_label.ModelName`. To preserve existing data:

1. New apps use `class Meta: db_table = 'auth_app_modelname'` to point to existing tables
2. No actual database migration is needed — tables stay as-is
3. Future migrations are created per-app

### 7.2 Frontend Migration Strategy

1. Files moved from `src/components/` to `src/features/<feature>/components/`
2. CSS files moved to appropriate `styles/` folders
3. All hardcoded `http://127.0.0.1:8000/api` replaced with centralized `api` import
4. Import paths updated in all files
5. New `services/` layer created per feature

### 7.3 API Endpoints (Unchanged)

All API endpoints remain identical — no backend URL changes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/login/` | POST | User login |
| `/api/token/refresh/` | POST | JWT refresh |
| `/api/register/doctor/` | POST | Doctor registration |
| `/api/profile/` | GET | Doctor profile |
| `/api/profile/update/` | PUT/PATCH | Update profile |
| `/api/patients/` | CRUD | Patient management |
| `/api/doctors/me/patients/` | GET | Doctor's patients |
| `/api/appointments/` | CRUD | Appointments |
| `/api/appointments/deleted/` | GET | Deleted appointments |
| `/api/consultations/` | CRUD | Consultations |
| `/api/medical-procedures/` | CRUD | Medical procedures |
| `/api/referrals/` | CRUD | Referrals |
| `/api/workplaces/` | CRUD | Clinics/workplaces |
| `/api/notes/` | CRUD | Doctor notes |
| `/api/forum/posts/` | CRUD | Forum posts |
| `/api/forum/comments/` | CRUD | Forum comments |
| `/api/doctors/stats/` | GET | Doctor statistics |
| `/api/doctors/patients/stats/` | GET | Patient statistics |
| `/api/stats/global/` | GET | Global statistics |

---

*Document generated: March 2026*
*Architecture: Feature-Based Modular*
*Status: Implemented*
