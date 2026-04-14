import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../auth/hooks/useAuth';
import { Drawer, toast, parseApiError } from '../../../shared/components/ui';
import api from '../../../shared/services/api';
import '../styles/ConsultationForm.css';

// ICD-10 suggestions come from the backend API (/api/icd10/search/?q=...) — 179+ codes
let icd10SearchTimer: ReturnType<typeof setTimeout> | null = null;

const COMMON_SYMPTOMS = [
    'Fever', 'Cough', 'Shortness of breath', 'Fatigue', 'Headache',
    'Sore throat', 'Runny nose', 'Chest pain', 'Nausea', 'Vomiting',
    'Diarrhea', 'Abdominal pain', 'Back pain', 'Joint pain', 'Dizziness',
    'Loss of appetite', 'Weight loss', 'Sweating', 'Chills', 'Rash',
];

interface Consultation {
    id?: number;
    consultation_date: string;
    consultation_type?: string;
    reason_for_consultation: string;
    symptoms?: string[];
    medical_report: string | null;
    diagnosis: string | null;
    icd_code?: string | null;
    follow_up_date?: string | null;
    weight: number | null;
    height: number | null;
    height_unit: string;
    sp2: number | null;
    temperature: number | null;
    bp_systolic: number | null;
    bp_diastolic: number | null;
    blood_pressure_display?: string | null;
    visible_to_patient?: boolean;
}

interface ConsultationFormProps {
    patientId: string;
    onSuccess: () => void;
    onCancel: () => void;
    consultationToEdit?: Consultation | null;
}

