import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormDraft } from '../useFormDraft';

const TEST_KEY = 'test_draft_key';
const STORAGE_KEY = `altheon_draft_${TEST_KEY}`;

describe('useFormDraft', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('saves draft to localStorage', () => {
        const { result } = renderHook(() => useFormDraft<{ name: string }>(TEST_KEY));
        act(() => {
            result.current.saveDraft({ name: 'test' });
        });
        const raw = localStorage.getItem(STORAGE_KEY);
        expect(raw).not.toBeNull();
        const parsed = JSON.parse(raw!);
        expect(parsed.data).toEqual({ name: 'test' });
        expect(parsed.savedAt).toBeDefined();
    });

    it('loads saved draft', () => {
        const { result } = renderHook(() => useFormDraft<{ name: string }>(TEST_KEY));
        act(() => {
            result.current.saveDraft({ name: 'hello' });
        });
        const entry = result.current.loadDraft();
        expect(entry).not.toBeNull();
        expect(entry!.data.name).toBe('hello');
    });

    it('clearDraft removes the key', () => {
        const { result } = renderHook(() => useFormDraft<{ name: string }>(TEST_KEY));
        act(() => {
            result.current.saveDraft({ name: 'temp' });
            result.current.clearDraft();
        });
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
        expect(result.current.loadDraft()).toBeNull();
    });

    it('loadDraft returns null when nothing saved', () => {
        const { result } = renderHook(() => useFormDraft<{ name: string }>(TEST_KEY));
        expect(result.current.loadDraft()).toBeNull();
    });

    it('loadDraft returns null on corrupt storage', () => {
        localStorage.setItem(STORAGE_KEY, 'not-valid-json{{{');
        const { result } = renderHook(() => useFormDraft<{ name: string }>(TEST_KEY));
        expect(result.current.loadDraft()).toBeNull();
    });
});
