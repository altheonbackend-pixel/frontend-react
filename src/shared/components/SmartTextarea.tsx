// CR-P2-01 + CR-P2-05 combined: a drop-in <textarea> replacement that
// adds voice dictation (mic button) and smart-phrase expansion (`.heent`).
//
// Usage:
//
//   <SmartTextarea
//     value={value}
//     onChange={(v) => setValue(v)}
//     placeholder="HPI…"
//     rows={6}
//   />

import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useVoiceDictation } from '../hooks/useVoiceDictation';
import { useSmartPhraseExpansion } from '../hooks/useSmartPhraseExpansion';
import { Icon } from './Icons';

interface SmartTextareaProps {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    rows?: number;
    name?: string;
    id?: string;
    className?: string;
    disabled?: boolean;
    'aria-label'?: string;
    onBlur?: () => void;
    /** Disable mic / smart-phrase if the field shouldn't have them. */
    disableVoice?: boolean;
    disableSmartPhrase?: boolean;
}

export function SmartTextarea({
    value, onChange, placeholder, rows = 4, name, id, className, disabled,
    onBlur, disableVoice, disableSmartPhrase, ...aria
}: SmartTextareaProps) {
    const { t } = useTranslation();
    const { onInput: expand } = useSmartPhraseExpansion();
    const { supported, listening, start, stop } = useVoiceDictation({
        onFinalChunk: (chunk) => onChange((value ? value + ' ' : '') + chunk.trim()),
    });

    const handleChange = useCallback((next: string) => {
        const out = disableSmartPhrase ? next : expand(next);
        onChange(out);
    }, [disableSmartPhrase, expand, onChange]);

    return (
        <div className={`smart-textarea ${className || ''}`} style={{ position: 'relative' }}>
            <textarea
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                placeholder={placeholder}
                rows={rows}
                name={name}
                id={id}
                disabled={disabled}
                onBlur={onBlur}
                aria-label={aria['aria-label']}
                className="form-input"
                style={{ width: '100%', paddingRight: '2.6rem' }}
            />
            {!disableVoice && supported && (
                <button
                    type="button"
                    aria-label={listening
                        ? t('voice.stop', 'Stop dictation')
                        : t('voice.start', 'Start voice dictation')
                    }
                    onClick={listening ? stop : start}
                    title={listening
                        ? t('voice.stop', 'Stop dictation')
                        : t('voice.start', 'Start voice dictation')
                    }
                    style={{
                        position: 'absolute',
                        top: '0.4rem',
                        right: '0.4rem',
                        border: 'none',
                        cursor: 'pointer',
                        background: listening ? 'var(--color-danger, #ef4444)' : 'var(--bg-subtle, #f3f4f6)',
                        color: listening ? 'white' : 'var(--text-secondary, #6b7280)',
                        borderRadius: '50%',
                        width: '2rem', height: '2rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: listening ? '0 0 0 4px rgba(239,68,68,0.2)' : 'var(--shadow-xs, none)',
                        transition: 'all 150ms ease',
                    }}
                >
                    <Icon name="phone" size={14} aria-label="" aria-hidden />
                </button>
            )}
            {!disableSmartPhrase && (
                <div
                    style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-muted, #6b7280)',
                        marginTop: '0.25rem',
                    }}
                >
                    {t('smart_textarea.hint', 'Tip: type `.shortcut` to expand a smart phrase.')}
                </div>
            )}
        </div>
    );
}

export default SmartTextarea;
