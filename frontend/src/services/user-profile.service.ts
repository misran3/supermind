/**
 * User Profile Service
 *
 * API calls for user profiles and app settings
 */

import { apiClient, ApiError } from './api-client';

// ============================================
// Types
// ============================================

export interface UserProfile {
  userId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phoneNumber?: string;
  timezone?: string;
  supermemoryProfileCreated: boolean;
  whatsAppOptIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserAppSettings {
  userId: string;
  toneOfResponse?: string;
  whatsAppNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProfileRequest {
  email: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phoneNumber?: string;
  timezone?: string;
  whatsAppOptIn?: boolean;
}

export interface UpdateProfileRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  phoneNumber?: string;
  timezone?: string;
  whatsAppOptIn?: boolean;
  supermemoryProfileCreated?: boolean;
}

export interface UpdateSettingsRequest {
  toneOfResponse?: string;
  whatsAppNotificationsEnabled?: boolean;
}

// ============================================
// Profile API Methods
// ============================================

/**
 * Get current user's profile
 */
export async function fetchProfile(): Promise<UserProfile> {
  try {
    const response = await apiClient.get<UserProfile>('/profile');
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to fetch profile', error);
  }
}

/**
 * Create user profile
 */
export async function createProfile(data: CreateProfileRequest): Promise<UserProfile> {
  try {
    const response = await apiClient.post<UserProfile>('/profile', data);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to create profile', error);
  }
}

/**
 * Update user profile
 */
export async function updateProfile(data: UpdateProfileRequest): Promise<UserProfile> {
  try {
    const response = await apiClient.put<UserProfile>('/profile', data);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to update profile', error);
  }
}

/**
 * Delete user profile
 */
export async function deleteProfile(): Promise<void> {
  try {
    await apiClient.delete('/profile');
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to delete profile', error);
  }
}

// ============================================
// Settings API Methods
// ============================================

/**
 * Get app settings
 */
export async function fetchSettings(): Promise<UserAppSettings> {
  try {
    const response = await apiClient.get<UserAppSettings>('/settings');
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to fetch settings', error);
  }
}

/**
 * Update app settings
 */
export async function updateSettings(data: UpdateSettingsRequest): Promise<UserAppSettings> {
  try {
    const response = await apiClient.put<UserAppSettings>('/settings', data);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to update settings', error);
  }
}

/**
 * Delete app settings
 */
export async function deleteSettings(): Promise<void> {
  try {
    await apiClient.delete('/settings');
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to delete settings', error);
  }
}
