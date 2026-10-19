// Non-component helpers for the workspace (kept apart for fast refresh).
import { useEffect, useState } from 'react';
import api from '../../../shared/services/api';
import type { SectionKey } from './model';

export interface SmartPhrase { id: number; trigger: string; expansion: string }

export const SECTION_ORDER: SectionKey[] = ['visit', 'vitals', 'note', 'diagnosis', 'orders', 'patient'];
export const ACK_REASONS = ['repeat', 'treated', 'referred', 'known'] as const;

export function useSmartPhrases(enabled: boolean) {
    const [phrases, setPhrases] = useState<SmartPhrase[]>([]);
    useEffect(() => {
        if (!enabled) return;
        api.get('/smart-phrases/').then(r => setPhrases((r.data.results ?? r.data) as SmartPhrase[])).catch(() => setPhrases([]));
    }, [enabled]);
    return phrases;
}

/** Close a dialog on Escape (both workspace sheets use this). */
export function useEscape(onEscape: () => void, active = true) {
    useEffect(() => {
        if (!active) return;
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onEscape(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onEscape, active]);
}
