import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class StorageStack extends cdk.Stack {
  public readonly usersTable: dynamodb.Table;
  public readonly integrationsTable: dynamodb.Table;
  public readonly chatHistoryTable: dynamodb.Table;
  public readonly googleOAuthSecret: secretsmanager.Secret;
  public readonly supermemoryApiKeySecret: secretsmanager.Secret;
  public readonly usersTableEmailIndexName: string;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Generate unique secret identifier to avoid 7-day deletion waiting period
    // Use context variable if provided, otherwise use stack ID suffix
    const secretSuffix = this.node.tryGetContext('secretSuffix') ||
                         cdk.Names.uniqueId(this).slice(-8).toLowerCase();
    const secretPrefix = `supermind/${secretSuffix}`;

    // UsersTable - User profiles, settings, and message queue
    this.usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'SupermindUsersTable',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      // Enable point-in-time recovery
      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },

      // Enable encryption at rest
      encryption: dynamodb.TableEncryption.AWS_MANAGED,

      // TTL attribute for message queue (60s TTL)
      timeToLiveAttribute: 'ttl',

      // Removal policy
      removalPolicy: process.env.ENVIRONMENT === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by email
    this.usersTableEmailIndexName = 'UserEmailIndex';
    this.usersTable.addGlobalSecondaryIndex({
      indexName: this.usersTableEmailIndexName,
      partitionKey: {
        name: 'email',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // IntegrationsTable - Email summaries and calendar events
    this.integrationsTable = new dynamodb.Table(this, 'IntegrationsTable', {
      tableName: 'SupermindIntegrationsTable',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,

      // TTL attribute (30 days for emails, 7 days for calendar events)
      timeToLiveAttribute: 'ttl',

      removalPolicy: process.env.ENVIRONMENT === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by date range
    this.integrationsTable.addGlobalSecondaryIndex({
      indexName: 'DateIndex',
      partitionKey: {
        name: 'user_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'created_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // ChatHistoryTable - Sessions and messages with batching support
    this.chatHistoryTable = new dynamodb.Table(this, 'ChatHistoryTable', {
      tableName: 'SupermindChatHistoryTable',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,

      pointInTimeRecoverySpecification: {
        pointInTimeRecoveryEnabled: true,
      },
      encryption: dynamodb.TableEncryption.AWS_MANAGED,

      // TTL attribute (30 days for messages)
      timeToLiveAttribute: 'ttl',

      removalPolicy: process.env.ENVIRONMENT === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // Add GSI for querying by user_id (all sessions for a user)
    this.chatHistoryTable.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: {
        name: 'user_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'created_at',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Add GSI for querying by batch_id (batched messages)
    this.chatHistoryTable.addGlobalSecondaryIndex({
      indexName: 'BatchIdIndex',
      partitionKey: {
        name: 'batch_id',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'batch_sequence',
        type: dynamodb.AttributeType.NUMBER,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Secrets Manager - Google OAuth Credentials
    // SECURITY: Secrets are created with placeholder values during deployment.
    // Secret names include a unique suffix to avoid 7-day deletion waiting period.
    //
    // After deployment, get the secret name from stack outputs and update:
    //   SECRET_NAME=$(aws cloudformation describe-stacks \
    //     --stack-name SupermindStorageStack \
    //     --query 'Stacks[0].Outputs[?OutputKey==`GoogleOAuthSecretName`].OutputValue' \
    //     --output text)
    //
    //   aws secretsmanager put-secret-value \
    //     --secret-id "$SECRET_NAME" \
    //     --secret-string '{"client_id":"YOUR_CLIENT_ID","client_secret":"YOUR_CLIENT_SECRET","redirect_uri":"http://localhost:3000/oauth/callback"}'
    //
    // This keeps secrets out of CloudFormation templates and version control.
    this.googleOAuthSecret = new secretsmanager.Secret(this, 'GoogleOAuthSecret', {
      secretName: `${secretPrefix}/google-oauth`,
      description: 'Google OAuth 2.0 credentials (client_id and client_secret)',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          client_id: '',
          client_secret: '',
          redirect_uri: 'http://localhost:3000/oauth/callback',
        }),
        generateStringKey: 'placeholder', // Dummy key to satisfy CDK requirements
      },
      removalPolicy: process.env.ENVIRONMENT === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY, // Keep secrets on stack deletion
    });

    // Secrets Manager - Supermemory API Key
    // Update after deployment:
    //   SECRET_NAME=$(aws cloudformation describe-stacks \
    //     --stack-name SupermindStorageStack \
    //     --query 'Stacks[0].Outputs[?OutputKey==`SupermemoryApiKeySecretName`].OutputValue' \
    //     --output text)
    //
    //   aws secretsmanager put-secret-value \
    //     --secret-id "$SECRET_NAME" \
    //     --secret-string '{"api_key":"YOUR_API_KEY"}'
    this.supermemoryApiKeySecret = new secretsmanager.Secret(this, 'SupermemoryApiKeySecret', {
      secretName: `${secretPrefix}/supermemory-api-key`,
      description: 'Supermemory API key for long-term memory storage',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          api_key: '',
        }),
        generateStringKey: 'placeholder',
      },
      removalPolicy: process.env.ENVIRONMENT === 'production' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
    });

    // CloudFormation Outputs
    new cdk.CfnOutput(this, 'UsersTableName', {
      value: this.usersTable.tableName,
      description: 'Users DynamoDB Table Name',
      exportName: 'SupermindUsersTableName',
    });

    new cdk.CfnOutput(this, 'UsersTableArn', {
      value: this.usersTable.tableArn,
      description: 'Users DynamoDB Table ARN',
      exportName: 'SupermindUsersTableArn',
    });

    new cdk.CfnOutput(this, 'UsersTableEmailIndexName', {
      value: this.usersTableEmailIndexName,
      description: 'Users Table Email GSI Name',
      exportName: 'SupermindUsersTableEmailIndexName',
    });

    new cdk.CfnOutput(this, 'IntegrationsTableName', {
      value: this.integrationsTable.tableName,
      description: 'Integrations DynamoDB Table Name',
      exportName: 'SupermindIntegrationsTableName',
    });

    new cdk.CfnOutput(this, 'IntegrationsTableArn', {
      value: this.integrationsTable.tableArn,
      description: 'Integrations DynamoDB Table ARN',
      exportName: 'SupermindIntegrationsTableArn',
    });

    new cdk.CfnOutput(this, 'ChatHistoryTableName', {
      value: this.chatHistoryTable.tableName,
      description: 'Chat History DynamoDB Table Name',
      exportName: 'SupermindChatHistoryTableName',
    });

    new cdk.CfnOutput(this, 'ChatHistoryTableArn', {
      value: this.chatHistoryTable.tableArn,
      description: 'Chat History DynamoDB Table ARN',
      exportName: 'SupermindChatHistoryTableArn',
    });

    new cdk.CfnOutput(this, 'GoogleOAuthSecretArn', {
      value: this.googleOAuthSecret.secretArn,
      description: 'Google OAuth Secret ARN',
      exportName: 'SupermindGoogleOAuthSecretArn',
    });

    new cdk.CfnOutput(this, 'GoogleOAuthSecretName', {
      value: this.googleOAuthSecret.secretName,
      description: 'Google OAuth Secret Name (use this to update the secret)',
      exportName: 'SupermindGoogleOAuthSecretName',
    });

    new cdk.CfnOutput(this, 'SupermemoryApiKeySecretArn', {
      value: this.supermemoryApiKeySecret.secretArn,
      description: 'Supermemory API Key Secret ARN',
      exportName: 'SupermindSupermemoryApiKeySecretArn',
    });

    new cdk.CfnOutput(this, 'SupermemoryApiKeySecretName', {
      value: this.supermemoryApiKeySecret.secretName,
      description: 'Supermemory API Key Secret Name (use this to update the secret)',
      exportName: 'SupermindSupermemoryApiKeySecretName',
    });
  }
}
