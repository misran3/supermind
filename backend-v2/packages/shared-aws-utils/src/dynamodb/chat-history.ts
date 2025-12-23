import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDBDocumentClient, getTableName } from './client';
import type {
    WebSessionMetadata,
    WebSessionMetadataDAO,
    ChatMessage,
    ChatMessageDAO,
} from './models';
import logger from './logger';

export class ChatHistoryClient {
    // ============================================
    // Web Session Metadata Operations
    // ============================================

    /**
     * Create a new web session
     */
    static async createWebSession(
        session: Omit<WebSessionMetadata, 'createdAt' | 'updatedAt' | 'messageCount' | 'archived' | 'starred'>
    ): Promise<WebSessionMetadata> {
        const now = new Date().toISOString();
        const newSession: WebSessionMetadata = {
            ...session,
            messageCount: 0,
            archived: false,
            starred: false,
            createdAt: now,
            updatedAt: now,
        };

        const dao: WebSessionMetadataDAO = {
            ...newSession,
            PK: `USER#${session.userId}`,
            SK: `WEB_SESSION#${session.sessionId}#METADATA`,
        };

        try {
            await dynamoDBDocumentClient.send(
                new PutCommand({
                    TableName: getTableName('chatHistory'),
                    Item: dao,
                    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
                })
            );

            logger.info('Web session created successfully', {
                userId: session.userId,
                sessionId: session.sessionId,
            });
            return newSession;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Web session already exists', {
                    userId: session.userId,
                    sessionId: session.sessionId,
                });
                throw new Error(
                    `Web session already exists for userId: ${session.userId}, sessionId: ${session.sessionId}`
                );
            }
            logger.error('Error creating web session', {
                error,
                userId: session.userId,
                sessionId: session.sessionId,
            });
            throw error;
        }
    }

    /**
     * Get web session metadata
     */
    static async getWebSession(userId: string, sessionId: string): Promise<WebSessionMetadata | null> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new GetCommand({
                    TableName: getTableName('chatHistory'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `WEB_SESSION#${sessionId}#METADATA`,
                    },
                })
            );

            if (!response.Item) {
                logger.info('Web session not found', { userId, sessionId });
                return null;
            }

            const dao = response.Item as WebSessionMetadataDAO;
            const { PK, SK, ...session } = dao;
            return session as WebSessionMetadata;
        } catch (error) {
            logger.error('Error getting web session', { error, userId, sessionId });
            throw error;
        }
    }

    /**
     * List all web sessions for a user
     */
    static async listWebSessions(
        userId: string,
        limit?: number,
        archived?: boolean
    ): Promise<WebSessionMetadata[]> {
        try {
            const params: any = {
                TableName: getTableName('chatHistory'),
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                ExpressionAttributeValues: {
                    ':pk': `USER#${userId}`,
                    ':skPrefix': 'WEB_SESSION#',
                },
                Limit: limit,
                ScanIndexForward: false, // Most recent first
            };

            if (archived !== undefined) {
                params.FilterExpression = 'archived = :archived';
                params.ExpressionAttributeValues[':archived'] = archived;
            }

            const response = await dynamoDBDocumentClient.send(new QueryCommand(params));

            if (!response.Items || response.Items.length === 0) {
                logger.info('No web sessions found for user', { userId });
                return [];
            }

            return response.Items.map((item) => {
                const dao = item as WebSessionMetadataDAO;
                const { PK, SK, ...session } = dao;
                return session as WebSessionMetadata;
            });
        } catch (error) {
            logger.error('Error listing web sessions', { error, userId });
            throw error;
        }
    }

    /**
     * Update web session metadata
     */
    static async updateWebSession(
        userId: string,
        sessionId: string,
        updates: Partial<Omit<WebSessionMetadata, 'userId' | 'sessionId' | 'createdAt' | 'updatedAt' | 'messageCount'>>
    ): Promise<WebSessionMetadata> {
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
                    TableName: getTableName('chatHistory'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `WEB_SESSION#${sessionId}#METADATA`,
                    },
                    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                    ReturnValues: 'ALL_NEW',
                })
            );

            logger.info('Web session updated successfully', { userId, sessionId });
            const dao = response.Attributes as WebSessionMetadataDAO;
            const { PK, SK, ...session } = dao;
            return session as WebSessionMetadata;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Web session not found for update', { userId, sessionId });
                throw new Error(`Web session not found for userId: ${userId}, sessionId: ${sessionId}`);
            }
            logger.error('Error updating web session', { error, userId, sessionId });
            throw error;
        }
    }

    /**
     * Increment message count for a web session (atomic operation)
     */
    static async incrementMessageCount(userId: string, sessionId: string): Promise<number> {
        const now = new Date().toISOString();

        try {
            const response = await dynamoDBDocumentClient.send(
                new UpdateCommand({
                    TableName: getTableName('chatHistory'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `WEB_SESSION#${sessionId}#METADATA`,
                    },
                    UpdateExpression: 'ADD messageCount :increment SET updatedAt = :updatedAt',
                    ExpressionAttributeValues: {
                        ':increment': 1,
                        ':updatedAt': now,
                    },
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                    ReturnValues: 'ALL_NEW',
                })
            );

            const newCount = (response.Attributes as WebSessionMetadataDAO).messageCount;
            logger.info('Message count incremented', { userId, sessionId, newCount });
            return newCount;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Web session not found for increment', { userId, sessionId });
                throw new Error(`Web session not found for userId: ${userId}, sessionId: ${sessionId}`);
            }
            logger.error('Error incrementing message count', { error, userId, sessionId });
            throw error;
        }
    }

    /**
     * Delete a web session
     */
    static async deleteWebSession(userId: string, sessionId: string): Promise<void> {
        try {
            await dynamoDBDocumentClient.send(
                new DeleteCommand({
                    TableName: getTableName('chatHistory'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: `WEB_SESSION#${sessionId}#METADATA`,
                    },
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                })
            );

            logger.info('Web session deleted successfully', { userId, sessionId });
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Web session not found for deletion', { userId, sessionId });
                throw new Error(`Web session not found for userId: ${userId}, sessionId: ${sessionId}`);
            }
            logger.error('Error deleting web session', { error, userId, sessionId });
            throw error;
        }
    }

    // ============================================
    // Chat Message Operations
    // ============================================

    /**
     * Create a new chat message
     */
    static async createMessage(message: Omit<ChatMessage, 'timestamp'>): Promise<ChatMessage> {
        const now = new Date().toISOString();
        const newMessage: ChatMessage = {
            ...message,
            timestamp: now,
        };

        const dao: ChatMessageDAO = {
            ...newMessage,
            PK: `USER#${message.userId}#WEB_SESSION#${message.sessionId}`,
            SK: `MESSAGE#${message.messageId}`,
        };

        try {
            await dynamoDBDocumentClient.send(
                new PutCommand({
                    TableName: getTableName('chatHistory'),
                    Item: dao,
                    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
                })
            );

            logger.info('Chat message created successfully', {
                userId: message.userId,
                sessionId: message.sessionId,
                messageId: message.messageId,
            });
            return newMessage;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Chat message already exists', {
                    userId: message.userId,
                    sessionId: message.sessionId,
                    messageId: message.messageId,
                });
                throw new Error(
                    `Chat message already exists for userId: ${message.userId}, sessionId: ${message.sessionId}, messageId: ${message.messageId}`
                );
            }
            logger.error('Error creating chat message', {
                error,
                userId: message.userId,
                sessionId: message.sessionId,
                messageId: message.messageId,
            });
            throw error;
        }
    }

    /**
     * Get a specific chat message
     */
    static async getMessage(
        userId: string,
        sessionId: string,
        messageId: string
    ): Promise<ChatMessage | null> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new GetCommand({
                    TableName: getTableName('chatHistory'),
                    Key: {
                        PK: `USER#${userId}#WEB_SESSION#${sessionId}`,
                        SK: `MESSAGE#${messageId}`,
                    },
                })
            );

            if (!response.Item) {
                logger.info('Chat message not found', { userId, sessionId, messageId });
                return null;
            }

            const dao = response.Item as ChatMessageDAO;
            const { PK, SK, ...message } = dao;
            return message as ChatMessage;
        } catch (error) {
            logger.error('Error getting chat message', { error, userId, sessionId, messageId });
            throw error;
        }
    }

    /**
     * List all messages in a web session
     */
    static async listMessages(
        userId: string,
        sessionId: string,
        limit?: number,
        lastEvaluatedKey?: Record<string, any>
    ): Promise<{ messages: ChatMessage[]; lastEvaluatedKey?: Record<string, any> }> {
        try {
            const params: any = {
                TableName: getTableName('chatHistory'),
                KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
                ExpressionAttributeValues: {
                    ':pk': `USER#${userId}#WEB_SESSION#${sessionId}`,
                    ':skPrefix': 'MESSAGE#',
                },
                Limit: limit,
                ScanIndexForward: true, // Oldest first (chronological order)
            };

            if (lastEvaluatedKey) {
                params.ExclusiveStartKey = lastEvaluatedKey;
            }

            const response = await dynamoDBDocumentClient.send(new QueryCommand(params));

            if (!response.Items || response.Items.length === 0) {
                logger.info('No messages found in session', { userId, sessionId });
                return { messages: [] };
            }

            const messages = response.Items.map((item) => {
                const dao = item as ChatMessageDAO;
                const { PK, SK, ...message } = dao;
                return message as ChatMessage;
            });

            return {
                messages,
                lastEvaluatedKey: response.LastEvaluatedKey,
            };
        } catch (error) {
            logger.error('Error listing messages', { error, userId, sessionId });
            throw error;
        }
    }

    /**
     * Update a chat message
     */
    static async updateMessage(
        userId: string,
        sessionId: string,
        messageId: string,
        updates: Partial<
            Omit<ChatMessage, 'userId' | 'sessionId' | 'messageId' | 'timestamp'>
        >
    ): Promise<ChatMessage> {
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

        if (updateExpressions.length === 0) {
            throw new Error('No updates provided');
        }

        try {
            const response = await dynamoDBDocumentClient.send(
                new UpdateCommand({
                    TableName: getTableName('chatHistory'),
                    Key: {
                        PK: `USER#${userId}#WEB_SESSION#${sessionId}`,
                        SK: `MESSAGE#${messageId}`,
                    },
                    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                    ReturnValues: 'ALL_NEW',
                })
            );

            logger.info('Chat message updated successfully', { userId, sessionId, messageId });
            const dao = response.Attributes as ChatMessageDAO;
            const { PK, SK, ...message } = dao;
            return message as ChatMessage;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Chat message not found for update', { userId, sessionId, messageId });
                throw new Error(
                    `Chat message not found for userId: ${userId}, sessionId: ${sessionId}, messageId: ${messageId}`
                );
            }
            logger.error('Error updating chat message', { error, userId, sessionId, messageId });
            throw error;
        }
    }

    /**
     * Delete a chat message
     */
    static async deleteMessage(userId: string, sessionId: string, messageId: string): Promise<void> {
        try {
            await dynamoDBDocumentClient.send(
                new DeleteCommand({
                    TableName: getTableName('chatHistory'),
                    Key: {
                        PK: `USER#${userId}#WEB_SESSION#${sessionId}`,
                        SK: `MESSAGE#${messageId}`,
                    },
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                })
            );

            logger.info('Chat message deleted successfully', { userId, sessionId, messageId });
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('Chat message not found for deletion', { userId, sessionId, messageId });
                throw new Error(
                    `Chat message not found for userId: ${userId}, sessionId: ${sessionId}, messageId: ${messageId}`
                );
            }
            logger.error('Error deleting chat message', { error, userId, sessionId, messageId });
            throw error;
        }
    }

    /**
     * List recent sessions for a user using UserIdIndex GSI
     */
    static async listRecentSessions(
        userId: string,
        limit?: number
    ): Promise<WebSessionMetadata[]> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new QueryCommand({
                    TableName: getTableName('chatHistory'),
                    IndexName: 'UserIdIndex',
                    KeyConditionExpression: 'user_id = :userId',
                    ExpressionAttributeValues: {
                        ':userId': userId,
                    },
                    Limit: limit,
                    ScanIndexForward: false, // Most recent first
                })
            );

            if (!response.Items || response.Items.length === 0) {
                logger.info('No recent sessions found for user', { userId });
                return [];
            }

            return response.Items.map((item) => {
                const dao = item as WebSessionMetadataDAO;
                const { PK, SK, user_id, ...session } = dao as any;
                return session as WebSessionMetadata;
            });
        } catch (error) {
            logger.error('Error listing recent sessions', { error, userId });
            throw error;
        }
    }
}
