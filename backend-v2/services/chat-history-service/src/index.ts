/**
 * Chat History Service
 *
 * Handles CRUD operations for chat sessions and messages.
 * Uses API Gateway with Cognito Authorizer.
 */

import { Logger } from '@aws-lambda-powertools/logger';
import type { ChatMessage, WebSessionMetadata } from '@supermind/shared-aws-utils';
import { ChatHistoryClient, createResponse } from '@supermind/shared-aws-utils';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Initialize Logger
const logger = new Logger({
    serviceName: 'chat-history-service',
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
function parseBody<T>(body: string | undefined | null): T {
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
 * Extract path parameters
 */
function getPathParam(event: APIGatewayProxyEvent, paramName: string): string | undefined {
    return event.pathParameters?.[paramName];
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

        // Determine if this is a message or session route
        const sessionId = getPathParam(event, 'sessionId');
        const messageId = getPathParam(event, 'messageId');

        if (messageId || path.includes('/messages')) {
            return await handleMessageRoutes(event, userId, method, sessionId);
        } else {
            return await handleSessionRoutes(event, userId, method, sessionId);
        }
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
 * Handle session routes
 */
async function handleSessionRoutes(
    event: APIGatewayProxyEvent,
    userId: string,
    method: string,
    sessionId?: string
): Promise<APIGatewayProxyResult> {
    // List or get session
    if (method === 'GET') {
        if (sessionId) {
            return await getSession(userId, sessionId);
        } else {
            return await listSessions(event, userId);
        }
    }

    // Create new session
    if (method === 'POST' && !sessionId) {
        return await createSession(event, userId);
    }

    // Update or delete specific session
    if (sessionId) {
        switch (method) {
            case 'PUT':
                return await updateSession(event, userId, sessionId);
            case 'DELETE':
                return await deleteSession(userId, sessionId);
            default:
                return createResponse(405, { error: 'Method not allowed' });
        }
    }

    return createResponse(400, { error: 'Invalid request' });
}

/**
 * Handle message routes
 */
async function handleMessageRoutes(
    event: APIGatewayProxyEvent,
    userId: string,
    method: string,
    sessionId?: string
): Promise<APIGatewayProxyResult> {
    if (!sessionId) {
        return createResponse(400, { error: 'Session ID is required' });
    }

    const messageId = getPathParam(event, 'messageId');

    switch (method) {
        case 'GET':
            if (messageId) {
                return await getMessage(userId, sessionId, messageId);
            } else {
                return await listMessages(event, userId, sessionId);
            }
        case 'POST':
            return await createMessage(event, userId, sessionId);
        case 'PUT':
            if (!messageId) {
                return createResponse(400, { error: 'Message ID is required' });
            }
            return await updateMessage(event, userId, sessionId, messageId);
        case 'DELETE':
            if (!messageId) {
                return createResponse(400, { error: 'Message ID is required' });
            }
            return await deleteMessage(userId, sessionId, messageId);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

// ============================================
// Session Handlers
// ============================================

/**
 * GET /sessions - List sessions
 */
async function listSessions(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Listing sessions', { userId });

    const limit = event.queryStringParameters?.limit
        ? parseInt(event.queryStringParameters.limit)
        : undefined;
    const archived = event.queryStringParameters?.archived
        ? event.queryStringParameters.archived === 'true'
        : undefined;

    const sessions = await ChatHistoryClient.listWebSessions(userId, limit, archived);

    return createResponse(200, {items: sessions});
}

/**
 * GET /sessions/:sessionId - Get session
 */
async function getSession(userId: string, sessionId: string): Promise<APIGatewayProxyResult> {
    logger.info('Getting session', { userId, sessionId });

    const session = await ChatHistoryClient.getWebSession(userId, sessionId);

    if (!session) {
        return createResponse(404, { error: 'Session not found' });
    }

    return createResponse(200, session);
}

/**
 * POST /sessions - Create session
 */
async function createSession(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Creating session', { userId });

    const body = parseBody<Partial<WebSessionMetadata>>(event.body);

    // Generate sessionId if not provided
    const sessionId = body.sessionId || `${userId}-${Date.now()}`;

    const session = await ChatHistoryClient.createWebSession({
        userId,
        sessionId,
        title: body.title || 'New Chat',
    });

    return createResponse(201, session);
}

/**
 * PUT /sessions/:sessionId - Update session
 */
async function updateSession(
    event: APIGatewayProxyEvent,
    userId: string,
    sessionId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Updating session', { userId, sessionId });

    const body = parseBody<Partial<WebSessionMetadata>>(event.body);

    const session = await ChatHistoryClient.updateWebSession(userId, sessionId, body);

    return createResponse(200, session);
}

/**
 * DELETE /sessions/:sessionId - Delete session
 */
async function deleteSession(userId: string, sessionId: string): Promise<APIGatewayProxyResult> {
    logger.info('Deleting session', { userId, sessionId });

    await ChatHistoryClient.deleteWebSession(userId, sessionId);

    return createResponse(204, '');
}

// ============================================
// Message Handlers
// ============================================

/**
 * GET /sessions/:sessionId/messages - List messages
 */
async function listMessages(
    event: APIGatewayProxyEvent,
    userId: string,
    sessionId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Listing messages', { userId, sessionId });

    const limit = event.queryStringParameters?.limit
        ? parseInt(event.queryStringParameters.limit)
        : undefined;

    const result = await ChatHistoryClient.listMessages(userId, sessionId, limit);

    return createResponse(200, { items: result.messages, lastEvaluatedKey: result.lastEvaluatedKey });
}

/**
 * GET /sessions/:sessionId/messages/:messageId - Get message
 */
async function getMessage(
    userId: string,
    sessionId: string,
    messageId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Getting message', { userId, sessionId, messageId });

    const message = await ChatHistoryClient.getMessage(userId, sessionId, messageId);

    if (!message) {
        return createResponse(404, { error: 'Message not found' });
    }

    return createResponse(200, message);
}

/**
 * POST /sessions/:sessionId/messages - Create message
 */
async function createMessage(
    event: APIGatewayProxyEvent,
    userId: string,
    sessionId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Creating message', { userId, sessionId });

    const body = parseBody<Partial<ChatMessage>>(event.body);

    // Validate required fields
    if (!body.content || !body.direction || !body.sender || !body.processingStatus) {
        return createResponse(400, { error: 'content, direction, sender, and processingStatus are required' });
    }

    // Generate messageId if not provided
    const messageId = body.messageId || `msg-${Date.now()}`;

    const message = await ChatHistoryClient.createMessage({
        userId,
        sessionId,
        messageId,
        content: body.content,
        direction: body.direction,
        sender: body.sender,
        sentAt: body.sentAt,
        processingStatus: body.processingStatus,
    });

    // Increment session message count
    try {
        await ChatHistoryClient.incrementMessageCount(userId, sessionId);
    } catch (error: any) {
        logger.warn('Failed to increment message count', { userId, sessionId, error: error.message });
    }

    return createResponse(201, message);
}

/**
 * PUT /sessions/:sessionId/messages/:messageId - Update message
 */
async function updateMessage(
    event: APIGatewayProxyEvent,
    userId: string,
    sessionId: string,
    messageId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Updating message', { userId, sessionId, messageId });

    const body = parseBody<Partial<ChatMessage>>(event.body);

    const message = await ChatHistoryClient.updateMessage(userId, sessionId, messageId, body);

    return createResponse(200, message);
}

/**
 * DELETE /sessions/:sessionId/messages/:messageId - Delete message
 */
async function deleteMessage(
    userId: string,
    sessionId: string,
    messageId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Deleting message', { userId, sessionId, messageId });

    await ChatHistoryClient.deleteMessage(userId, sessionId, messageId);

    return createResponse(204, '');
}