const ConsultationForm = ({ patientId, onSuccess, onCancel, consultationToEdit }: ConsultationFormProps) => {
    const { t } = useTranslation();
    const { token } = useAuth();
    const [formData, setFormData] = useState({
        consultation_date: new Date().toISOString().slice(0, 10),
        consultation_type: 'in_person',
        reason_for_consultation: '',
        medical_report: '',
        diagnosis: '',
        follow_up_date: '',
        weight: '',
        height: '',
        height_unit: 'cm',
        sp2: '',
        temperature: '',
        bp_systolic: '',
        bp_diastolic: '',
        visible_to_patient: false,
    });
    const [symptoms, setSymptoms] = useState<string[]>([]);
    const [customSymptom, setCustomSymptom] = useState('');
    const [loading, setLoading] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [icdSuggestions, setIcdSuggestions] = useState<{ code: string; label: string }[]>([]);
    const [showIcdSuggestions, setShowIcdSuggestions] = useState(false);
    const [icdCode, setIcdCode] = useState('');
    const [pendingFollowUp, setPendingFollowUp] = useState<{ date: string; reason: string } | null>(null);
    const [creatingFollowUp, setCreatingFollowUp] = useState(false);

    // Prescriptions for this visit
    const [rxList, setRxList] = useState<{ medication_name: string; dosage: string; frequency: string; duration_days: string; instructions: string }[]>([]);
    const [showRxForm, setShowRxForm] = useState(false);
    const [rxForm, setRxForm] = useState({ medication_name: '', dosage: '', frequency: 'once_daily', duration_days: '', instructions: '' });
    const addRx = async (consultationId: number) => {
        if (!rxForm.medication_name.trim() || !rxForm.dosage.trim()) return;
        try {
            await api.post('/prescriptions/', {
                patient: patientId,
                consultation: consultationId,
                medication_name: rxForm.medication_name,
                dosage: rxForm.dosage,
                frequency: rxForm.frequency,
                duration_days: rxForm.duration_days ? parseInt(rxForm.duration_days) : null,
                instructions: rxForm.instructions,
            });
            setRxList(prev => [...prev, { ...rxForm }]);
            setRxForm({ medication_name: '', dosage: '', frequency: 'once_daily', duration_days: '', instructions: '' });
            setShowRxForm(false);
            toast.success('Prescription added.');
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to add prescription.'));
        }
    };

    useEffect(() => {
        if (consultationToEdit) {
            setFormData({
                consultation_date: consultationToEdit.consultation_date || new Date().toISOString().slice(0, 10),
                consultation_type: consultationToEdit.consultation_type || 'in_person',
                reason_for_consultation: consultationToEdit.reason_for_consultation,
                medical_report: consultationToEdit.medical_report || '',
                diagnosis: consultationToEdit.diagnosis || '',
                follow_up_date: consultationToEdit.follow_up_date || '',
                weight: consultationToEdit.weight !== null ? String(consultationToEdit.weight) : '',
                height: consultationToEdit.height !== null ? String(consultationToEdit.height) : '',
                sp2: consultationToEdit.sp2 !== null ? String(consultationToEdit.sp2) : '',
                temperature: consultationToEdit.temperature !== null ? String(consultationToEdit.temperature) : '',
                bp_systolic: consultationToEdit.bp_systolic !== null ? String(consultationToEdit.bp_systolic) : '',
                bp_diastolic: consultationToEdit.bp_diastolic !== null ? String(consultationToEdit.bp_diastolic) : '',
                height_unit: consultationToEdit.height_unit || 'cm',
                visible_to_patient: consultationToEdit.visible_to_patient || false,
            });
            setSymptoms(consultationToEdit.symptoms || []);
            setIcdCode(consultationToEdit.icd_code || '');
        }
    }, [consultationToEdit]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setDirty(true);
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const toggleSymptom = (symptom: string) => {
        setDirty(true);
        setSymptoms(prev =>
            prev.includes(symptom) ? prev.filter(s => s !== symptom) : [...prev, symptom]
        );
    };

    const addCustomSymptom = () => {
        const trimmed = customSymptom.trim();
        if (trimmed && !symptoms.includes(trimmed)) {
            setDirty(true);
            setSymptoms(prev => [...prev, trimmed]);
            setCustomSymptom('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!token) {
            toast.error(t('consultation.error.auth'));
            setLoading(false);
            return;
        }

        try {
            const dataToSend = {
                ...formData,
                patient: patientId,
                symptoms,
                icd_code: icdCode || null,
                weight: formData.weight ? parseFloat(formData.weight) : null,
                height: formData.height ? parseFloat(formData.height) : null,
                sp2: formData.sp2 ? parseFloat(formData.sp2) : null,
                temperature: formData.temperature ? parseFloat(formData.temperature) : null,
                bp_systolic: formData.bp_systolic ? parseInt(formData.bp_systolic, 10) : null,
                bp_diastolic: formData.bp_diastolic ? parseInt(formData.bp_diastolic, 10) : null,
                follow_up_date: formData.follow_up_date || null,
            };

            let response;
            if (consultationToEdit && consultationToEdit.id) {
                response = await api.put(`/consultations/${consultationToEdit.id}/`, dataToSend);
            } else {
                response = await api.post('/consultations/', dataToSend);
            }

            if (response.status === 201 || response.status === 200) {
                // Save any queued prescriptions against this consultation
                if (!isEditing && rxForm.medication_name.trim() && rxForm.dosage.trim()) {
                    await addRx(response.data.id);
                }
                toast.success(isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'));
                setDirty(false);
                // If new consultation with follow-up date, prompt to create follow-up appointment
                if (!isEditing && formData.follow_up_date) {
                    setPendingFollowUp({
                        date: formData.follow_up_date,
                        reason: `Follow-up: ${formData.reason_for_consultation}`,
                    });
                } else {
                    onSuccess();
                }
            }
        } catch (err) {
            toast.error(parseApiError(err, t('consultation.error.generic')));
        } finally {
            setLoading(false);
        }
    };

    const isEditing = !!consultationToEdit;

    const handleCreateFollowUpAppointment = async () => {
        if (!pendingFollowUp) return;
        setCreatingFollowUp(true);
        try {
            await api.post('/appointments/', {
                patient: patientId,
                appointment_date: `${pendingFollowUp.date}T09:00:00`,
                reason_for_appointment: pendingFollowUp.reason,
                status: 'scheduled',
            });
            toast.success('Follow-up appointment created and scheduled.');
        } catch {
            toast.error('Could not create follow-up appointment. You can create it manually from the Appointments page.');
        } finally {
            setCreatingFollowUp(false);
            setPendingFollowUp(null);
            onSuccess();
        }
    };

    // Follow-up prompt dialog shown after consultation saved
    if (pendingFollowUp) {
        return (
            <div className="modal-overlay">
                <div className="modal-box followup-prompt-modal">
                    <h3 className="modal-title">Create Follow-up Appointment?</h3>
                    <p className="modal-desc">
                        You set a follow-up date of <strong>{new Date(pendingFollowUp.date + 'T00:00:00').toLocaleDateString()}</strong>.
                        Would you like to create a scheduled appointment for that date?
                    </p>
                    <div className="modal-actions">
                        <button type="button" className="cancel-button" onClick={() => { setPendingFollowUp(null); onSuccess(); }}>
                            No, skip
                        </button>
                        <button type="button" className="btn btn-success" onClick={handleCreateFollowUpAppointment} disabled={creatingFollowUp}>
                            {creatingFollowUp ? 'Creating...' : 'Yes, create appointment'}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Drawer
            open
            onClose={onCancel}
            title={isEditing ? t('consultation.title_edit') : t('consultation.title_add')}
            size="lg"
            dirty={dirty}
            footer={
                <>
                    <button type="button" onClick={onCancel} className="cancel-button" disabled={loading}>
                        {t('consultation.cancel')}
                    </button>
                    <button type="submit" form="consultation-form" className="btn btn-primary" disabled={loading}>
                        {loading ? t('consultation.loading') : (isEditing ? t('consultation.submit_edit') : t('consultation.submit_add'))}
                    </button>
                </>
            }
        >
                <form id="consultation-form" onSubmit={handleSubmit} className="form">
                    {/* Consultation date */}
                    <div className="form-group">
                        <label htmlFor="consultation_date">{t('consultation.date')} <span className="required">*</span></label>
                        <input type="date" id="consultation_date" name="consultation_date" className="input" value={formData.consultation_date} onChange={handleChange} required />
                    </div>

                    {/* Consultation type */}
                    <div className="form-group">
                        <label htmlFor="consultation_type">Consultation Type</label>
                        <select id="consultation_type" name="consultation_type" className="select-input" value={formData.consultation_type} onChange={handleChange}>
                            <option value="in_person">In Person</option>
                            <option value="telemedicine">Telemedicine</option>
                            <option value="home_visit">Home Visit</option>
                        </select>
                    </div>

                    {/* Vitals */}
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="weight">{t('consultation.weight')}</label>
                            <input type="number" step="0.01" id="weight" name="weight" className="input" value={formData.weight} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="height">
                                {t('consultation.height')}
                                <select name="height_unit" value={formData.height_unit} onChange={handleChange} style={{ marginLeft: '8px', fontWeight: 'normal', fontSize: '0.85em' }}>
                                    <option value="cm">cm</option>
                                    <option value="m">m</option>
                                </select>
                            </label>
                            <input type="number" step="0.01" id="height" name="height" className="input" value={formData.height} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="temperature">{t('consultation.temperature')}</label>
                            <input type="number" step="0.01" id="temperature" name="temperature" className="input" value={formData.temperature} onChange={handleChange} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="sp2">{t('consultation.sp2')}</label>
                            <input type="number" step="0.01" id="sp2" name="sp2" className="input" value={formData.sp2} onChange={handleChange} />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="bp_systolic">BP Systolic (mmHg)</label>
                            <input type="number" id="bp_systolic" name="bp_systolic" className="input" value={formData.bp_systolic} onChange={handleChange} min="50" max="300" />
                        </div>
                        <div className="form-group">
                            <label htmlFor="bp_diastolic">BP Diastolic (mmHg)</label>
                            <input type="number" id="bp_diastolic" name="bp_diastolic" className="input" value={formData.bp_diastolic} onChange={handleChange} min="30" max="200" />
                        </div>
                    </div>

                    <hr />

                    {/* Clinical info */}
                    <div className="form-group">
                        <label htmlFor="reason_for_consultation">{t('consultation.reason')} <span className="required">*</span></label>
                        <textarea id="reason_for_consultation" name="reason_for_consultation" className="textarea" value={formData.reason_for_consultation} onChange={handleChange} required rows={3} />
                    </div>

                    {/* Symptoms multi-select */}
                    <div className="form-group">
                        <label>Symptoms</label>
                        <div className="symptoms-chips">
                            {COMMON_SYMPTOMS.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    className={`symptom-chip${symptoms.includes(s) ? ' active' : ''}`}
                                    onClick={() => toggleSymptom(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                        <div className="custom-symptom-row">
                            <input
                                type="text"
                                placeholder="Add custom symptom..."
                                value={customSymptom}
                                onChange={e => setCustomSymptom(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomSymptom())}
                            />
                            <button type="button" onClick={addCustomSymptom} className="add-chip-btn">Add</button>
                        </div>
                        {symptoms.filter(s => !COMMON_SYMPTOMS.includes(s)).map(s => (
                            <span key={s} className="symptom-chip active custom-chip">
                                {s}
                                <button type="button" onClick={() => toggleSymptom(s)} className="chip-remove">×</button>
                            </span>
                        ))}
                    </div>

                    <div className="form-group">
                        <label htmlFor="diagnosis">{t('consultation.diagnosis')}</label>
                        <textarea id="diagnosis" name="diagnosis" className="textarea" value={formData.diagnosis} onChange={handleChange} rows={3} />
                    </div>

                    {/* ICD-10 code lookup */}
                    <div className="form-group" style={{ position: 'relative' }}>
                        <label htmlFor="icd_code">ICD-10 Code <span style={{ fontWeight: 400, color: 'var(--text-muted)', fontSize: '0.85em' }}>(structured anchor for diagnosis)</span></label>
                        <input
                            id="icd_code"
                            type="text"
                            value={icdCode}
                            onChange={e => {
                                const val = e.target.value;
                                setIcdCode(val);
                                setDirty(true);
                                if (val.length >= 1) {
                                    setShowIcdSuggestions(true);
                                    if (icd10SearchTimer) clearTimeout(icd10SearchTimer);
                                    icd10SearchTimer = setTimeout(async () => {
                                        try {
                                            const res = await api.get('/icd10/search/', { params: { q: val } });
                                            setIcdSuggestions(
                                                res.data.map((item: { code: string; description: string }) => ({
                                                    code: item.code,
                                                    label: item.description,
                                                }))
                                            );
                                            setShowIcdSuggestions(true);
                                        } catch {
                                            setIcdSuggestions([]);
                                        }
                                    }, 250);
                                } else {
                                    setIcdSuggestions([]);
                                    setShowIcdSuggestions(false);
                                }
                            }}
                            onBlur={() => setTimeout(() => setShowIcdSuggestions(false), 150)}
                            autoComplete="off"
                            placeholder="e.g. J06.9 — or type condition name to search"
                        />
                        {showIcdSuggestions && icdSuggestions.length > 0 && (
                            <ul className="icd-suggestions-dropdown">
                                {icdSuggestions.map(item => (
                                    <li key={item.code}>
                                        <button type="button" onMouseDown={() => {
                                            setIcdCode(item.code);
                                            setDirty(true);
                                            // Also pre-fill diagnosis label if empty
                                            if (!formData.diagnosis) {
                                                setFormData(f => ({ ...f, diagnosis: item.label }));
                                            }
                                            setShowIcdSuggestions(false);
                                            setIcdSuggestions([]);
                                        }}>
                                            <span className="icd-code">{item.code}</span>
                                            <span className="icd-label">{item.label}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    <div className="form-group">
                        <label htmlFor="medical_report">{t('consultation.report')}</label>
                        <textarea id="medical_report" name="medical_report" value={formData.medical_report} onChange={handleChange} rows={5} />
                    </div>
                    {/* Follow-up date */}
                    <div className="form-group">
                        <label htmlFor="follow_up_date">Follow-up Date</label>
                        <input type="date" id="follow_up_date" name="follow_up_date" value={formData.follow_up_date} onChange={handleChange} />
                    </div>

                    {/* Prescriptions this visit */}
                    {!consultationToEdit && (
                        <div className="form-group">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ marginBottom: 0 }}>Prescriptions this visit</label>
                                <button type="button" className="btn btn--sm btn--secondary" onClick={() => setShowRxForm(v => !v)}>
                                    {showRxForm ? 'Cancel' : '+ Add Prescription'}
                                </button>
                            </div>
                            {rxList.length > 0 && (
                                <ul style={{ margin: '0 0 8px 0', padding: '0', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {rxList.map((rx, i) => (
                                        <li key={i} style={{ fontSize: 'var(--text-sm)', padding: '6px 10px', background: 'var(--color-background-secondary)', borderRadius: '6px' }}>
                                            <strong>{rx.medication_name}</strong> — {rx.dosage} ({rx.frequency})
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {showRxForm && (
                                <div style={{ border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Medication <span className="required">*</span></label>
                                            <input
                                                value={rxForm.medication_name}
                                                onChange={e => setRxForm(p => ({ ...p, medication_name: e.target.value }))}
                                                placeholder="e.g. Amoxicillin 500mg"
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Dosage <span className="required">*</span></label>
                                            <input
                                                value={rxForm.dosage}
                                                onChange={e => setRxForm(p => ({ ...p, dosage: e.target.value }))}
                                                placeholder="e.g. 1 tablet"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Frequency</label>
                                            <select value={rxForm.frequency} onChange={e => setRxForm(p => ({ ...p, frequency: e.target.value }))}>
                                                <option value="once">Once</option>
                                                <option value="once_daily">Once Daily</option>
                                                <option value="twice_daily">Twice Daily</option>
                                                <option value="three_times_daily">Three Times Daily</option>
                                                <option value="four_times_daily">Four Times Daily</option>
                                                <option value="as_needed">As Needed</option>
                                                <option value="weekly">Weekly</option>
                                                <option value="other">Other</option>
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label>Duration (days)</label>
                                            <input
                                                type="number"
                                                value={rxForm.duration_days}
                                                onChange={e => setRxForm(p => ({ ...p, duration_days: e.target.value }))}
                                                placeholder="e.g. 7"
                                                min="1"
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Instructions</label>
                                        <input
                                            value={rxForm.instructions}
                                            onChange={e => setRxForm(p => ({ ...p, instructions: e.target.value }))}
                                            placeholder="e.g. Take with food"
                                        />
                                    </div>
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: 0 }}>
                                        Prescription will be saved when you submit the consultation.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Visible to patient toggle */}
                    <div className="form-group form-checkbox">
                        <label>
                            <input
                                type="checkbox"
                                name="visible_to_patient"
                                checked={formData.visible_to_patient}
                                onChange={handleChange}
                            />
                            {' '}Will be visible to patient once the patient portal is live
                        </label>
                    </div>

                </form>
        </Drawer>
    );
};

export default ConsultationForm;
