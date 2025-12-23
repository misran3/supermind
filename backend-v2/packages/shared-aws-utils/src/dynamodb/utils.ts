import { DescribeTableCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, type ScanCommandOutput } from '@aws-sdk/lib-dynamodb';
import type { TableNameIdentifier, TableNameIdentifiers } from './client';
import { dynamoDBDocumentClient, getTableName, TABLES } from './client';
import logger from './logger';

export class DatabaseUtils {
    static async checkConnectionToDynamoDB(tables?: TableNameIdentifiers): Promise<void> {
        const targetTables = tables || Object.keys(TABLES);
        for (let table of targetTables) {
            try {
                const response = await dynamoDBDocumentClient.send(
                    new DescribeTableCommand({
                        TableName: TABLES[table as keyof typeof TABLES],
                    })
                );

                if (response.Table?.TableStatus === 'ACTIVE') {
                    logger.info(`Connection to "${response.Table.TableName}" table is active.`);
                } else {
                    throw new Error(
                        `Table "${response.Table?.TableName}" is not active. Current status: ${response.Table?.TableStatus}`
                    );
                }
            } catch (error) {
                logger.error(`Error connecting to "${table}" table:`, { error });
                throw new Error(`Error connecting to "${table}" table`);
            }
        }
    }

    static async clearAllData(): Promise<void> {
        try {
            // Get all items from each table and delete them
            // Note: This is not efficient for large datasets, but works for testing

            // Clear chat history
            const chatResult = await dynamoDBDocumentClient.send(
                new ScanCommand({
                    TableName: getTableName('chatHistory'),
                    ProjectionExpression: 'PK, SK',
                })
            );
            const batchDeleteChats = DatabaseUtils.createBatchDeleteRequest('chatHistory', chatResult);
            if (batchDeleteChats) {
                await dynamoDBDocumentClient.send(batchDeleteChats);
            }

            // Clear users
            const userResult = await dynamoDBDocumentClient.send(
                new ScanCommand({
                    TableName: getTableName('users'),
                    ProjectionExpression: 'PK, SK',
                })
            );
            const batchDeleteUsers = DatabaseUtils.createBatchDeleteRequest('users', userResult);
            if (batchDeleteUsers) {
                await dynamoDBDocumentClient.send(batchDeleteUsers);
            }

            // Clear integrations
            const integrationsResult = await dynamoDBDocumentClient.send(
                new ScanCommand({
                    TableName: getTableName('integrations'),
                    ProjectionExpression: 'PK, SK',
                })
            );
            const batchDeleteIntegrations = DatabaseUtils.createBatchDeleteRequest('integrations', integrationsResult);
            if (batchDeleteIntegrations) {
                await dynamoDBDocumentClient.send(batchDeleteIntegrations);
            }
            logger.info('All database data cleared successfully');
        } catch (error) {
            logger.error('Error clearing database data:', { error });
            throw error;
        }
    }

    static createBatchDeleteRequest(tableName: TableNameIdentifier, scanOutput: ScanCommandOutput): BatchWriteCommand | null {
        const batchRequests = [];
        if (scanOutput.Items) {
            for (const item of scanOutput.Items) {
                if (!(item.PK && item.SK)) continue;
                batchRequests.push({
                    DeleteRequest: { Key: { PK: item.PK.S, SK: item.SK.S } },
                });
            }
        }

        if (batchRequests.length === 0) {
            return null;
        }

        return new BatchWriteCommand({
            RequestItems: {
                [getTableName(tableName)]: batchRequests,
            },
        });
    }
}
