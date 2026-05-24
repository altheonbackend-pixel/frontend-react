import { useCallback } from 'react';
import api from '../../../shared/services/api';
import { useAuth } from '../../auth/hooks/useAuth';
import type { DoctorProfile } from '../../../shared/types';

/**
 * Patches the doctor profile via /profile/update/, then re-reads the full
 * /profile/ record and pushes it into the auth context so the sidebar,
 * header and every Settings section stay in sync after a save.
 */
export function useDoctorProfile() {
    const { profile, updateProfileData } = useAuth();

    const saveProfile = useCallback(async (patch: Record<string, unknown>) => {
        await api.patch('/profile/update/', patch);
        const fresh = await api.get<DoctorProfile>('/profile/');
        updateProfileData(fresh.data);
        return fresh.data;
    }, [updateProfileData]);

    // Re-read the profile and push it into auth context. Used after side-channel
    // updates (e.g. avatar upload via /profile/avatar/) so the sidebar + header
    // reflect the new photo immediately.
    const refreshProfile = useCallback(async () => {
        const fresh = await api.get<DoctorProfile>('/profile/');
        updateProfileData(fresh.data);
        return fresh.data;
    }, [updateProfileData]);

    return { profile, saveProfile, refreshProfile };
}

export default useDoctorProfile;
