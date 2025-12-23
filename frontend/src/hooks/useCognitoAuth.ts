import {
    signOut as amplifySignOut,
    AuthUser,
    confirmSignIn,
    confirmSignUp,
    getCurrentUser,
    signIn,
    SignInOutput,
    signUp,
} from 'aws-amplify/auth';
import { useCallback, useState } from 'react';

export type AuthStep =
    | 'IDLE'
    | 'OTP_SENT' // Login Code Sent
    | 'EMAIL_VERIFY_SENT' // New Account Verification Code Sent
    | 'AUTHENTICATED';

interface UseCognitoAuthReturn {
    authStep: AuthStep;
    isLoading: boolean;
    error: string | null;
    user: AuthUser | null;
    initiateAuth: (email: string) => Promise<void>;
    verifyOtp: (otp: string) => Promise<void>;
    signOut: () => Promise<void>;
    resetAuth: () => void;
}

export const useCognitoAuth = (): UseCognitoAuthReturn => {
    const [authStep, setAuthStep] = useState<AuthStep>('IDLE');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<AuthUser | null>(null);

    // Store email temporarily in state for the multi-step process
    const [tempEmail, setTempEmail] = useState('');

    // Helper to handle the Sign In response
    // IMPORTANT: Defined BEFORE initiateAuth so it's available in the closure
    const handleSignInNextStep = useCallback((output: SignInOutput) => {
        console.log('[Auth] handleSignInNextStep called with output:', output);
        const step = output.nextStep.signInStep;
        console.log('[Auth] Next step is:', step);

        // Check for the OTP challenge
        if (step === 'CONFIRM_SIGN_IN_WITH_EMAIL_CODE') {
            console.log('[Auth] Setting authStep to OTP_SENT');
            setAuthStep('OTP_SENT');
        }
        else if (step === 'CONFIRM_SIGN_IN_WITH_TOTP_CODE') {
            console.log('[Auth] Setting authStep to OTP_SENT');
            setAuthStep('OTP_SENT');
        } else if (step === 'CONFIRM_SIGN_IN_WITH_CUSTOM_CHALLENGE') {
            // Fallback if configured differently
            console.log('[Auth] Custom challenge detected, setting authStep to OTP_SENT');
            setAuthStep('OTP_SENT');
        } else if (step === 'DONE') {
            console.log('[Auth] Authentication complete, setting authStep to AUTHENTICATED');
            setAuthStep('AUTHENTICATED');
        } else {
            console.warn('[Auth] Unexpected Step:', step);
            console.warn('[Auth] Full output:', JSON.stringify(output, null, 2));
            setError(`Unexpected login step: ${step}. Please check console.`);
        }
    }, []);

    // --- 1. INITIATE AUTH (Smart Login/Signup) ---
    const initiateAuth = useCallback(async (email: string) => {
        console.log('[Auth] Initiating authentication for:', email);
        setIsLoading(true);
        setError(null);
        setTempEmail(email);

        try {
            // A: Try to Sign In with USER_AUTH (Native Email OTP)
            console.log('[Auth] Calling signIn with USER_AUTH and EMAIL_OTP...');
            const output = await signIn({
                username: email,
                options: {
                    authFlowType: 'USER_AUTH', // <--- CRITICAL for Native Passwordless
                    preferredChallenge: 'EMAIL_OTP',
                },
            });

            // Mock output for debugging
            // console.log('[Auth] Mocking signIn output for debugging...');
            // const output: SignInOutput = {
            //     isSignedIn: false,
            //     nextStep: {
            //         signInStep: 'CONFIRM_SIGN_IN_WITH_TOTP_CODE', // or 'DONE'
            //     },
            // };

            console.log('[Auth] Sign In Output:', output);
            console.log('[Auth] Sign In Next Step:', output.nextStep.signInStep);

            handleSignInNextStep(output);
        } catch (err: unknown) {
            console.error('[Auth] Error in initiateAuth:', err);
            if (err instanceof Error) {
                console.error('[Auth] Error name:', err.name);
                console.error('[Auth] Error message:', err.message);

                // B: If User Not Found, Trigger Sign Up
                if (err.name === 'UserNotFoundException') {
                    console.log('[Auth] User not found, switching to Sign Up...');
                    try {
                        const signUpOutput = await signUp({
                            username: email,
                            options: {
                                userAttributes: { email },
                            },
                        });

                        console.log('[Auth] Sign Up Output:', signUpOutput);
                        console.log('[Auth] Sign Up Next Step:', signUpOutput.nextStep.signUpStep);

                        if (signUpOutput.nextStep.signUpStep === 'CONFIRM_SIGN_UP') {
                            console.log('[Auth] Setting authStep to EMAIL_VERIFY_SENT');
                            setAuthStep('EMAIL_VERIFY_SENT');
                        }
                    } catch (signUpErr: unknown) {
                        if (signUpErr instanceof Error) {
                            console.error('[Auth] Sign Up Error:', signUpErr);
                            setError(signUpErr.message || 'Failed to create account.');
                        } else {
                            console.error('[Auth] Sign Up Error:', signUpErr);
                            setError('Unknown error occurred. Failed to create account.');
                        }
                    }
                } else {
                    // Not a UserNotFoundException, set error
                    setError(err.message || 'Authentication failed.');
                }
            } else {
                console.error('[Auth] Unknown error type:', err);
                setError('Unknown error occurred. Authentication failed.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [handleSignInNextStep]);

    // --- 2. VERIFY CODE (Handles both Login OTP and Signup Verification) ---
    const verifyOtp = useCallback(
        async (otp: string) => {
            console.log('[Auth] Verifying OTP, current authStep:', authStep);
            setIsLoading(true);
            setError(null);

            try {
                if (authStep === 'OTP_SENT') {
                    // CASE A: Verifying a Login OTP
                    console.log('[Auth] Confirming sign in with OTP...');
                    const output = await confirmSignIn({ challengeResponse: otp });

                    console.log('[Auth] Confirm Sign In Output:', output);

                    if (output.nextStep.signInStep === 'DONE') {
                        console.log('[Auth] Sign in complete, getting current user...');
                        const currentUser = await getCurrentUser();
                        setUser(currentUser);
                        setAuthStep('AUTHENTICATED');
                    } else {
                        console.warn('[Auth] Sign in not complete, next step:', output.nextStep.signInStep);
                        setError('Verification incomplete. Additional steps required.');
                    }
                } else if (authStep === 'EMAIL_VERIFY_SENT') {
                    // CASE B: Verifying a New Account (Confirm Sign Up)
                    console.log('[Auth] Confirming sign up...');
                    await confirmSignUp({
                        username: tempEmail,
                        confirmationCode: otp,
                    });

                    console.log('[Auth] Sign up confirmed, now triggering login...');

                    // Account is confirmed. Now we must trigger the Login OTP flow.
                    // (Native Cognito Passwordless doesn't auto-login after signup confirmation)
                    setError(null);

                    // Trigger Login immediately
                    const loginOutput = await signIn({
                        username: tempEmail,
                        options: {
                            authFlowType: 'USER_AUTH',
                            preferredChallenge: 'EMAIL_OTP',
                        },
                    });

                    console.log('[Auth] Login after signup output:', loginOutput);
                    handleSignInNextStep(loginOutput);
                    // Note: The user will likely receive a SECOND email here (the login OTP).
                    // You might want to show a toast message: "Account Verified! Sending Login Code..."
                }
            } catch (err: unknown) {
                if (err instanceof Error) {
                    console.error('[Auth] Verify Error:', err);
                    setError(err.message || 'Invalid code. Please try again.');
                } else {
                    console.error('[Auth] Verify Error:', err);
                    setError('Unknown error occurred during verification.');
                }
            } finally {
                setIsLoading(false);
            }
        },
        [authStep, tempEmail, handleSignInNextStep]
    );

    const signOut = useCallback(async () => {
        try {
            await amplifySignOut();
            setUser(null);
            setAuthStep('IDLE');
        } catch (err) {
            console.error(err);
        }
    }, []);

    const resetAuth = useCallback(() => {
        setAuthStep('IDLE');
        setError(null);
        setTempEmail('');
    }, []);

    return { authStep, isLoading, error, user, initiateAuth, verifyOtp, signOut, resetAuth };
};
