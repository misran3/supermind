import { GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDBDocumentClient, getTableName } from './client';
import type {
    UserProfile,
    UserProfileDAO,
    UserAppSettings,
    UserAppSettingsDAO,
} from './models';
import logger from './logger';

export class UsersClient {
    // ============================================
    // User Profile Operations
    // ============================================

    /**
     * Create a new user profile
     */
    static async createUserProfile(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
        const now = new Date().toISOString();
        const userProfile: UserProfile = {
            ...profile,
            createdAt: now,
            updatedAt: now,
        };

        const dao: UserProfileDAO = {
            ...userProfile,
            PK: `USER#${profile.userId}`,
            SK: 'PROFILE',
        };

        try {
            await dynamoDBDocumentClient.send(
                new PutCommand({
                    TableName: getTableName('users'),
                    Item: dao,
                    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
                })
            );

            logger.info('User profile created successfully', { userId: profile.userId });
            return userProfile;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('User profile already exists', { userId: profile.userId });
                throw new Error(`User profile already exists for userId: ${profile.userId}`);
            }
            logger.error('Error creating user profile', { error, userId: profile.userId });
            throw error;
        }
    }

    /**
     * Get user profile by userId
     */
    static async getUserProfile(userId: string): Promise<UserProfile | null> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new GetCommand({
                    TableName: getTableName('users'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: 'PROFILE',
                    },
                })
            );

            if (!response.Item) {
                logger.info('User profile not found', { userId });
                return null;
            }

            const dao = response.Item as UserProfileDAO;
            const { PK, SK, ...profile } = dao;
            return profile as UserProfile;
        } catch (error) {
            logger.error('Error getting user profile', { error, userId });
            throw error;
        }
    }

    /**
     * Get user profile by email using GSI
     */
    static async getUserProfileByEmail(email: string): Promise<UserProfile | null> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new QueryCommand({
                    TableName: getTableName('users'),
                    IndexName: 'UserEmailIndex',
                    KeyConditionExpression: 'email = :email',
                    ExpressionAttributeValues: {
                        ':email': email,
                    },
                    Limit: 1,
                })
            );

            if (!response.Items || response.Items.length === 0) {
                logger.info('User profile not found by email', { email });
                return null;
            }

            const dao = response.Items[0] as UserProfileDAO;
            const { PK, SK, ...profile } = dao;
            return profile as UserProfile;
        } catch (error) {
            logger.error('Error getting user profile by email', { error, email });
            throw error;
        }
    }

    /**
     * Update user profile
     */
    static async updateUserProfile(
        userId: string,
        updates: Partial<Omit<UserProfile, 'userId' | 'createdAt' | 'updatedAt'>>
    ): Promise<UserProfile> {
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
                    TableName: getTableName('users'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: 'PROFILE',
                    },
                    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                    ReturnValues: 'ALL_NEW',
                })
            );

            logger.info('User profile updated successfully', { userId });
            const dao = response.Attributes as UserProfileDAO;
            const { PK, SK, ...profile } = dao;
            return profile as UserProfile;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('User profile not found for update', { userId });
                throw new Error(`User profile not found for userId: ${userId}`);
            }
            logger.error('Error updating user profile', { error, userId });
            throw error;
        }
    }

    /**
     * Delete user profile
     */
    static async deleteUserProfile(userId: string): Promise<void> {
        try {
            await dynamoDBDocumentClient.send(
                new DeleteCommand({
                    TableName: getTableName('users'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: 'PROFILE',
                    },
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                })
            );

            logger.info('User profile deleted successfully', { userId });
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('User profile not found for deletion', { userId });
                throw new Error(`User profile not found for userId: ${userId}`);
            }
            logger.error('Error deleting user profile', { error, userId });
            throw error;
        }
    }

    // ============================================
    // App Settings Operations
    // ============================================

    /**
     * Create app settings for a user
     */
    static async createAppSettings(
        settings: Omit<UserAppSettings, 'createdAt' | 'updatedAt'>
    ): Promise<UserAppSettings> {
        const now = new Date().toISOString();
        const appSettings: UserAppSettings = {
            ...settings,
            createdAt: now,
            updatedAt: now,
        };

        const dao: UserAppSettingsDAO = {
            ...appSettings,
            PK: `USER#${settings.userId}`,
            SK: 'APP_SETTINGS',
        };

        try {
            await dynamoDBDocumentClient.send(
                new PutCommand({
                    TableName: getTableName('users'),
                    Item: dao,
                    ConditionExpression: 'attribute_not_exists(PK) AND attribute_not_exists(SK)',
                })
            );

            logger.info('App settings created successfully', { userId: settings.userId });
            return appSettings;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('App settings already exist', { userId: settings.userId });
                throw new Error(`App settings already exist for userId: ${settings.userId}`);
            }
            logger.error('Error creating app settings', { error, userId: settings.userId });
            throw error;
        }
    }

    /**
     * Get app settings for a user
     */
    static async getAppSettings(userId: string): Promise<UserAppSettings | null> {
        try {
            const response = await dynamoDBDocumentClient.send(
                new GetCommand({
                    TableName: getTableName('users'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: 'APP_SETTINGS',
                    },
                })
            );

            if (!response.Item) {
                logger.info('App settings not found', { userId });
                return null;
            }

            const dao = response.Item as UserAppSettingsDAO;
            const { PK, SK, ...settings } = dao;
            return settings as UserAppSettings;
        } catch (error) {
            logger.error('Error getting app settings', { error, userId });
            throw error;
        }
    }

    /**
     * Update app settings for a user
     */
    static async updateAppSettings(
        userId: string,
        updates: Partial<Omit<UserAppSettings, 'userId' | 'createdAt' | 'updatedAt'>>
    ): Promise<UserAppSettings> {
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
                    TableName: getTableName('users'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: 'APP_SETTINGS',
                    },
                    UpdateExpression: `SET ${updateExpressions.join(', ')}`,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                    ReturnValues: 'ALL_NEW',
                })
            );

            logger.info('App settings updated successfully', { userId });
            const dao = response.Attributes as UserAppSettingsDAO;
            const { PK, SK, ...settings } = dao;
            return settings as UserAppSettings;
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('App settings not found for update', { userId });
                throw new Error(`App settings not found for userId: ${userId}`);
            }
            logger.error('Error updating app settings', { error, userId });
            throw error;
        }
    }

    /**
     * Delete app settings for a user
     */
    static async deleteAppSettings(userId: string): Promise<void> {
        try {
            await dynamoDBDocumentClient.send(
                new DeleteCommand({
                    TableName: getTableName('users'),
                    Key: {
                        PK: `USER#${userId}`,
                        SK: 'APP_SETTINGS',
                    },
                    ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
                })
            );

            logger.info('App settings deleted successfully', { userId });
        } catch (error: any) {
            if (error.name === 'ConditionalCheckFailedException') {
                logger.error('App settings not found for deletion', { userId });
                throw new Error(`App settings not found for userId: ${userId}`);
            }
            logger.error('Error deleting app settings', { error, userId });
            throw error;
        }
    }

    /**
     * Create or update app settings (upsert)
     */
    static async upsertAppSettings(
        settings: Omit<UserAppSettings, 'createdAt' | 'updatedAt'>
    ): Promise<UserAppSettings> {
        const existingSettings = await this.getAppSettings(settings.userId);

        if (existingSettings) {
            return await this.updateAppSettings(settings.userId, settings);
        } else {
            return await this.createAppSettings(settings);
        }
    }

    /**
     * Create or update user profile (upsert)
     */
    static async upsertUserProfile(
        profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>
    ): Promise<UserProfile> {
        const existingProfile = await this.getUserProfile(profile.userId);

        if (existingProfile) {
            return await this.updateUserProfile(profile.userId, profile);
        } else {
            return await this.createUserProfile(profile);
        }
    }
}
