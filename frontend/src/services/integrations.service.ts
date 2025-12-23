/**
 * Integrations Service
 *
 * API calls for third-party integrations (Gmail, Google Calendar, etc.)
 */

import { apiClient, ApiError } from './api-client';

// ============================================
// Types
// ============================================

export type ConnectorName = 'google_calendar' | 'gmail';
export type ConnectorSource = 'composio';
export type ConnectionStatus = 'initiated' | 'active' | 'inactive' | 'failed';
export type SyncStatus = 'success' | 'in_progress' | 'fail';

export interface ThirdPartyIntegration {
    userId: string;
    connectorName: ConnectorName;
    connectorSource: ConnectorSource;
    connectionStatus: ConnectionStatus;
    connectionId: string;
    connectedEmail?: string;
    connectedPhoneNumber?: string;
    externalEntityId?: string;
    syncStatus: SyncStatus;
    lastSyncAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateIntegrationRequest {
    connectorName: ConnectorName;
    connectorSource: ConnectorSource;
    connectionId: string;
    connectionStatus?: ConnectionStatus;
    connectedEmail?: string;
    connectedPhoneNumber?: string;
    externalEntityId?: string;
    syncStatus?: SyncStatus;
    lastSyncAt?: string;
}

export interface UpdateIntegrationRequest {
    connectionStatus?: ConnectionStatus;
    connectedEmail?: string;
    connectedPhoneNumber?: string;
    externalEntityId?: string;
    syncStatus?: SyncStatus;
    lastSyncAt?: string;
}

// ============================================
// Integration API Methods
// ============================================

/**
 * Get all integrations for current user
 */
export async function fetchIntegrations(): Promise<ThirdPartyIntegration[]> {
    try {
        const response = await apiClient.get<{ integrations: ThirdPartyIntegration[] }>('/integrations');
        return response.data.integrations;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, 'Failed to fetch integrations', error);
    }
}

/**
 * Get specific integration by connector name
 */
export async function fetchIntegration(connectorName: ConnectorName): Promise<ThirdPartyIntegration | null> {
    try {
        const response = await apiClient.get<ThirdPartyIntegration>(`/integrations/${connectorName}`);
        return response.data;
    } catch (error) {
        if (error instanceof ApiError && error.statusCode === 404) {
            return null; // Integration not found
        }
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, 'Failed to fetch integration', error);
    }
}

/**
 * Create a new integration
 */
export async function createIntegration(data: CreateIntegrationRequest): Promise<ThirdPartyIntegration> {
    try {
        const response = await apiClient.post<ThirdPartyIntegration>('/integrations', data);
        return response.data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, 'Failed to create integration', error);
    }
}

/**
 * Update an existing integration
 */
export async function updateIntegration(
    connectorName: ConnectorName,
    data: UpdateIntegrationRequest
): Promise<ThirdPartyIntegration> {
    try {
        const response = await apiClient.put<ThirdPartyIntegration>(`/integrations/${connectorName}`, data);
        return response.data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, 'Failed to update integration', error);
    }
}

/**
 * Delete an integration
 */
export async function deleteIntegration(connectorName: ConnectorName): Promise<void> {
    try {
        await apiClient.delete(`/integrations/${connectorName}`);
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, 'Failed to delete integration', error);
    }
}

// ============================================
// Composio Integration Methods
// ============================================

export interface InitiateConnectionRequest {
    connectorName: ConnectorName;
    callbackUrl?: string;
}

export interface InitiateConnectionResponse {
    redirectUrl: string;
    connectionId: string;
}

export interface ConnectionStatusResponse {
    id: string;
    status: 'INITIALIZING' | 'INITIATED' | 'ACTIVE' | 'FAILED' | 'EXPIRED' | 'INACTIVE';
    connectedEmail?: string;
    toolkit: string;
}

/**
 * Initiate a Composio connection (returns redirect URL)
 */
export async function initiateComposioConnection(
    data: InitiateConnectionRequest
): Promise<InitiateConnectionResponse> {
    try {
        const response = await apiClient.post<InitiateConnectionResponse>('/integrations/composio/initiate', data);
        return response.data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, 'Failed to initiate Composio connection', error);
    }
}

/**
 * Get connection status from Composio
 */
export async function getConnectionStatus(connectionId: string): Promise<ConnectionStatusResponse> {
    try {
        const response = await apiClient.get<ConnectionStatusResponse>(
            `/integrations/composio/status/${connectionId}`
        );
        return response.data;
    } catch (error) {
        if (error instanceof ApiError) {
            throw error;
        }
        throw new ApiError(0, 'Failed to get connection status', error);
    }
}

/**
 * Poll connection status until it's active or fails
 */
export async function pollConnectionStatus(
    connectionId: string,
    maxAttempts: number = 60,
    intervalMs: number = 2000
): Promise<ConnectionStatusResponse> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const status = await getConnectionStatus(connectionId);

        if (status.status === 'ACTIVE') {
            return status;
        }

        if (status.status === 'FAILED' || status.status === 'EXPIRED') {
            throw new Error(`Connection ${status.status.toLowerCase()}`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error('Connection timeout - user may not have completed authentication');
}
