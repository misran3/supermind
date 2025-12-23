'use client';

import { OnboardingView } from '@/src/views/OnboardingView';
import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <OnboardingView
                onComplete={() => {
                    // After profile creation, redirect to chat
                    router.push('/chat');
                }}
            />
        </ProtectedRoute>
    );
}
