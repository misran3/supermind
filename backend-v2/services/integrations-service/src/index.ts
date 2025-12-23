/**
 * Integrations Service
 *
 * Handles CRUD operations for third-party integrations and event logs.
 * Uses API Gateway with Cognito Authorizer.
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { Composio } from '@composio/core';
import type {
    AllowedThirdPartyConnectors,
    ThirdPartyEventLog,
    ThirdPartyIntegration,
} from '@supermind/shared-aws-utils';
import { IntegrationsClient, createResponse } from '@supermind/shared-aws-utils';
import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

// Initialize Logger
const logger = new Logger({
    serviceName: 'integrations-service',
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

    // Handle OPTIONS preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return createResponse(200, { message: 'OK' });
    }

    try {
        const userId = getUserIdFromEvent(event);
        const method = event.httpMethod;
        const path = event.path;

        logger.info('Processing request', { method, path, userId });

        // Route to appropriate handler
        if (path.includes('/integrations/composio')) {
            return await handleComposioRoutes(event, userId, method);
        } else if (path.includes('/integrations') && !path.includes('/events')) {
            return await handleIntegrationRoutes(event, userId, method);
        } else if (path.includes('/events')) {
            return await handleEventRoutes(event, userId, method);
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

// ============================================
// Composio Integration Handlers
// ============================================

/**
 * Handle Composio-specific routes
 */
async function handleComposioRoutes(
    event: APIGatewayProxyEvent,
    userId: string,
    method: string
): Promise<APIGatewayProxyResult> {
    const pathSegments = event.path.split('/').filter(Boolean);

    // POST /integrations/composio/initiate
    if (method === 'POST' && pathSegments[pathSegments.length - 1] === 'initiate') {
        return await initiateComposioConnection(event, userId);
    }

    // GET /integrations/composio/status/:connectionId
    if (method === 'GET' && pathSegments[pathSegments.length - 2] === 'status') {
        const connectionId = pathSegments[pathSegments.length - 1];
        if (!connectionId) {
            return createResponse(400, { error: 'connectionId is required' });
        }
        return await getComposioConnectionStatus(connectionId);
    }

    return createResponse(404, { error: 'Composio route not found' });
}

/**
 * POST /integrations/composio/initiate
 * Initiates a Composio connection and returns redirect URL
 */
async function initiateComposioConnection(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Initiating Composio connection', { userId });

    const body = parseBody<{ connectorName: AllowedThirdPartyConnectors; callbackUrl?: string }>(event.body);

    if (!body.connectorName) {
        return createResponse(400, { error: 'connectorName is required' });
    }

    try {
        // Get Composio API key from environment
        const apiKey = process.env.COMPOSIO_API_KEY;
        if (!apiKey) {
            logger.error('COMPOSIO_API_KEY not configured');
            return createResponse(500, { error: 'Composio integration not configured' });
        }

        const composio = new Composio({ apiKey });

        // Map connector name to Composio toolkit
        const toolkitName = body.connectorName === 'google_calendar' ? 'googlecalendar' : 'gmail';

        // Get Composio-managed auth config
        const authConfigs = await composio.authConfigs.list({
            toolkit: toolkitName,
            isComposioManaged: true,
        });

        if (!authConfigs.items || authConfigs.items.length === 0) {
            return createResponse(404, { error: `No auth config found for ${toolkitName}` });
        }

        const authConfigId = authConfigs.items[0]?.id;

        if (!authConfigId) {
            return createResponse(404, { error: `No auth config ID found for ${toolkitName}` });
        }

        // Create connection request
        const connectionRequest = await composio.connectedAccounts.link(userId, authConfigId, {
            callbackUrl: body.callbackUrl || 'http://localhost:3000',
        });

        if (!connectionRequest.redirectUrl) {
            logger.error('No redirect URL returned from Composio', { userId, connectorName: body.connectorName });
            return createResponse(500, { error: 'No redirect URL returned from Composio' });
        }

        logger.info('Connection request created', {
            userId,
            connectorName: body.connectorName,
            connectionId: connectionRequest.id,
        });

        return createResponse(200, {
            redirectUrl: connectionRequest.redirectUrl,
            connectionId: connectionRequest.id,
        });
    } catch (error: any) {
        logger.error('Failed to initiate Composio connection', { error: error.message, userId });
        return createResponse(500, { error: 'Failed to initiate connection' });
    }
}

/**
 * GET /integrations/composio/status/:connectionId
 * Get the status of a Composio connection
 */
async function getComposioConnectionStatus(connectionId: string): Promise<APIGatewayProxyResult> {
    logger.info('Getting Composio connection status', { connectionId });

    try {
        const apiKey = process.env.COMPOSIO_API_KEY;
        if (!apiKey) {
            return createResponse(500, { error: 'Composio integration not configured' });
        }

        const composio = new Composio({ apiKey });
        const connectedAccount = await composio.connectedAccounts.get(connectionId);

        // Extract email if available
        const connectedEmail = (connectedAccount.state?.val as any)?.account_id || undefined;

        return createResponse(200, {
            id: connectedAccount.id,
            status: connectedAccount.status,
            connectedEmail,
            toolkit: connectedAccount.toolkit.slug,
        });
    } catch (error: any) {
        logger.error('Failed to get connection status', { error: error.message, connectionId });
        return createResponse(500, { error: 'Failed to get connection status' });
    }
}

// ============================================
// Integration Handlers
// ============================================

/**
 * Handle integration routes
 */
