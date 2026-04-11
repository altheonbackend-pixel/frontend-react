import { toast as sonnerToast } from 'sonner';
import axios from 'axios';

export const toast = {
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
    info: (message: string) => sonnerToast.info(message),
    warning: (message: string) => sonnerToast.warning(message),
    loading: (message: string) => sonnerToast.loading(message),
    dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};

/**
 * Extracts a user-readable message from an API / unknown error.
 * Falls back to the provided default.
 */
export function parseApiError(err: unknown, fallback: string): string {
    if (axios.isAxiosError(err)) {
        const data = err.response?.data;
        if (typeof data === 'string') return data;
        if (data && typeof data === 'object') {
            if ('detail' in data && typeof (data as { detail: unknown }).detail === 'string') {
                return (data as { detail: string }).detail;
            }
            if ('error' in data && typeof (data as { error: unknown }).error === 'string') {
                return (data as { error: string }).error;
            }
            const flat = Object.values(data as Record<string, unknown>).flat().filter(Boolean);
            if (flat.length > 0) return flat.map(String).join(' ');
        }
        return err.message || fallback;
    }
    if (err instanceof Error) return err.message || fallback;
    return fallback;
}
