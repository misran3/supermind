import ChatSessionClient from './ChatSessionClient';
import { use } from 'react';

interface ChatSessionPageProps {
    params: Promise<{
        sessionId: string;
    }>;
}

// Generate at least one static route to satisfy export requirement
// All other sessionIds handled client-side via Amplify redirect rules
export function generateStaticParams() {
    return [{ sessionId: 'default' }];
}

// Server component - handles route config
export default function ChatSessionPage({ params }: ChatSessionPageProps) {
    const { sessionId } = use(params);
    return <ChatSessionClient sessionId={sessionId} />;
}
