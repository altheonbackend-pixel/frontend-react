import { useEffect, useRef } from 'react';

const FOCUSABLE = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
].join(',');

export function useFocusTrap<T extends HTMLElement>(active: boolean) {
    const ref = useRef<T>(null);
    const previouslyFocused = useRef<HTMLElement | null>(null);

    useEffect(() => {
        if (!active) return;
        previouslyFocused.current = document.activeElement as HTMLElement | null;

        const node = ref.current;
        if (!node) return;

        const focusables = () =>
            Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE))
                .filter(el => !el.hasAttribute('aria-hidden'));

        const initial = focusables()[0] ?? node;
        initial.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Tab') return;
            const list = focusables();
            if (list.length === 0) {
                e.preventDefault();
                return;
            }
            const first = list[0];
            const last = list[list.length - 1];
            const current = document.activeElement as HTMLElement | null;
            if (e.shiftKey && current === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && current === last) {
                e.preventDefault();
                first.focus();
            }
        };

        node.addEventListener('keydown', onKey);
        return () => {
            node.removeEventListener('keydown', onKey);
            previouslyFocused.current?.focus?.();
        };
    }, [active]);

    return ref;
}
