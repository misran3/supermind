'use client';

import { Amplify } from 'aws-amplify';
import { useEffect } from 'react';

export default function AmplifyConfig() {
    useEffect(() => {
        if (!(process.env.NEXT_PUBLIC_USER_POOL_ID && process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID)) {
            throw new Error(
                'Cognito configuration environment variables are missing. Please set NEXT_PUBLIC_USER_POOL_ID and NEXT_PUBLIC_USER_POOL_CLIENT_ID in your .env file.'
            );
        }

        Amplify.configure({
            Auth: {
                Cognito: {
                    userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID,
                    userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID,
                    loginWith: {
                        email: true,
                    },
                },
            },
        });
    }, []);

    return null;
}
