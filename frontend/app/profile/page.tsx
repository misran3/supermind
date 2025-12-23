'use client';

import { ProfileView } from '@/src/views/ProfileView';
import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import { useRouter } from 'next/navigation';
import { useCognitoAuth } from '@/src/hooks/useCognitoAuth';
import { useAuth } from '@/src/contexts/AuthContext';

export default function ProfilePage() {
    const router = useRouter();
    const { signOut } = useCognitoAuth();
    const { setUser } = useAuth();

    const handleLogout = async () => {
        try {
            await signOut();
            setUser(null);
            router.push('/auth/login');
        } catch (error) {
            console.error('[ProfilePage] Logout error:', error);
        }
    };

    return (
        <ProtectedRoute>
            <ProfileView onBack={() => router.push('/chat')} onLogout={handleLogout} />
        </ProtectedRoute>
    );
}
