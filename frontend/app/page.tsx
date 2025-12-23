'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
    const router = useRouter();

    useEffect(() => {
        router.push('/chat');
    }, [router]);

    // TODO: Change this to the Brain icon that we're using for Supermind, and add some animated effect to show loading
    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
                <p className="mt-4 text-sm text-slate-500">Redirecting...</p>
            </div>
        </div>
    );
}
