import { Button } from '@/src/components/common/Button';
import { TextInput } from '@/src/components/common/TextInput';
import { Brain, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCognitoAuth } from '@/src/hooks/useCognitoAuth';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/contexts/AuthContext';
import { fetchProfile } from '@/src/services/user-profile.service';
import Link from 'next/link';

export const LoginView = () => {
    const router = useRouter();
    const { setUser } = useAuth();

    const { authStep, isLoading, error, user, initiateAuth, verifyOtp, resetAuth } = useCognitoAuth();

    // Sync hook success state with auth context and check for profile
    useEffect(() => {
        const checkProfileAndRedirect = async () => {
            console.log('[LoginView] authStep changed to:', authStep);
            if (authStep === 'AUTHENTICATED' && user) {
                console.log('[LoginView] Setting user in auth context');
                setUser(user);

                // Check if user has a profile
                try {
                    const profile = await fetchProfile();
                    if (profile) {
                        console.log('[LoginView] Profile exists, redirecting to /chat');
                        router.push('/chat');
                    } else {
                        console.log('[LoginView] No profile found, redirecting to /onboarding');
                        router.push('/onboarding');
                    }
                } catch (error) {
                    console.error('[LoginView] Error fetching profile:', error);
                    // If profile doesn't exist (404), redirect to onboarding
                    console.log('[LoginView] No profile found (error), redirecting to /onboarding');
                    router.push('/onboarding');
                }
            }
        };

        checkProfileAndRedirect();
    }, [authStep, user, router, setUser]);

    // Debug logging for error state
    useEffect(() => {
        if (error) {
            console.error('[LoginView] Error state:', error);
        }
    }, [error]);

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-600 text-white mb-4 shadow-lg shadow-indigo-600/20">
                        <Brain size={24} />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Supermind</h1>
                    <p className="text-slate-500 mt-2">Your second brain, designed for clarity.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 space-y-6">
                    {/* Error Display */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}

                    {authStep === 'IDLE' ? (
                        /* STEP 1: EMAIL ENTRY */
                        <div className="space-y-4 animate-fadeIn">
                            <TextInput
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />

                            <div className="space-y-3 pt-2">
                                <Button
                                    fullWidth
                                    onClick={() => {
                                        console.log('[LoginView] Button clicked, calling initiateAuth with email:', email);
                                        initiateAuth(email);
                                    }}
                                    disabled={isLoading || !email}
                                >
                                    {isLoading ? 'Sending Code...' : 'Continue with Email'}
                                </Button>

                                <div className="relative">
                                    <div className="absolute inset-0 flex items-center">
                                        <span className="w-full border-t border-slate-200" />
                                    </div>
                                    <div className="relative flex justify-center text-xs uppercase">
                                        <span className="bg-white px-2 text-slate-500">Or continue with</span>
                                    </div>
                                </div>

                                <Button variant="outline" fullWidth disabled className="opacity-60 cursor-not-allowed">
                                    <svg
                                        className="mr-2 h-4 w-4 grayscale opacity-50"
                                        aria-hidden="true"
                                        focusable="false"
                                        data-prefix="fab"
                                        data-icon="google"
                                        role="img"
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 488 512"
                                    >
                                        <path
                                            fill="currentColor"
                                            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
                                        ></path>
                                    </svg>
                                    Google (Coming Soon)
                                </Button>
                            </div>

                            <p className="text-center mt-6 text-sm text-slate-500">
                                {"Don't have an account? "}
                                <Link
                                    href="/auth/register"
                                    className="font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
                                >
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    ) : (
                        /* STEP 2: OTP ENTRY */
                        <div className="space-y-6 animate-fadeIn">
                            <div className="text-center space-y-2">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mb-2">
                                    <Sparkles size={24} />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900">Check your email</h2>
                                <p className="text-sm text-slate-500">
                                    {"We've sent an 8-digit login code to"} <br />
                                    <span className="font-medium text-slate-900">{email}</span>
                                </p>
                            </div>

                            <div className="space-y-2">
                                <input
                                    type="text"
                                    maxLength={8}
                                    className="w-full px-3 py-4 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-300 text-slate-900 text-center text-3xl tracking-[0.5em] font-mono shadow-inner"
                                    placeholder="00000000"
                                    value={otp}
                                    onChange={(e) => {
                                        const val = e.target.value.replace(/\D/g, '');
                                        setOtp(val);
                                    }}
                                    autoFocus
                                />
                                <p className="text-xs text-center text-slate-400">Enter the 8-digit code from your email</p>
                            </div>

                            <div className="space-y-3">
                                <Button fullWidth onClick={() => verifyOtp(otp)} disabled={isLoading || otp.length !== 8}>
                                    {isLoading ? 'Verifying...' : 'Verify Code'}
                                </Button>
                                <Button variant="ghost" fullWidth onClick={resetAuth} disabled={isLoading}>
                                    Use a different email
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
