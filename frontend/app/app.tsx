import { useState } from 'react';

import { ViewState } from '@/src/types/types';
import { AuthView } from '@/src/views/AuthView';
import { ChatView } from '@/src/views/ChatView';
import { OnboardingView } from '@/src/views/OnboardingView';
import { ProfileView } from '@/src/views/ProfileView';

export default function App() {
    const [currentView, setCurrentView] = useState<ViewState>('auth');

    // Navigation handlers
    const handleLogin = () => setCurrentView('onboarding');
    const handleOnboardingComplete = () => setCurrentView('chat');
    const handleLogout = () => setCurrentView('auth');

    return (
        <div className="font-sans antialiased text-slate-900 bg-slate-50">
            {currentView === 'auth' && <AuthView onLogin={handleLogin} />}
            {currentView === 'onboarding' && <OnboardingView onComplete={handleOnboardingComplete} />}
            {currentView === 'chat' && <ChatView onNavigate={setCurrentView} />}
            {currentView === 'profile' && <ProfileView onBack={() => setCurrentView('chat')} onLogout={handleLogout} />}
        </div>
    );
}
