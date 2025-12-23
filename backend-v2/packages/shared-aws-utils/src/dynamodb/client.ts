import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const dynamoDBClient = new DynamoDBClient({ region: process.env.AWS_REGION });
export const dynamoDBDocumentClient = DynamoDBDocumentClient.from(dynamoDBClient);

export const TABLES = {
    users: process.env.DYNAMODB_USER_TABLE || 'SupermindUsersTable',
    integrations: process.env.DYNAMODB_INTEGRATIONS_TABLE || 'SupermindIntegrationsTable',
    chatHistory: process.env.DYNAMODB_CHAT_HISTORY_TABLE || 'SupermindChatHistoryTable',
};

export type TableNameIdentifier = keyof typeof TABLES;
export type TableNameIdentifiers = TableNameIdentifier[];

export const getTableName = (tableKey: TableNameIdentifier): string => {
    return TABLES[tableKey];
};
