/**
 * User Profile Service
 *
 * Handles CRUD operations for user profiles and app settings.
 * Uses API Gateway with Cognito Authorizer.
 */

import { Logger } from '@aws-lambda-powertools/logger';
import type { UserAppSettings, UserProfile } from '@supermind/shared-aws-utils';
import { ChatHistoryClient, createResponse, UsersClient } from '@supermind/shared-aws-utils';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { generateOnboardingMessage } from '@supermind/assistant';

// Initialize Logger
const logger = new Logger({
    serviceName: 'user-profile-service',
});

/**
 * Extract userId from Cognito authorizer context
 * For REST API with Cognito User Pool authorizer, claims are at:
 * event.requestContext.authorizer.claims
 */
function getUserIdFromEvent(event: APIGatewayProxyEvent): string {
    const claims = event.requestContext.authorizer?.claims;
    const userId = claims?.sub;
    if (!userId) {
        throw new Error('Unauthorized: No user ID found in token');
    }
    return userId as string;
}

/**
 * Parse and validate JSON body
 */
function parseBody<T>(body: string | null | undefined): T {
    if (!body) {
        throw new Error('Request body is required');
    }
    try {
        return JSON.parse(body) as T;
    } catch (error) {
        throw new Error('Invalid JSON in request body');
    }
}

/**
 * Main Lambda handler
 */
export const handler = async (
    event: APIGatewayProxyEvent,
    context: Context
): Promise<APIGatewayProxyResult> => {
    logger.addContext(context);

    try {
        const userId = getUserIdFromEvent(event);
        const method = event.httpMethod;
        const path = event.path;

        logger.info('Processing request', { method, path, userId });

        // Route to appropriate handler
        if (path.includes('/profile')) {
            return await handleProfileRoutes(event, userId, method);
        } else if (path.includes('/settings')) {
            return await handleSettingsRoutes(event, userId, method);
        }

        return createResponse(404, { error: 'Route not found' });
    } catch (error: any) {
        logger.error('Error processing request', { error: error.message, stack: error.stack });

        if (error.message.includes('Unauthorized')) {
            return createResponse(401, { error: error.message });
        }

        if (error.message.includes('not found')) {
            return createResponse(404, { error: error.message });
        }

        if (error.message.includes('already exists') || error.message.includes('Invalid')) {
            return createResponse(400, { error: error.message });
        }

        return createResponse(500, { error: 'Internal server error' });
    }
};

/**
 * Handle profile routes
 */
