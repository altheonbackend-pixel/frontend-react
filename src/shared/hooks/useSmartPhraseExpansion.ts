// CR-P2-01 (frontend integration): Smart-phrase trigger detection in any
// controlled textarea/input. When the user types `.heent` followed by
// space/return, the trigger is replaced with the expansion text.
//
// The hook fetches the doctor's accessible SmartPhrase library once at
// mount and rebuilds a trigger→expansion map.
//
// Usage:
//
//   const { onInput, expanded } = useSmartPhraseExpansion();
//   <textarea value={text} onChange={(e) => setText(onInput(e.target.value))} />

import { useEffect, useRef, useState } from 'react';
import api from '../services/api';

interface SmartPhrase {
    id: number;
    trigger: string;
    expansion: string;
}

export function useSmartPhraseExpansion() {
    const phrasesRef = useRef<Record<string, string>>({});
    const [ready, setReady] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get('/smart-phrases/').then(res => {
            if (cancelled) return;
            const list = (res.data?.results ?? res.data ?? []) as SmartPhrase[];
            const map: Record<string, string> = {};
            for (const p of list) map[p.trigger.toLowerCase()] = p.expansion;
            phrasesRef.current = map;
            setReady(true);
        }).catch(() => setReady(true));
        return () => { cancelled = true; };
    }, []);

    const onInput = (text: string): string => {
        if (!text || !ready) return text;
        // Match the last token ending in space/newline.
        const m = text.match(/(^|\s)\.([\w-]+)(\s|$)/);
        if (!m) return text;
        const trigger = m[2].toLowerCase();
        const expansion = phrasesRef.current[trigger];
        if (!expansion) return text;
        return text.slice(0, m.index!) + (m[1] || '') + expansion + (m[3] || '');
    };

    return { ready, onInput };
}

export default useSmartPhraseExpansion;
