# Altheon Connect — Frontend Styling Guide

> **Single rule:** All design decisions live in `src/index.css` as CSS custom properties.  
> Change a variable there — it ripples everywhere. Never hard-code a colour, size, or shadow anywhere else.

---

## Table of Contents

1. [File Map — what controls what](#1-file-map)
2. [Design Token Reference](#2-design-tokens)
3. [Responsive Cascade](#3-responsive-cascade)
4. [Adding a New Page](#4-adding-a-new-page)
5. [Button System](#5-button-system)
6. [Form System](#6-form-system)
7. [Loading States](#7-loading-states)
8. [Feedback Messages & Toasts](#8-feedback-messages--toasts)
9. [Admin Theme](#9-admin-theme)
10. [Animation Reference](#10-animation-reference)
11. [Common Mistakes to Avoid](#11-common-mistakes-to-avoid)

---

## 1. File Map

### Global (affects the whole app)

| File | What it controls |
|------|-----------------|
| `src/index.css` | **The design system.** All CSS variables, reset, global utilities, button system, input system, toast system. Touch this file to change the theme. |
| `src/app/App.css` | Minimal app-shell wrapper (`.App` flex column). Almost empty — don't add page styles here. |

### Shared components

| File | What it controls |
|------|-----------------|
| `src/shared/styles/Header.css` | Doctor navigation bar — logo, nav links, hamburger drawer (mobile), lang switcher, logout button. |
| `src/shared/styles/HomescreenHeader.css` | Landing page hero header — company name, slogan, glassmorphic card. |
| `src/shared/styles/Dashboard.css` | Doctor dashboard page — stat cards, nav buttons, patient stats table. |
| `src/shared/styles/DetailStyles.css` | Patient detail page + Clinic detail page — shared entry cards, info groups, action buttons, clinic stat grid. |
| `src/shared/styles/ListStyles.css` | Shared list-page layout used by Patients and Clinics — search bar, grid containers. |
| `src/shared/styles/TextStyles.css` | Long-form text pages — Forum, Notes. Page header, content sections, quote blocks, section footers. |
| `src/shared/styles/FormStyles.css` | **All modal forms** (Consultation, Appointment, Referral, Procedure, Clinic). Overlay, glass card, form groups, actions row, cancel/submit buttons. |
| `src/shared/styles/PdfViewer.css` | PDF viewer modal. |
| `src/shared/components/ConfirmModal.css` | Delete-confirmation modal. |
| `src/shared/components/AccessLevelRoute.css` | Access-level gate screen (shown when a Level-1 doctor hits a Level-2 route). |
| `src/shared/components/PageLoader.css` | ECG loading animation — used on every page while data fetches. |

### Feature-specific

| File | What it controls |
|------|-----------------|
| `src/features/auth/styles/Auth.css` | Login / Register page — page wrapper, form card, inputs, submit button. |
| `src/features/appointments/styles/Appointments.css` | Appointments page — calendar widget overrides, appointment cards, action buttons. |
| `src/features/appointments/styles/AppointmentForm.css` | Appointment modal form (extends FormStyles). |
| `src/features/clinics/styles/ClinicsList.css` | Clinics list grid — clinic cards, status badges, action footer. Also contains `.clinic-stats-grid` (used in ClinicDetail). |
| `src/features/consultations/styles/ConsultationForm.css` | Consultation modal form — vitals two-column grid. |
| `src/features/patients/styles/PatientsList.css` | Patients list grid — patient cards, search input, header buttons. |
| `src/features/referrals/styles/ReferralsList.css` | Referrals list grid — referral cards, urgency colours, field layout. |
| `src/features/statistics/styles/Statistics.css` | Global statistics page — sortable tables, stat cards, search bar. |
| `src/features/admin/styles/AdminHeader.css` | Admin navigation bar — deep violet theme, 2-row mobile layout. Defines `--admin-*` variables. |
| `src/features/admin/styles/AdminDashboard.css` | Admin dashboard stat cards grid. |
| `src/features/admin/styles/AdminDoctorList.css` | Admin doctor management table — desktop table + mobile card layout at ≤640px. |

---

## 2. Design Tokens

All tokens are defined in `src/index.css` inside `:root { }`.

### Colours

```css
/* Backgrounds */
--bg-base:       #FFFFFF        /* page / card surface */
--bg-glass:      rgba(255,255,255,0.85)  /* glassmorphic card */
--bg-subtle:     #FAFAFA        /* alternate row, page bg */
--bg-muted:      #EEF2FF        /* table headers, card footers (soft indigo) */

/* Text */
--text-primary:  #1A1A1A
--text-secondary:#636E72
--text-muted:    #636E72
--text-inverse:  #FFFFFF        /* text on dark/accent backgrounds */

/* Brand accent — indigo */
--accent:        #6366F1
--accent-hover:  #4F46E5
--accent-light:  #E0E7FF
--accent-lighter:#F3F0FF        /* hover bg, tag backgrounds */

/* Semantic */
--color-success / --color-success-light / --color-success-dark
--color-warning / --color-warning-light / --color-warning-dark
--color-danger  / --color-danger-light  / --color-danger-dark
--color-info    / --color-info-light    / --color-info-dark
```

**To change the brand colour:** update `--accent` and `--accent-hover` in `:root`. Everything (buttons, focus rings, borders, shadows) inherits from it automatically.

### Typography

```css
--font-body: 'Inter', system-ui, sans-serif

/* Scale */
--text-xs:   0.75rem   /* 12px — labels, badges, table headers */
--text-sm:   0.875rem  /* 14px — body copy, card content */
--text-base: 1rem      /* 16px — default body */
--text-lg:   1.125rem  /* 18px — card titles */
--text-xl:   1.25rem   /* 20px — section headings */
--text-2xl:  1.5rem    /* 24px — mobile h1 */
--text-3xl:  1.875rem  /* 30px — desktop h1 */
--text-4xl:  2.25rem   /* 36px — hero numbers */

/* Font weights */
--fw-normal:   400
--fw-medium:   500
--fw-semibold: 600
--fw-bold:     700

/* Line heights */
--leading-tight:   1.25   /* headings */
--leading-snug:    1.375  /* card titles */
--leading-normal:  1.5    /* default */
--leading-relaxed: 1.625  /* long text, paragraph body */
```

### Spacing

The spacing scale uses a base-4 system (4px = 1 unit):

```
--space-1:  0.25rem   4px
--space-2:  0.5rem    8px
--space-3:  0.75rem  12px
--space-4:  1rem     16px   ← mobile padding
--space-5:  1.25rem  20px
--space-6:  1.5rem   24px
--space-8:  2rem     32px   ← standard page padding
--space-10: 2.5rem   40px
--space-12: 3rem     48px
--space-16: 4rem     64px
```

**Rule:** Use `var(--space-N)` everywhere. Never write raw `px` or `rem` values for spacing.

### Shadows

```css
--shadow-xs:    1px — icon lift
--shadow-sm:    4px — card resting
--shadow-md:   16px — card hover
--shadow-lg:   32px — elevated panels
--shadow-xl:   48px — modals
--shadow-focus: 0 0 0 3px rgba(99,102,241,0.30)  /* focus rings */
```

### Border Radius

```css
--radius-xs:   4px    /* tags, small chips */
--radius-sm:   8px    /* small cards */
--radius-md:  12px    /* inputs, standard cards */
--radius-lg:  16px    /* page cards */
--radius-xl:  32px    /* modals, large containers */
--radius-pill:9999px  /* buttons, badges */
```

### Layout

```css
--content-max:   1200px   /* max-width for most pages */
--content-tight:  900px   /* max-width for text-heavy pages (Forum, Notes, Stats) */
--page-padding:     2rem  /* horizontal padding on page containers */
```

### Z-index

```css
--z-base:      1
--z-raised:   10    /* sticky header */
--z-overlay: 100    /* drawers, dropdowns */
--z-modal:  1000    /* modals */
--z-toast:  9999    /* toasts / notifications */
```

---

## 3. Responsive Cascade

Every CSS file that has responsive rules must follow the **5-step cascade** in this exact order:

```css
@media (max-width: 1024px) { /* Large tablet / small laptop */ }
@media (max-width: 900px)  { /* Tablet portrait / iPad */ }
@media (max-width: 768px)  { /* Tablet small / large phone landscape */ }
@media (max-width: 640px)  { /* Phone landscape / small tablet */ }
@media (max-width: 480px)  { /* Phone portrait */ }
```

**What typically changes at each step:**

| Breakpoint | Typical changes |
|------------|----------------|
| 1024px | Reduce `padding` from `var(--page-padding)` to `var(--space-5)`. Adjust grid columns from 4→3 or auto-fill minmax down. |
| 900px | Reduce padding to `var(--space-4)`. 3-col grids → 2-col. |
| 768px | Hamburger menu activates. Stack flex rows to columns. Full-width buttons. Hide secondary table columns. |
| 640px | Card grid → single column. Table → card layout (using `data-label` + `::before`). Text sizes step down. |
| 480px | Minimum phone size. Modals go full-screen. Single column everything. Smallest text sizes. |

**Table-to-card pattern at ≤640px:**  
In the TSX file, add `data-label="Column Name"` to every `<td>`.  
In the CSS file at `@media (max-width: 640px)`:
```css
.my-table, .my-table tbody, .my-table tr, .my-table td { display: block; width: 100%; }
.my-table thead { display: none; }
.my-table td::before { content: attr(data-label); font-weight: var(--fw-semibold); min-width: 88px; }
```
See `AdminDoctorList.css` for the full reference implementation.

---

## 4. Adding a New Page

### Step 1 — Create the CSS file

Create `src/features/<feature>/styles/MyPage.css`.

Start with this template:

```css
/* ============================================================
   MY PAGE
   ============================================================ */

.my-page {
  max-width: var(--content-max);     /* or --content-tight for text pages */
  margin: 0 auto;
  padding: var(--space-8) var(--page-padding);
  animation: fadeUp 0.35s ease both;
}

.my-page h1 {
  font-size: var(--text-3xl);
  font-weight: var(--fw-bold);
  color: var(--text-primary);
  letter-spacing: -0.5px;
  margin-bottom: var(--space-6);
}

/* ... your page-specific styles ... */

/* ── Responsive ── */
@media (max-width: 1024px) {
  .my-page { padding: var(--space-6) var(--space-5); }
}

@media (max-width: 900px) {
  .my-page { padding: var(--space-5) var(--space-4); }
}

@media (max-width: 768px) {
  .my-page { padding: var(--space-4); }
  .my-page h1 { font-size: var(--text-2xl); }
}

@media (max-width: 640px) {
  /* card/grid adjustments */
}

@media (max-width: 480px) {
  .my-page h1 { font-size: var(--text-xl); }
}
```

### Step 2 — Use shared CSS when appropriate

Don't recreate existing patterns. Import and use:

- **Lists of cards** → use classes from `ListStyles.css` or `PatientsList.css` as a reference
- **Modal forms** → import `FormStyles.css` — it already handles overlay, glass card, inputs, actions
- **Long-form content** → use `.text-page-container` from `TextStyles.css`
- **Data table** → use the `AdminDoctorList.css` pattern
- **Loading state** → always use `<PageLoader message="Loading X" />`

### Step 3 — Never hard-code values

```css
/* ✗ Wrong */
color: #6366F1;
padding: 16px 24px;
border-radius: 12px;

/* ✓ Correct */
color: var(--accent);
padding: var(--space-4) var(--space-6);
border-radius: var(--radius-md);
```

---

## 5. Button System

Global button classes are defined in `src/index.css`. Use them directly in TSX — no custom CSS needed for standard buttons.

```tsx
// Primary (filled indigo)
<button className="btn btn-primary">Save</button>

// Outlined
<button className="btn btn-secondary">Cancel</button>

// Ghost (no border)
<button className="btn btn-ghost">Learn more</button>

// Danger outlined
<button className="btn btn-danger">Delete</button>

// Danger filled
<button className="btn btn-danger-fill">Confirm Delete</button>

// Success
<button className="btn btn-success">Activate</button>

// Size modifiers
<button className="btn btn-primary btn-sm">Small</button>
<button className="btn btn-primary btn-lg">Large</button>

// Full width
<button className="btn btn-primary btn-full">Submit</button>
```

**Rule:** Only write custom button CSS when a button has truly unique styling not covered by the above (e.g. the admin logout button with its red border against a dark header).

---

## 6. Form System

All modal forms share `src/shared/styles/FormStyles.css`. You almost never need to write form CSS.

### Standard modal form structure

```tsx
<div className="form-overlay">           {/* dark blur overlay */}
  <div className="form-container">       {/* glass card, max-width 580px */}
    <h3>Form Title</h3>
    <form className="form">
      <div className="form-group">
        <label>Field Name <span className="required">*</span></label>
        <input type="text" className="input" />
      </div>

      {/* Two-column vitals grid */}
      <div className="form-grid-2">
        <div className="form-group">...</div>
        <div className="form-group">...</div>
      </div>

      {/* Inline checkbox */}
      <div className="form-group checkbox-group">
        <input type="checkbox" id="myCheck" />
        <label htmlFor="myCheck">Is Public?</label>
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-button">Cancel</button>
        <button type="submit" className="btn btn-primary">Save</button>
      </div>
    </form>
  </div>
</div>
```

At `≤768px`: the overlay becomes `align-items: flex-start` and the card gets a top margin.  
At `≤480px`: the card goes full-screen, actions stack vertically.

---

## 7. Loading States

**Always use `<PageLoader>`** — never return a plain `<div className="loading-message">` text.

```tsx
import PageLoader from '../../../shared/components/PageLoader';

// Basic usage
if (loading) return <PageLoader message={t('patients.loading')} />;

// With a custom message
if (loading) return <PageLoader message="Loading Appointments" />;
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `message` | string | `'Loading'` | Text shown below the ECG monitor |
| `fullScreen` | boolean | `false` | Fills 100vh — use only in `App.tsx` for app-boot |
| `brand` | string | — | Shows brand title above the card — use only in `App.tsx` |

The PageLoader displays an animated ECG heartbeat trace that draws itself across a dark monitor card, with bouncing dots below the label. The animation is driven purely by CSS (`stroke-dashoffset` + `@keyframes`).

**App-boot usage** (already set in `App.tsx`, don't change):
```tsx
if (authIsLoading) {
    return <PageLoader message="Starting up" brand="Altheon Connect" fullScreen />;
}
```

---

## 8. Feedback Messages & Toasts

### Inline messages (inside page content)

Defined in `src/index.css`:

```tsx
<div className="success-message">Saved successfully.</div>
<div className="error-message">Something went wrong.</div>
<div className="no-data-message">No records found.</div>
```

### Toast notifications (top-right floating)

Toasts use the `.toast-container` and `.toast-*` classes from `src/index.css`:

```tsx
<div className="toast-container">
  <div className="toast-success">Patient saved successfully</div>
  <div className="toast-error">Failed to delete record</div>
  <div className="toast-info">Sync in progress...</div>
</div>
```

The container is `position: fixed; top: 72px; right: 1rem; z-index: var(--z-toast)`. It sits above everything including modals.

---

## 9. Admin Theme

Admin pages use a separate dark-violet theme defined at the top of `src/features/admin/styles/AdminHeader.css`:

```css
:root {
  --admin-bg:          #1E1040;   /* deep violet-navy header */
  --admin-bg-hover:    #2D1A5E;
  --admin-border:      rgba(99, 102, 241, 0.15);
  --admin-text:        #E9E4FF;
  --admin-text-muted:  #9B8FD4;
  --admin-accent:      #A78BFA;
  --admin-accent-bg:   rgba(99, 102, 241, 0.15);
}
```

**Admin page bodies** (AdminDashboard, AdminDoctorList) still use the normal light theme tokens from `index.css`. Only the header is dark. Don't apply `--admin-*` variables to page content — they're header-only.

### Admin header mobile layout

The admin header has a 2-row layout on mobile (≤768px):
- Row 1: Logo (flex: 1, grows) + Auth section (flex-shrink: 0)
- Row 2: Nav links strip (width: 100%, overflow-x: auto, scrollable)

This is controlled by `order` and `flex` properties at the 768px breakpoint in `AdminHeader.css`.

---

## 10. Animation Reference

All keyframes are defined globally in `src/index.css` and available everywhere.

| Name | Usage |
|------|-------|
| `fadeUp` | Page enters — add `animation: fadeUp 0.35s ease both` to page containers |
| `fadeIn` | Quick opacity fade |
| `scaleIn` | Modal entrance — starts at 95% scale |

**Standard page entrance:** every top-level page container should have:
```css
.my-page {
  animation: fadeUp 0.35s ease both;
}
```

**ECG loader animation** (in `PageLoader.css`) uses:
- `ecg-draw` — `stroke-dashoffset` from 1600→0 to draw the heartbeat trace
- `ecg-scan` — translates a vertical bar across the monitor
- `ecg-dot` — moves the glowing dot tip with the trace
- `dot-bounce` — three bouncing dots below the label

---

## 11. Common Mistakes to Avoid

### Hard-coding colours
```css
/* ✗ */  color: #6366F1;
/* ✓ */  color: var(--accent);
```

### Missing box-sizing on grid items
When a grid or flex container overflows on mobile, add:
```css
.my-grid { width: 100%; box-sizing: border-box; overflow-x: hidden; }
```

### Adding min-width to tables
```css
/* ✗ — breaks mobile layout by forcing the page wider */
.my-table { min-width: 480px; }

/* ✓ — put the table in a scrollable wrapper instead */
.table-wrapper { overflow-x: auto; }
```

### Skipping breakpoints
Never jump from desktop to 480px. Always follow the 5-step cascade. Missing the 768px breakpoint will break tablet layouts.

### Overriding shared form styles per-component
`FormStyles.css` already handles modal responsiveness. If you add a new modal, don't write fresh overlay/card CSS — just use `.form-overlay > .form-container`. If you need small tweaks, scope them with a feature-specific class:
```css
.consultation-form .vitals-grid { grid-template-columns: 1fr 1fr; }
```

### Using `!important` excessively
`!important` is only acceptable for:
- Overriding third-party library styles (react-calendar)
- The `.checkbox-group { flex-direction: row !important }` override (needed because `.form-group` sets column direction)

### Putting styles in the wrong file
- Page-level styles → that page's CSS file
- Shared patterns used by 2+ pages → `shared/styles/`
- Global tokens and utilities → `index.css` only

---

*Last updated: April 2026*  
*For architecture decisions, see `docs/architecture.md`.*
