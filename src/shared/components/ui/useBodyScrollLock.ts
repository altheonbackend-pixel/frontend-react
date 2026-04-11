import { useEffect } from 'react';

let lockCount = 0;
let previousOverflow = '';
let previousPaddingRight = '';

export function useBodyScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return;
        if (lockCount === 0) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            previousOverflow = document.body.style.overflow;
            previousPaddingRight = document.body.style.paddingRight;
            document.body.style.overflow = 'hidden';
            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${scrollbarWidth}px`;
            }
        }
        lockCount += 1;
        return () => {
            lockCount -= 1;
            if (lockCount === 0) {
                document.body.style.overflow = previousOverflow;
                document.body.style.paddingRight = previousPaddingRight;
            }
        };
    }, [active]);
}