async function handleProfileRoutes(
    event: APIGatewayProxyEvent,
    userId: string,
    method: string
): Promise<APIGatewayProxyResult> {
    switch (method) {
        case 'GET':
            return await getProfile(userId);
        case 'POST':
            return await createProfile(event, userId);
        case 'PUT':
            return await updateProfile(event, userId);
        case 'DELETE':
            return await deleteProfile(userId);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

/**
 * Handle settings routes
 */
async function handleSettingsRoutes(
    event: APIGatewayProxyEvent,
    userId: string,
    method: string
): Promise<APIGatewayProxyResult> {
    switch (method) {
        case 'GET':
            return await getSettings(userId);
        case 'PUT':
            return await updateSettings(event, userId);
        case 'DELETE':
            return await deleteSettings(userId);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

// ============================================
// Profile Handlers
// ============================================

/**
 * GET /profile - Get user profile
 */
async function getProfile(userId: string): Promise<APIGatewayProxyResult> {
    logger.info('Getting profile', { userId });

    const profile = await UsersClient.getUserProfile(userId);

    if (!profile) {
        return createResponse(404, { error: 'Profile not found' });
    }

    return createResponse(200, profile);
}

/**
 * POST /profile - Create user profile
 *
 * Business Logic:
 * - Email must be unique
 * - Auto-create app settings with defaults
 * - Auto-create first web session
 */
async function createProfile(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Creating profile', { userId });

    const body = parseBody<Partial<UserProfile>>(event.body);

    // Validate required fields
    if (!body.email) {
        return createResponse(400, { error: 'Email is required' });
    }

    // Check if email is already taken
    const existingProfile = await UsersClient.getUserProfileByEmail(body.email);
    if (existingProfile) {
        return createResponse(400, { error: 'Email already exists' });
    }

    // Create profile
    const profile = await UsersClient.createUserProfile({
        userId,
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        nickname: body.nickname,
        phoneNumber: body.phoneNumber,
        timezone: body.timezone || 'America/New_York',
        supermemoryProfileCreated: false,
        whatsAppOptIn: body.whatsAppOptIn || false,
    });

    // Auto-create app settings with defaults
    try {
        await UsersClient.createAppSettings({
            userId,
            toneOfResponse: 'professional and friendly',
            whatsAppNotificationsEnabled: false,
        });
        logger.info('App settings created', { userId });
    } catch (error: any) {
        logger.warn('Failed to create app settings', { userId, error: error.message });
    }

    // Auto-create first web session
    try {
        const session = await ChatHistoryClient.createWebSession({
            userId,
            sessionId: `${userId}-${Date.now()}`,
            title: 'Welcome Chat',
        });
        logger.info('First web session created', { userId });

        // Generate onboarding greeting message
        try {
            const fullName = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
            const greeting = await generateOnboardingMessage(
                userId,
                session.sessionId,
                fullName,
                profile.nickname,
                process.env.SUPERMEMORY_API_KEY!,
            );

            await ChatHistoryClient.createMessage({
                userId,
                messageId: `msg-${Date.now()}`,
                sessionId: session.sessionId,
                direction: 'outbound',
                sender: 'assistant',
                content: greeting,
                sentAt: new Date().toISOString(),
                processingStatus: 'sent',
            });
            
        } catch (error: any) {
            logger.warn('Failed to generate onboarding message and store it', { userId, error: error.message });
        }
    } catch (error: any) {
        logger.warn('Failed to create first web session', { userId, error: error.message });
    }


    return createResponse(201, profile);
}

/**
 * PUT /profile - Update user profile
 */
async function updateProfile(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Updating profile', { userId });

    const body = parseBody<Partial<UserProfile>>(event.body);

    // If email is being updated, check uniqueness
    if (body.email) {
        const existingProfile = await UsersClient.getUserProfileByEmail(body.email);
        if (existingProfile && existingProfile.userId !== userId) {
            return createResponse(400, { error: 'Email already exists' });
        }
    }

    const profile = await UsersClient.updateUserProfile(userId, body);

    return createResponse(200, profile);
}

/**
 * DELETE /profile - Delete user profile
 */
async function deleteProfile(userId: string): Promise<APIGatewayProxyResult> {
    logger.info('Deleting profile', { userId });

    await UsersClient.deleteUserProfile(userId);

    // Also delete app settings if they exist
    try {
        await UsersClient.deleteAppSettings(userId);
        logger.info('App settings deleted', { userId });
    } catch (error: any) {
        logger.warn('Failed to delete app settings', { userId, error: error.message });
    }

    return createResponse(204, '');
}

// ============================================
// Settings Handlers
// ============================================

/**
 * GET /settings - Get app settings
 */
async function getSettings(userId: string): Promise<APIGatewayProxyResult> {
    logger.info('Getting settings', { userId });

    const settings = await UsersClient.getAppSettings(userId);

    if (!settings) {
        return createResponse(404, { error: 'Settings not found' });
    }

    return createResponse(200, settings);
}

/**
 * PUT /settings - Update app settings
 */
async function updateSettings(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Updating settings', { userId });

    const body = parseBody<Partial<UserAppSettings>>(event.body);

    const settings = await UsersClient.upsertAppSettings({
        userId,
        toneOfResponse: body.toneOfResponse,
        whatsAppNotificationsEnabled: body.whatsAppNotificationsEnabled ?? false,
    });

    return createResponse(200, settings);
}

/**
 * DELETE /settings - Delete app settings
 */
async function deleteSettings(userId: string): Promise<APIGatewayProxyResult> {
    logger.info('Deleting settings', { userId });

    await UsersClient.deleteAppSettings(userId);

    return createResponse(204, '');
}
