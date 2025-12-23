import { Button } from '@/src/components/common/Button';
import { TextInput } from '@/src/components/common/TextInput';
import { Brain, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useUserProfile } from '@/src/hooks/useUserProfile';
import { useAuth } from '@/src/contexts/AuthContext';
import { fetchUserAttributes } from 'aws-amplify/auth';
import toast from 'react-hot-toast';

interface OnboardingViewProps {
    onComplete: () => void;
}

export const OnboardingView = ({ onComplete }: OnboardingViewProps) => {
    const { user } = useAuth();
    const { createUserProfile, profileLoading } = useUserProfile();

    // Form state
    const [email, setEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [nickname, setNickname] = useState('');

    // Load user email from Cognito
    useEffect(() => {
        const loadUserEmail = async () => {
            try {
                const attributes = await fetchUserAttributes();
                if (attributes.email) {
                    setEmail(attributes.email);
                }
            } catch (error) {
                console.error('Failed to load user email:', error);
            }
        };
        if (user) {
            loadUserEmail();
        }
    }, [user]);

    const handleSubmit = async () => {
        // Validate required fields
        if (!firstName.trim() || !lastName.trim() || !email.trim()) {
            toast.error('First Name, Last Name, and Email are required');
            return;
        }

        try {
            const result = await createUserProfile({
                email,
                firstName,
                lastName,
                nickname: nickname || undefined,
            });

            if (result) {
                toast.success('Profile created successfully!');
                onComplete();
            } else {
                toast.error('Failed to create profile. Please try again.');
            }
        } catch (error) {
            console.error('Error creating profile:', error);
            toast.error('An error occurred. Please try again.');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-600/20">
                        <Brain size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Complete Your Profile</h1>
                    <p className="text-slate-500 mt-2">Just a few details to get you started</p>
                </div>

                {/* Form */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8">
                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Email <span className="text-red-500">*</span>
                            </label>
                            <TextInput
                                type="email"
                                placeholder="your@email.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={!!email}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    First Name <span className="text-red-500">*</span>
                                </label>
                                <TextInput
                                    placeholder="John"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-2">
                                    Last Name <span className="text-red-500">*</span>
                                </label>
                                <TextInput
                                    placeholder="Doe"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-2">
                                Nickname <span className="text-slate-400">(optional)</span>
                            </label>
                            <TextInput
                                placeholder="What should we call you?"
                                value={nickname}
                                onChange={(e) => setNickname(e.target.value)}
                            />
                        </div>

                        <div className="pt-4">
                            <Button
                                fullWidth
                                onClick={handleSubmit}
                                icon={Check}
                                disabled={profileLoading || !firstName.trim() || !lastName.trim() || !email.trim()}
                            >
                                {profileLoading ? 'Creating Profile...' : 'Complete Setup'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
