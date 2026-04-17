import { useEffect, useCallback } from 'react';

type ModifierKey = 'ctrl' | 'meta' | 'shift' | 'alt';

interface ShortcutOptions {
  key: string;
  modifiers?: ModifierKey[];
  onKeyDown: (event: KeyboardEvent) => void;
  enabled?: boolean;
  /** BUG-11 fix: return true from this to suppress the shortcut (e.g. when focused in input) */
  ignoreWhen?: () => boolean;
}

export function useKeyboardShortcut({
  key,
  modifiers = [],
  onKeyDown,
  enabled = true,
  ignoreWhen,
}: ShortcutOptions) {
  const handler = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // BUG-11: don't fire when focused inside text-entry elements
      const activeTag = (document.activeElement as HTMLElement)?.tagName?.toUpperCase();
      if (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT') return;
      if (ignoreWhen?.()) return;

      const matchesKey = event.key.toLowerCase() === key.toLowerCase();
      const matchesShift = modifiers.includes('shift') ? event.shiftKey : !event.shiftKey;
      const matchesAlt = modifiers.includes('alt') ? event.altKey : true;

      // For ctrl/meta, treat them as equivalent (cross-platform Cmd/Ctrl)
      const hasCtrlOrMeta =
        modifiers.includes('ctrl') || modifiers.includes('meta')
          ? event.ctrlKey || event.metaKey
          : true;

      if (matchesKey && hasCtrlOrMeta && matchesShift && matchesAlt) {
        event.preventDefault();
        onKeyDown(event);
      }
    },
    [key, modifiers, onKeyDown, enabled, ignoreWhen],
  );

  useEffect(() => {
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [handler]);
}
