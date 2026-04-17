// src/shared/components/FormField.tsx

interface FormFieldProps {
    label: string;
    error?: string;
    hint?: string;
    required?: boolean;
    children: React.ReactNode;
    htmlFor?: string;
}

export function FormField({ label, error, hint, required, children, htmlFor }: FormFieldProps) {
    return (
        <div className="form-field">
            <label htmlFor={htmlFor} className={required ? 'form-field-required' : ''}>
                {label}
            </label>
            {children}
            {error && <span className="form-field-error" role="alert">{error}</span>}
            {hint && !error && <span className="form-field-hint">{hint}</span>}
        </div>
    );
}

export default FormField;
