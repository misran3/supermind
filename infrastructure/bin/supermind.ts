#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { AmplifyStack } from '../lib/amplify-stack';
import { ApiV2Stack } from '../lib/api-v2-stack';
import { AuthStack } from '../lib/auth-stack';
import { StorageStack } from '../lib/storage-stack';

const app = new cdk.App();

// Environment configuration
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
};

const amplifyStack = new AmplifyStack(app, 'SupermindAmplifyStack', {
  env,
  description: 'AWS Amplify hosting for Supermind AI Assistant frontend',
});

// Storage Stack - DynamoDB Tables
const storageStack = new StorageStack(app, 'SupermindStorageStack', {
  env,
  description: 'Storage resources (DynamoDB tables) for Supermind AI Assistant',
});

// Auth Stack - Cognito User Pool with built-in Passwordless authentication
const authStack = new AuthStack(app, 'SupermindAuthStack', {
  env,
  description: 'Authentication resources for Supermind AI Assistant',
  amplifyApp: amplifyStack.amplifyApp,
  amplifyBranch: amplifyStack.amplifyBranch,
});

// Add dependencies
authStack.addDependency(amplifyStack);

// API V2 Stack - API Gateway + Lambda Functions (TypeScript/Node.js 22)
const apiV2Stack = new ApiV2Stack(app, 'SupermindApiV2Stack', {
  env,
  description: 'TypeScript-based API Gateway and Lambda functions for Supermind AI Assistant',
  userPool: authStack.userPool,
  userPoolClient: authStack.userPoolClient,
  usersTable: storageStack.usersTable,
  integrationsTable: storageStack.integrationsTable,
  chatHistoryTable: storageStack.chatHistoryTable,
  googleOAuthSecret: storageStack.googleOAuthSecret,
  supermemoryApiKeySecret: storageStack.supermemoryApiKeySecret,
  usersTableEmailIndexName: storageStack.usersTableEmailIndexName,
  amplifyApp: amplifyStack.amplifyApp,
  amplifyBranch: amplifyStack.amplifyBranch,
});

// Add dependencies
apiV2Stack.addDependency(amplifyStack);
apiV2Stack.addDependency(authStack);
apiV2Stack.addDependency(storageStack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'Supermind');
cdk.Tags.of(app).add('Owner', process.env.PROJECT_OWNER || 'Misran');
cdk.Tags.of(app).add('Environment', process.env.ENVIRONMENT || 'development');
