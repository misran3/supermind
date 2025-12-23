import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDBDocumentClient, getTableName } from './client';
import type {
    ThirdPartyIntegration,
    ThirdPartyIntegrationDAO,
    ThirdPartyEventLog,
    ThirdPartyEventLogDAO,
    AllowedThirdPartyConnectors,
} from './models';
import logger from './logger';

export class IntegrationsClient {
    // ============================================
    // Third-Party Integration Operations
    // ============================================

    /**
     * Create a new third-party integration
     */
    static async createIntegration(
        integration: Omit<ThirdPartyIntegration, 'createdAt' | 'updatedAt'>
    ): Promise<ThirdPartyIntegration> {
        const now = new Date().toISOString();
        const newIntegration: ThirdPartyIntegration = {
            ...integration,
            createdAt: now,
            updatedAt: now,
        };

        const dao: ThirdPartyIntegrationDAO = {
            ...newIntegration,
            PK: `USER#${integration.userId}`,
            SK: `INTEGRATION#${integration.connectorName}`,
        };

        try {
            await dynamoDBDocumentClient.send(
                new PutCommand({
                    TableName: getTableName('integrations'),
                    Item: dao,
                    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
                })
            );

            logger.info('Integration created successfully', {
                userId: integration.userId,
                connectorName: integration.connectorName,
            });
            return newIntegration;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Integration already exists', {
                    userId: integration.userId,
                    connectorName: integration.connectorName,
                });
                throw new Error(
                    `Integration already exists for userId: ${integration.userId}, connector: ${integration.connectorName}`
                );
            }
            logger.error('Error creating integration', {
                error,
                userId: integration.userId,
                connectorName: integration.connectorName,
            });
            throw error;
        }
    }

    /**
     * Get a third-party integration by userId and connectorName
     */
    static async getIntegration(
        userId: string,
        connectorName: AllowedThirdPartyConnectors
    ): Promise<ThirdPartyIntegration | null> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new GetCommand({
                    TableName: getTableName('integrations'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `INTEGRATION#${connectorName}`,
                    },
                })
            );

            if (!response.Item) {
                logger.info('Integration not found', { userId, connectorName });
                return null;
            }

            const dao = response.Item as ThirdPartyIntegrationDAO;
            const { PK, SK, ...integration } = dao;
            return integration as ThirdPartyIntegration;
        } catch (error) {
            logger.error('Error getting integration', { error, userId, connectorName });
            throw error;
        }
    }

    /**
     * List all integrations for a user
     */
    static async listIntegrations(userId: string): Promise<ThirdPartyIntegration[]> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new QueryCommand({
                    TableName: getTableName('integrations'),
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`,
                        ':skPrefix': 'INTEGRATION#',
                    },
                })
            );

            if (!response.Items || response.Items.length === 0) {
                logger.info('No integrations found for user', { userId });
                return [];
            }

            return response.Items.map((item) => {
                const dao = item as ThirdPartyIntegrationDAO;
                const { PK, SK, ...integration } = dao;
                return integration as ThirdPartyIntegration;
            });
        } catch (error) {
            logger.error('Error listing integrations', { error, userId });
            throw error;
        }
    }

    /**
     * Update a third-party integration
     */
    static async updateIntegration(
        userId: string,
        connectorName: AllowedThirdPartyConnectors,
        updates: Partial<Omit<ThirdPartyIntegration, 'userId' | 'connectorName' | 'createdAt' | 'updatedAt'>>
    ): Promise<ThirdPartyIntegration> {
        const now = new Date().toISOString();

        const updateExpressions: string[] = [];
        const expressionAttributeNames: Record<string, string> = {};
        const expressionAttributeValues: Record<string, any> = {};

        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) {
                updateExpressions.push(`#${key} = :${key}`);
                expressionAttributeNames[`#${key}`] = key;
                expressionAttributeValues[`:${key}`] = value;
            }
        });

        updateExpressions.push('#updatedAt = :updatedAt');
        expressionAttributeNames['#updatedAt'] = 'updatedAt';
        expressionAttributeValues[':updatedAt'] = now;

        try {
            const response = await dynamoDBDocumentClient.send(
                new UpdateCommand({
                    TableName: getTableName('integrations'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `INTEGRATION#${connectorName}`,
                    },
                    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                    ReturnValues: 'ALL_NEW',
                })
            );

            logger.info('Integration updated successfully', { userId, connectorName });
            const dao = response.Attributes as ThirdPartyIntegrationDAO;
            const { PK, SK, ...integration } = dao;
            return integration as ThirdPartyIntegration;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Integration not found for update', { userId, connectorName });
                throw new Error(`Integration not found for userId: ${userId}, connector: ${connectorName}`);
            }
            logger.error('Error updating integration', { error, userId, connectorName });
            throw error;
        }
    }

    /**
     * Delete a third-party integration
     */
    static async deleteIntegration(
        userId: string,
        connectorName: AllowedThirdPartyConnectors
    ): Promise<void> {
        try {
            await dynamoDBDocumentClient.send(
                new DeleteCommand({
                    TableName: getTableName('integrations'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `INTEGRATION#${connectorName}`,
                    },
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                })
            );

            logger.info('Integration deleted successfully', { userId, connectorName });
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Integration not found for deletion', { userId, connectorName });
                throw new Error(`Integration not found for userId: ${userId}, connector: ${connectorName}`);
            }
            logger.error('Error deleting integration', { error, userId, connectorName });
            throw error;
        }
    }

    /**
     * Create or update integration (upsert)
     */
    static async upsertIntegration(
        integration: Omit<ThirdPartyIntegration, 'createdAt' | 'updatedAt'>
    ): Promise<ThirdPartyIntegration> {
        const existingIntegration = await this.getIntegration(integration.userId, integration.connectorName);

        if (existingIntegration) {
            return await this.updateIntegration(integration.userId, integration.connectorName, integration);
        } else {
            return await this.createIntegration(integration);
        }
    }

    // ============================================
    // Event Log Operations
    // ============================================

    /**
     * Create a new event log entry
     */
    static async createEventLog(
        eventLog: Omit<ThirdPartyEventLog, 'ttl'>
    ): Promise<ThirdPartyEventLog> {
        const ttl = Math.floor(Date.parse(eventLog.timestamp) / 1000) + 30 * 24 * 60 * 60; // 30 days

        const newEventLog: ThirdPartyEventLog = {
            ...eventLog,
            ttl,
        };

        const dao: ThirdPartyEventLogDAO = {
            ...newEventLog,
            PK: `USER#${eventLog.userId}`,
            SK: `EVENT#${eventLog.connectorName}#${eventLog.timestamp}`,
        };

        try {
            await dynamoDBDocumentClient.send(
                new PutCommand({
                    TableName: getTableName('integrations'),
                    Item: dao,
                })
            );

            logger.info('Event log created successfully', {
                userId: eventLog.userId,
                connectorName: eventLog.connectorName,
                eventType: eventLog.eventType,
            });
            return newEventLog;
        } catch (error) {
            logger.error('Error creating event log', {
                error,
                userId: eventLog.userId,
                connectorName: eventLog.connectorName,
            });
            throw error;
        }
    }

    /**
     * Get a specific event log entry
     */
    static async getEventLog(
        userId: string,
        connectorName: AllowedThirdPartyConnectors,
        timestamp: string
    ): Promise<ThirdPartyEventLog | null> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new GetCommand({
                    TableName: getTableName('integrations'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `EVENT#${connectorName}#${timestamp}`,
                    },
                })
            );

            if (!response.Item) {
                logger.info('Event log not found', { userId, connectorName, timestamp });
                return null;
            }

            const dao = response.Item as ThirdPartyEventLogDAO;
            const { PK, SK, ...eventLog } = dao;
            return eventLog as ThirdPartyEventLog;
        } catch (error) {
            logger.error('Error getting event log', { error, userId, connectorName, timestamp });
            throw error;
        }
    }

    /**
     * List event logs for a user and connector
     */
    static async listEventLogsByConnector(
        userId: string,
        connectorName: AllowedThirdPartyConnectors,
        limit?: number
    ): Promise<ThirdPartyEventLog[]> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new QueryCommand({
                    TableName: getTableName('integrations'),
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`,
                        ':skPrefix': `EVENT#${connectorName}#`,
                    },
                    Limit: limit,
                    ScanIndexForward: false, // Most recent first
                })
            );

            if (!response.Items || response.Items.length === 0) {
                logger.info('No event logs found', { userId, connectorName });
                return [];
            }

            return response.Items.map((item) => {
                const dao = item as ThirdPartyEventLogDAO;
                const { PK, SK, ...eventLog } = dao;
                return eventLog as ThirdPartyEventLog;
            });
        } catch (error) {
            logger.error('Error listing event logs by connector', { error, userId, connectorName });
            throw error;
        }
    }

    /**
     * List all event logs for a user
     */
    static async listAllEventLogs(userId: string, limit?: number): Promise<ThirdPartyEventLog[]> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new QueryCommand({
                    TableName: getTableName('integrations'),
                    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                    ExpressionAttributeValues: {
                        ':pk': `USER#${userId}`,
                        ':skPrefix': 'EVENT#',
                    },
                    Limit: limit,
                    ScanIndexForward: false, // Most recent first
                })
            );

            if (!response.Items || response.Items.length === 0) {
                logger.info('No event logs found for user', { userId });
                return [];
            }

            return response.Items.map((item) => {
                const dao = item as ThirdPartyEventLogDAO;
                const { PK, SK, ...eventLog } = dao;
                return eventLog as ThirdPartyEventLog;
            });
        } catch (error) {
            logger.error('Error listing all event logs', { error, userId });
            throw error;
        }
    }

    /**
     * List event logs by date range using DateIndex GSI
     */
    static async listEventLogsByDateRange(
        userId: string,
        startDate: string,
        endDate: string,
        limit?: number
    ): Promise<ThirdPartyEventLog[]> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new QueryCommand({
                    TableName: getTableName('integrations'),
                    IndexName: 'DateIndex',
                    KeyConditionExpression: 'user_id = :userId AND created_at BETWEEN :startDate AND :endDate',
                    ExpressionAttributeValues: {
                        ':userId': userId,
                        ':startDate': startDate,
                        ':endDate': endDate,
                    },
                    Limit: limit,
                    ScanIndexForward: false,
                })
            );

            if (!response.Items || response.Items.length === 0) {
                logger.info('No event logs found in date range', { userId, startDate, endDate });
                return [];
            }

            return response.Items.map((item) => {
                const dao = item as ThirdPartyEventLogDAO;
                const { PK, SK, ...eventLog } = dao;
                return eventLog as ThirdPartyEventLog;
            });
        } catch (error) {
            logger.error('Error listing event logs by date range', { error, userId, startDate, endDate });
            throw error;
        }
    }

    /**
     * Delete an event log entry
     */
    static async deleteEventLog(
        userId: string,
        connectorName: AllowedThirdPartyConnectors,
        timestamp: string
    ): Promise<void> {
        try {
            await dynamoDBDocumentClient.send(
                new DeleteCommand({
                    TableName: getTableName('integrations'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `EVENT#${connectorName}#${timestamp}`,
                    },
                })
            );

            logger.info('Event log deleted successfully', { userId, connectorName, timestamp });
        } catch (error) {
            logger.error('Error deleting event log', { error, userId, connectorName, timestamp });
            throw error;
        }
    }
}
