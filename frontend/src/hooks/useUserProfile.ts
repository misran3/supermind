/**
 * User Profile Hook
 *
 * Provides methods for managing user profile and app settings
 * with loading states, error handling, and automatic token management.
 */

import { useState, useCallback } from 'react';
import {
  fetchProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  fetchSettings,
  updateSettings,
  deleteSettings,
  type UserProfile,
  type UserAppSettings,
  type CreateProfileRequest,
  type UpdateProfileRequest,
  type UpdateSettingsRequest,
} from '@/src/services/user-profile.service';
import { ApiError } from '@/src/services/api-client';

interface UseUserProfileReturn {
  // Profile state
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string | null;

  // Settings state
  settings: UserAppSettings | null;
  settingsLoading: boolean;
  settingsError: string | null;

  // Profile operations
  loadProfile: () => Promise<void>;
  createUserProfile: (data: CreateProfileRequest) => Promise<UserProfile | null>;
  updateUserProfile: (data: UpdateProfileRequest) => Promise<UserProfile | null>;
  deleteUserProfile: () => Promise<boolean>;

  // Settings operations
  loadSettings: () => Promise<void>;
  updateUserSettings: (data: UpdateSettingsRequest) => Promise<UserAppSettings | null>;
  deleteUserSettings: () => Promise<boolean>;

  // Utility
  clearErrors: () => void;
}

/**
 * Hook for managing user profile and app settings
 *
 * @example
 * const {
 *   profile,
 *   profileLoading,
 *   loadProfile,
 *   updateUserProfile
 * } = useUserProfile();
 *
 * useEffect(() => {
 *   loadProfile();
 * }, []);
 *
 * const handleUpdate = async () => {
 *   await updateUserProfile({ firstName: 'John' });
 * };
 */
export function useUserProfile(): UseUserProfileReturn {
  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<UserAppSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setProfileError(null);
    setSettingsError(null);
  }, []);

  // ============================================
  // Profile Operations
  // ============================================

  /**
   * Load user profile
   */
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const data = await fetchProfile();
      setProfile(data);
    } catch (error) {
      let message = 'Failed to load profile';
      if (error instanceof ApiError) {
        // Include status code in error message for 404 detection
        if (error.statusCode === 404) {
          message = 'Profile not found (404)';
        } else {
          message = error.message;
        }
      }
      setProfileError(message);
      console.error('Failed to load profile:', error);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  /**
   * Create user profile
   */
  const createUserProfile = useCallback(async (data: CreateProfileRequest): Promise<UserProfile | null> => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const newProfile = await createProfile(data);
      setProfile(newProfile);
      return newProfile;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create profile';
      setProfileError(message);
      console.error('Failed to create profile:', error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  /**
   * Update user profile
   */
  const updateUserProfile = useCallback(async (data: UpdateProfileRequest): Promise<UserProfile | null> => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      const updatedProfile = await updateProfile(data);
      setProfile(updatedProfile);
      return updatedProfile;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update profile';
      setProfileError(message);
      console.error('Failed to update profile:', error);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  /**
   * Delete user profile
   */
  const deleteUserProfile = useCallback(async (): Promise<boolean> => {
    setProfileLoading(true);
    setProfileError(null);

    try {
      await deleteProfile();
      setProfile(null);
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete profile';
      setProfileError(message);
      console.error('Failed to delete profile:', error);
      return false;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // ============================================
  // Settings Operations
  // ============================================

  /**
   * Load app settings
   */
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    setSettingsError(null);

    try {
      const data = await fetchSettings();
      setSettings(data);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load settings';
      setSettingsError(message);
      console.error('Failed to load settings:', error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  /**
   * Update app settings
   */
  const updateUserSettings = useCallback(async (data: UpdateSettingsRequest): Promise<UserAppSettings | null> => {
    setSettingsLoading(true);
    setSettingsError(null);

    try {
      const updatedSettings = await updateSettings(data);
      setSettings(updatedSettings);
      return updatedSettings;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to update settings';
      setSettingsError(message);
      console.error('Failed to update settings:', error);
      return null;
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  /**
   * Delete app settings
   */
  const deleteUserSettings = useCallback(async (): Promise<boolean> => {
    setSettingsLoading(true);
    setSettingsError(null);

    try {
      await deleteSettings();
      setSettings(null);
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete settings';
      setSettingsError(message);
      console.error('Failed to delete settings:', error);
      return false;
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  return {
    // Profile state
    profile,
    profileLoading,
    profileError,

    // Settings state
    settings,
    settingsLoading,
    settingsError,

    // Profile operations
    loadProfile,
    createUserProfile,
    updateUserProfile,
    deleteUserProfile,

    // Settings operations
    loadSettings,
    updateUserSettings,
    deleteUserSettings,

    // Utility
    clearErrors,
  };
}
