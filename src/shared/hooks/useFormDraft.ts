import { useCallback } from 'react';

const DRAFT_PREFIX = 'altheon_draft_';

interface DraftEntry<T> {
  data: T;
  savedAt: string;
}

export function useFormDraft<T>(key: string) {
  const storageKey = `${DRAFT_PREFIX}${key}`;

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

/**
 * Clears all localStorage draft entries belonging to a specific doctor.
 * Call this on logout and on 401 to prevent cross-session data leakage.
 */
export function clearAllDraftsForDoctor(doctorId: string | number) {
  const prefix = `${DRAFT_PREFIX}consultation_${doctorId}_`;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}
