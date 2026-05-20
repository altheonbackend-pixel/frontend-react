// Accessible on/off switch. Styled by shared/styles/settings-ui.css
// (.settings-switch). Used by the doctor Settings page and patient portal.

interface SwitchProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    disabled?: boolean;
    label: string;
}

export function Switch({ checked, onChange, disabled, label }: SwitchProps) {
    return (
        <span className="settings-switch">
            <input
                type="checkbox"
                role="switch"
                aria-label={label}
                aria-checked={checked}
                checked={checked}
                disabled={disabled}
                onChange={e => onChange(e.target.checked)}
            />
            <span className="settings-switch-track" aria-hidden="true" />
        </span>
    );
}

export default Switch;
