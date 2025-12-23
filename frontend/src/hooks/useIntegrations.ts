/**
 * useIntegrations Hook
 *
 * Manages third-party integrations with Composio SDK
 */

import { useState, useCallback } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import {
    fetchIntegrations,
    createIntegration,
    deleteIntegration,
    initiateComposioConnection,
    pollConnectionStatus,
    type ThirdPartyIntegration,
    type ConnectorName,
} from '@/src/services/integrations.service';
import toast from 'react-hot-toast';

export const useIntegrations = () => {
    const [integrations, setIntegrations] = useState<ThirdPartyIntegration[]>([]);
    const [integrationsLoading, setIntegrationsLoading] = useState(false);
    const [integrationsError, setIntegrationsError] = useState<string | null>(null);

    /**
     * Get current user ID from Cognito session
     */
    const getUserId = async (): Promise<string> => {
        try {
            const session = await fetchAuthSession();
            const userId = session.tokens?.idToken?.payload?.sub as string;
            if (!userId) {
                throw new Error('No user ID found in session');
            }
            return userId;
        } catch (error) {
            console.error('Failed to get user ID:', error);
            throw new Error('Failed to authenticate');
        }
    };

    /**
     * Load all integrations for current user
     */
    const loadIntegrations = useCallback(async () => {
        setIntegrationsLoading(true);
        setIntegrationsError(null);

        try {
            const data = await fetchIntegrations();
            setIntegrations(data);
        } catch (error: unknown) {
            if (error instanceof Error) {
                const errorMessage = error.message || 'Failed to load integrations';
                setIntegrationsError(errorMessage);
                console.error('Error loading integrations:', error);
            } else {
                const errorMessage = 'Failed to load integrations';
                setIntegrationsError(errorMessage);
                console.error('Error loading integrations:', error);
            }
        } finally {
            setIntegrationsLoading(false);
        }
    }, []);

    /**
     * Connect a new integration using Composio (via backend)
     */
    const connectIntegration = useCallback(
        async (connector: ConnectorName) => {
            setIntegrationsLoading(true);
            setIntegrationsError(null);

            let popup: Window | null = null;

            try {
                // Get user ID for entity mapping
                const userId = await getUserId();

                // Call backend to initiate connection
                const { redirectUrl, connectionId } = await initiateComposioConnection({
                    connectorName: connector,
                    callbackUrl: window.location.href,
                });

                // Open the redirect URL in a popup window
                popup = window.open(redirectUrl, 'composio-auth', 'width=600,height=700,scrollbars=yes');

                if (!popup) {
                    throw new Error('Failed to open authentication popup. Please allow popups for this site.');
                }

                // Poll for connection status
                const connectedAccount = await pollConnectionStatus(connectionId);

                console.log('Connected account:', connectedAccount);

                // Save to backend
                await createIntegration({
                    connectorName: connector,
                    connectorSource: 'composio',
                    connectionId: connectedAccount.id,
                    connectedEmail: connectedAccount.connectedEmail,
                    connectionStatus: 'active',
                    externalEntityId: userId,
                    syncStatus: 'success',
                });

                toast.success(`${connector === 'gmail' ? 'Gmail' : 'Google Calendar'} connected successfully!`);

                // Close popup if still open
                if (popup && !popup.closed) {
                    popup.close();
                }

                // Reload integrations
                await loadIntegrations();
            } catch (error: unknown) {
                // Close popup on error
                if (popup && !popup.closed) {
                    popup.close();
                }

                if (error instanceof Error) {
                    const errorMessage = error.message || 'Failed to connect integration';
                    setIntegrationsError(errorMessage);
                    toast.error(errorMessage);
                    console.error('Error connecting integration:', error);
                } else {
                    const errorMessage = 'Failed to connect integration';
                    setIntegrationsError(errorMessage);
                    toast.error(errorMessage);
                    console.error('Error connecting integration:', errorMessage);
                }
            } finally {
                setIntegrationsLoading(false);
            }
        },
        [loadIntegrations]
    );

    /**
     * Disconnect an existing integration
     */
    const disconnectIntegration = useCallback(
        async (connector: ConnectorName) => {
            setIntegrationsLoading(true);
            setIntegrationsError(null);

            try {
                // Find the integration
                const integration = integrations.find((i) => i.connectorName === connector);
                if (!integration) {
                    throw new Error('Integration not found');
                }

                // Delete from our backend
                // Note: Connection will remain in Composio but will become inactive
                // Backend can handle revoking the connection if needed
                await deleteIntegration(connector);

                toast.success(
                    `${connector === 'gmail' ? 'Gmail' : 'Google Calendar'} disconnected successfully!`
                );

                // Reload integrations
                await loadIntegrations();
            } catch (error: unknown) {
                if (error instanceof Error) {
                    const errorMessage = error.message || 'Failed to disconnect integration';
                    setIntegrationsError(errorMessage);
                    toast.error(errorMessage);
                    console.error('Error disconnecting integration:', error);
                } else {
                    const errorMessage = 'Failed to disconnect integration';
                    setIntegrationsError(errorMessage);
                    toast.error(errorMessage);
                    console.error('Error disconnecting integration:', error);
                }
            } finally {
                setIntegrationsLoading(false);
            }
        },
        [integrations, loadIntegrations]
    );

    return {
        integrations,
        integrationsLoading,
        integrationsError,
        loadIntegrations,
        connectIntegration,
        disconnectIntegration,
    };
};
