import { useCallback } from 'react';

interface DraftEntry<T> {
  data: T;
  savedAt: string;
}

export function useFormDraft<T>(key: string) {
  const storageKey = `altheon_draft_${key}`;

  const loadDraft = useCallback((): DraftEntry<T> | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      return JSON.parse(raw) as DraftEntry<T>;
    } catch {
      return null;
    }
  }, [storageKey]);

  const saveDraft = useCallback(
    (data: T) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({ data, savedAt: new Date().toISOString() }),
        );
      } catch {
        // Ignore storage errors (e.g. private browsing quota)
      }
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return { loadDraft, saveDraft, clearDraft };
}
