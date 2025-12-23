'use client';

import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useChatHistory } from '@/src/hooks/useChatHistory';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { Brain } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ChatPage() {
    const router = useRouter();
    const { sessions, sessionsLoading, loadSessions, createNewSession } = useChatHistory();
    const { profile, profileLoading, profileError, loadProfile } = useUserProfile();
    const [hasRedirected, setHasRedirected] = useState(false);
    const [isCreatingSession, setIsCreatingSession] = useState(false);

    useEffect(() => {
        // Load profile and sessions when component mounts - only once
        console.log('[ChatPage] Loading profile and sessions...');
        loadProfile();
        loadSessions({ archived: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const handleRedirect = async () => {
            // Prevent multiple redirects
            if (hasRedirected) {
                console.log('[ChatPage] Already redirected, skipping...');
                return;
            }

            // Wait for both profile and sessions to load
            if (profileLoading || sessionsLoading) {
                console.log('[ChatPage] Still loading...', { profileLoading, sessionsLoading });
                return;
            }

            // Don't redirect if we're already creating a session
            if (isCreatingSession) {
                console.log('[ChatPage] Creating session, waiting...');
                return;
            }

            console.log('[ChatPage] Profile:', profile);
            console.log('[ChatPage] Profile Error:', profileError);
            console.log('[ChatPage] Sessions count:', sessions.length);

            // Check if profile doesn't exist (404 error)
            if (!profile) {
                if (profileError) {
                    // Profile fetch failed - check if it's a 404 (profile doesn't exist)
                    const is404 = profileError.includes('Profile not found (404)');
                    if (is404) {
                        console.log('[ChatPage] Profile not found (404), redirecting to onboarding');
                        setHasRedirected(true);
                        router.push('/onboarding');
                        return;
                    } else {
                        // Other error - don't redirect, just show error
                        console.error('[ChatPage] Failed to load profile (non-404):', profileError);
                        toast.error(`Failed to load profile: ${profileError}`);
                        setHasRedirected(true); // Prevent retry loop
                        return;
                    }
                } else {
                    // Profile is null but no error yet - still loading or empty response
                    console.log('[ChatPage] Profile is null but no error - waiting...');
                    return;
                }
            }

            // If profile exists but no sessions, create one
            if (sessions.length === 0) {
                console.log('[ChatPage] Profile exists but no sessions, creating Welcome Chat...');
                setHasRedirected(true);
                setIsCreatingSession(true);
                try {
                    const newSession = await createNewSession({
                        title: 'Welcome Chat',
                    });
                    if (newSession) {
                        console.log('[ChatPage] Welcome Chat created, redirecting...');
                        router.push(`/chat/${newSession.sessionId}`);
                    } else {
                        console.error('[ChatPage] Failed to create session');
                        toast.error('Failed to create chat session');
                        setHasRedirected(false); // Allow retry
                    }
                } catch (error) {
                    console.error('[ChatPage] Error creating session:', error);
                    toast.error('Failed to create chat session');
                    setHasRedirected(false); // Allow retry
                } finally {
                    setIsCreatingSession(false);
                }
                return;
            }

            // Profile exists and has sessions, redirect to most recent
            const mostRecentSession = sessions[0];
            console.log('[ChatPage] Redirecting to most recent session:', mostRecentSession.sessionId);
            setHasRedirected(true);
            router.push(`/chat/${mostRecentSession.sessionId}`);
        };

        handleRedirect();
    }, [profile, profileLoading, profileError, sessions, sessionsLoading, hasRedirected, isCreatingSession, router, createNewSession, loadProfile, loadSessions]);

    const getLoadingMessage = () => {
        if (profileLoading || sessionsLoading) {
            return 'Loading...';
        }
        if (isCreatingSession) {
            return 'Creating your first chat...';
        }
        return 'Redirecting...';
    };

    return (
        <ProtectedRoute>
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-4 animate-pulse">
                        <Brain size={24} />
                    </div>
                    <p className="text-sm text-slate-500">{getLoadingMessage()}</p>
                </div>
            </div>
        </ProtectedRoute>
    );
}
