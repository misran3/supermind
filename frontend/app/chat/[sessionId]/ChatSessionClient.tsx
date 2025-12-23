'use client';

import { ChatView } from '@/src/views/ChatView';
import { ProtectedRoute } from '@/src/components/auth/ProtectedRoute';
import { useRouter } from 'next/navigation';

interface ChatSessionClientProps {
    sessionId: string;
}

export default function ChatSessionClient({ sessionId }: ChatSessionClientProps) {
    const router = useRouter();

    return (
        <ProtectedRoute>
            <ChatView
                sessionId={sessionId}
                onNavigate={(view) => {
                    // Map view states to routes
                    if (view === 'profile') {
                        router.push('/profile');
                    } else if (view === 'auth') {
                        router.push('/auth/login');
                    }
                }}
            />
        </ProtectedRoute>
    );
}