async function handleIntegrationRoutes(
    event: APIGatewayProxyEvent,
    userId: string,
    method: string
): Promise<APIGatewayProxyResult> {
    const connectorName = getPathParam(event, 'connectorName');

    // List all integrations or get specific one
    if (method === 'GET') {
        if (connectorName) {
            return await getIntegration(userId, connectorName as AllowedThirdPartyConnectors);
        } else {
            return await listIntegrations(userId);
        }
    }

    // Create, update, or delete specific integration
    if (!connectorName) {
        if (method === 'POST') {
            return await createIntegration(event, userId);
        }
        return createResponse(400, { error: 'Connector name is required' });
    }

    switch (method) {
        case 'PUT':
            return await updateIntegration(event, userId, connectorName as AllowedThirdPartyConnectors);
        case 'DELETE':
            return await deleteIntegration(userId, connectorName as AllowedThirdPartyConnectors);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

/**
 * Handle event routes
 */
async function handleEventRoutes(
    event: APIGatewayProxyEvent,
    userId: string,
    method: string
): Promise<APIGatewayProxyResult> {
    switch (method) {
        case 'GET':
            return await listEvents(event, userId);
        case 'POST':
            return await createEvent(event, userId);
        default:
            return createResponse(405, { error: 'Method not allowed' });
    }
}

// ============================================
// Integration Handlers
// ============================================

/**
 * GET /integrations - List all integrations
 */
async function listIntegrations(userId: string): Promise<APIGatewayProxyResult> {
    logger.info('Listing integrations', { userId });

    const integrations = await IntegrationsClient.listIntegrations(userId);

    return createResponse(200, { integrations });
}

/**
 * GET /integrations/:connectorName - Get specific integration
 */
async function getIntegration(
    userId: string,
    connectorName: AllowedThirdPartyConnectors
): Promise<APIGatewayProxyResult> {
    logger.info('Getting integration', { userId, connectorName });

    const integration = await IntegrationsClient.getIntegration(userId, connectorName);

    if (!integration) {
        return createResponse(404, { error: 'Integration not found' });
    }

    return createResponse(200, integration);
}

/**
 * POST /integrations - Create integration
 */
async function createIntegration(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Creating integration', { userId });

    const body = parseBody<Partial<ThirdPartyIntegration>>(event.body);

    // Validate required fields
    if (!body.connectorName || !body.connectorSource || !body.connectionId) {
        return createResponse(400, { error: 'connectorName, connectorSource, and connectionId are required' });
    }

    const integration = await IntegrationsClient.createIntegration({
        userId,
        connectorName: body.connectorName,
        connectorSource: body.connectorSource,
        connectionStatus: body.connectionStatus || 'initiated',
        connectionId: body.connectionId,
        connectedEmail: body.connectedEmail,
        connectedPhoneNumber: body.connectedPhoneNumber,
        externalEntityId: body.externalEntityId,
        syncStatus: body.syncStatus || 'success',
        lastSyncAt: body.lastSyncAt,
    });

    return createResponse(201, integration);
}

/**
 * PUT /integrations/:connectorName - Update integration
 */
async function updateIntegration(
    event: APIGatewayProxyEvent,
    userId: string,
    connectorName: AllowedThirdPartyConnectors
): Promise<APIGatewayProxyResult> {
    logger.info('Updating integration', { userId, connectorName });

    const body = parseBody<Partial<ThirdPartyIntegration>>(event.body);

    const integration = await IntegrationsClient.updateIntegration(userId, connectorName, body);

    return createResponse(200, integration);
}

/**
 * DELETE /integrations/:connectorName - Delete integration
 */
async function deleteIntegration(
    userId: string,
    connectorName: AllowedThirdPartyConnectors
): Promise<APIGatewayProxyResult> {
    logger.info('Deleting integration', { userId, connectorName });

    await IntegrationsClient.deleteIntegration(userId, connectorName);

    return createResponse(204, '');
}

// ============================================
// Event Handlers
// ============================================

/**
 * GET /events - List event logs
 * Query params: connector (optional), limit (optional)
 */
async function listEvents(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Listing events', { userId });

    const connector = event.queryStringParameters?.connector as AllowedThirdPartyConnectors | undefined;
    const limit = event.queryStringParameters?.limit
        ? parseInt(event.queryStringParameters.limit)
        : undefined;

    let events: ThirdPartyEventLog[];

    if (connector) {
        events = await IntegrationsClient.listEventLogsByConnector(userId, connector, limit);
    } else {
        events = await IntegrationsClient.listAllEventLogs(userId, limit);
    }

    return createResponse(200, { events });
}

/**
 * POST /events - Create event log
 */
async function createEvent(
    event: APIGatewayProxyEvent,
    userId: string
): Promise<APIGatewayProxyResult> {
    logger.info('Creating event', { userId });

    const body = parseBody<Partial<ThirdPartyEventLog>>(event.body);

    // Validate required fields
    if (!body.connectorName || !body.eventType || !body.externalId || !body.actionSource) {
        
        return createResponse(400, { error: 'connectorName, eventType, externalId, and actionSource are required' });
    }

    const eventLog = await IntegrationsClient.createEventLog({
        userId,
        connectorName: body.connectorName,
        eventType: body.eventType,
        externalId: body.externalId,
        actionSource: body.actionSource,
        timestamp: body.timestamp || new Date().toISOString(),
        details: body.details,
    });

    return createResponse(201, eventLog);
}
