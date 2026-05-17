// CR-P2-05: Doctor voice dictation via the Web Speech API.
//
// Usage in any TextField:
//
//   const { listening, start, stop, transcript, supported } = useVoiceDictation({
//     lang: 'en-US',
//     onFinalChunk: (chunk) => setValue(v => v + chunk),
//   });
//
//   <button onClick={listening ? stop : start} disabled={!supported}>
//     {listening ? '🛑 Stop' : '🎙 Speak'}
//   </button>
//
// Falls back gracefully on browsers without SpeechRecognition (Firefox,
// older Safari). On the wire there is no PHI — the audio is processed
// locally by the browser's speech-recognition stack (Chrome routes via
// Google Speech, which is acceptable for non-PHI free-text — for full
// HIPAA posture, swap to Azure Speech or Whisper API with BAA).

import { useCallback, useEffect, useRef, useState } from 'react';

interface UseVoiceDictationOptions {
    lang?: string;
    continuous?: boolean;
    interim?: boolean;
    onFinalChunk?: (text: string) => void;
    onInterim?: (text: string) => void;
}

interface SpeechRecognitionLike {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    abort(): void;
    onresult: ((event: SpeechRecognitionEventLike) => void) | null;
    onerror: ((event: { error: string }) => void) | null;
    onend: (() => void) | null;
}

interface SpeechRecognitionEventLike {
    results: {
        length: number;
        [k: number]: {
            isFinal: boolean;
            length: number;
            [m: number]: { transcript: string };
        };
    };
    resultIndex: number;
}

function getSpeechRecognitionCtor(): { new (): SpeechRecognitionLike } | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as {
        SpeechRecognition?: { new (): SpeechRecognitionLike };
        webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
    };
    return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceDictation(options: UseVoiceDictationOptions = {}) {
    const { lang, continuous = true, interim = true, onFinalChunk, onInterim } = options;
    const [listening, setListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const recRef = useRef<SpeechRecognitionLike | null>(null);
    const onFinalRef = useRef(onFinalChunk);
    const onInterimRef = useRef(onInterim);
    onFinalRef.current = onFinalChunk;
    onInterimRef.current = onInterim;

    const Ctor = getSpeechRecognitionCtor();
    const supported = !!Ctor;

    const ensureRecognizer = useCallback(() => {
        if (!Ctor) return null;
        if (recRef.current) return recRef.current;
        const rec = new Ctor();
        rec.lang = lang || (navigator.language || 'en-US');
        rec.continuous = continuous;
        rec.interimResults = interim;
        rec.onresult = (e) => {
            let interimText = '';
            for (let i = e.resultIndex; i < e.results.length; i++) {
                const r = e.results[i];
                if (r.isFinal) {
                    const txt = r[0].transcript.trim();
                    if (txt) {
                        setTranscript(prev => (prev ? prev + ' ' : '') + txt);
                        onFinalRef.current?.(txt + ' ');
                    }
                } else {
                    interimText += r[0].transcript;
                }
            }
            if (interimText && onInterimRef.current) onInterimRef.current(interimText);
        };
        rec.onend = () => setListening(false);
        rec.onerror = () => setListening(false);
        recRef.current = rec;
        return rec;
    }, [Ctor, lang, continuous, interim]);

    const start = useCallback(() => {
        const rec = ensureRecognizer();
        if (!rec) return;
        try { rec.start(); setListening(true); } catch { /* already started */ }
    }, [ensureRecognizer]);

    const stop = useCallback(() => {
        try { recRef.current?.stop(); } catch { /* noop */ }
        setListening(false);
    }, []);

    useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

    return { supported, listening, transcript, start, stop };
}

export default useVoiceDictation;
