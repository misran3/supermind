import { fetchAuthSession } from 'aws-amplify/auth';
import { useCallback } from 'react';

export interface AuthTokensStr {
    idToken: string;
    accessToken: string;
}

/**
 * Lightweight hook to fetch Cognito JWT access token.
 *
 * This complements the existing AuthContext which manages user state.
 * Use this when you need the actual JWT token for API authorization headers.
 *
 * @returns {Function} getToken - Async function that returns the current access token
 *
 * @example
 * const getToken = useAuthToken();
 *
 * // In an async function:
 * const token = await getToken();
 * fetch(url, { headers: { Authorization: `Bearer ${token}` } });
 */
export const useAuthToken = () => {
    const getToken = useCallback(async (): Promise<AuthTokensStr> => {
        try {
            const session = await fetchAuthSession();

            if (!session.tokens?.accessToken || !session.tokens.idToken) {
                throw new Error('No id or access token available. User may not be authenticated.');
            }

            return {
                idToken: session.tokens.idToken.toString(),
                accessToken: session.tokens.accessToken.toString(),
            };
        } catch (error) {
            console.error('[useAuthToken] Failed to fetch token:', error);
            throw error;
        }
    }, []);

    return getToken;
};
