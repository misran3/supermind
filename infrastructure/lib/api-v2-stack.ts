import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

export interface ApiV2StackProps extends cdk.StackProps {
	userPool: cognito.UserPool;
	userPoolClient: cognito.UserPoolClient;
	usersTable: dynamodb.Table;
	integrationsTable: dynamodb.Table;
	chatHistoryTable: dynamodb.Table;
	googleOAuthSecret: secretsmanager.Secret;
	supermemoryApiKeySecret: secretsmanager.Secret;
	usersTableEmailIndexName: string;
	amplifyApp: amplify.CfnApp;
	amplifyBranch: amplify.CfnBranch;
}

interface TypeScriptLambdaConfig {
	name: string;
	servicePath: string;
	handler: string;
	description: string;
	additionalEnv?: Record<string, string>;
	tableGrants?: dynamodb.Table[];
	timeout?: cdk.Duration;
	memorySize?: number;
	streaming?: boolean; // Enable response streaming
	functionUrlConfig?: {
		authType: lambda.FunctionUrlAuthType;
		cors?: lambda.FunctionUrlCorsOptions;
	};
}

export class ApiV2Stack extends cdk.Stack {
	public readonly api: apigateway.RestApi;
	private readonly backendV2Root: string = path.join(__dirname, '../../backend-v2');
	private readonly commonEnv: Record<string, string>;

	constructor(scope: Construct, id: string, props: ApiV2StackProps) {
		super(scope, id, props);

		// Common environment variables for all Lambda functions
		this.commonEnv = {
			ENVIRONMENT: process.env.ENVIRONMENT || 'development',
			LOG_LEVEL: process.env.LOG_LEVEL || 'INFO',
			DYNAMODB_USER_TABLE: props.usersTable.tableName, 
			DYNAMODB_INTEGRATIONS_TABLE: props.integrationsTable.tableName,
			DYNAMODB_CHAT_HISTORY_TABLE: props.chatHistoryTable.tableName,
			AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1', // Optimize SDK performance
		};

		// Create Cognito Authorizer for API Gateway
		const cognitoAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizerV2', {
			cognitoUserPools: [props.userPool],
			identitySource: 'method.request.header.Authorization',
			authorizerName: 'SupermindCognitoAuthorizerV2',
		});

		// Create REST API (for future endpoints if needed)
		this.api = new apigateway.RestApi(this, 'SupermindApiV2', {
			restApiName: 'Supermind AI Assistant API V2',
			description: 'TypeScript-based API for Supermind AI Assistant',
			deployOptions: {
				stageName: process.env.STAGE_NAME || 'dev',
				loggingLevel: apigateway.MethodLoggingLevel.INFO,
				dataTraceEnabled: true,
				tracingEnabled: true,
				metricsEnabled: true,
			},
			defaultCorsPreflightOptions: {
				allowOrigins: apigateway.Cors.ALL_ORIGINS,
				allowMethods: apigateway.Cors.ALL_METHODS,
				allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key', 'X-Amz-Security-Token'],
				allowCredentials: true,
			},
			cloudWatchRole: true,
		});

		// =================================================================
		// 1. WEB CHAT SERVICE - Native Response Streaming
		// =================================================================
		const webChatFn = this.createTypeScriptLambda({
			name: 'web-chat-service',
			servicePath: 'services/web-chat-service',
			handler: 'index.handler',
			description: 'Web chat with native Node.js response streaming and Cognito auth',
			timeout: cdk.Duration.minutes(5),
			memorySize: 1024,
			streaming: true, // Enable response streaming
			additionalEnv: {
				USER_POOL_ID: props.userPool.userPoolId,
				USER_POOL_CLIENT_ID: props.userPoolClient.userPoolClientId,
				SUPERMEMORY_API_KEY_SECRET_NAME: props.supermemoryApiKeySecret.secretName,
				SUPERMEMORY_API_KEY: process.env.SUPERMEMORY_API_KEY || '',
				COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY || '',
				LANGFUSE_PUBLIC_KEY: process.env.LANGFUSE_PUBLIC_KEY || '',
				LANGFUSE_SECRET_KEY: process.env.LANGFUSE_SECRET_KEY || '',
				LANGFUSE_BASE_URL: process.env.LANGFUSE_BASE_URL || 'https://us.cloud.langfuse.com',
			},
			tableGrants: [props.usersTable, props.integrationsTable, props.chatHistoryTable],
		});

		// Grant Secrets Manager read permissions
		props.supermemoryApiKeySecret.grantRead(webChatFn);

		// Add Bedrock permissions
		webChatFn.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
				resources: ['*'], // TODO: Restrict to specific model ARNs
			})
		);

		// Create Function URL with response streaming
		// Note: When using credentials, allowedOrigins cannot be '*'
		const webChatFunctionUrl = webChatFn.addFunctionUrl({
			authType: lambda.FunctionUrlAuthType.NONE, // Auth handled in code via Cognito JWT
			invokeMode: lambda.InvokeMode.RESPONSE_STREAM, // 🔥 Enable streaming
			cors: {
				allowedOrigins: [
					'http://localhost:3000',
					'https://localhost:3000',
					`https://${props.amplifyBranch.branchName}.${props.amplifyApp.attrAppId}.amplifyapp.com`
				],
				allowedMethods: [lambda.HttpMethod.ALL],
				allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Amz-Date', 'X-Api-Key', 'X-Amz-Security-Token'],
				exposedHeaders: ['Content-Type', 'X-Amz-Request-Id'],
				maxAge: cdk.Duration.seconds(300),
			},
		});

		// Output the Function URL
		new cdk.CfnOutput(this, 'WebChatStreamUrl', {
			value: webChatFunctionUrl.url,
			description: 'Web Chat SSE Stream URL (TypeScript with native streaming)',
			exportName: 'SupermindWebChatStreamUrl',
		});

		new cdk.CfnOutput(this, 'WebChatStreamUrlV2', {
			value: webChatFunctionUrl.url.replace(/\/$/, ''), // Remove trailing slash if present,
			description: 'Web Chat SSE Stream URL (TypeScript with native streaming)',
			exportName: 'SupermindWebChatStreamUrlV2',
		});

		// =================================================================
		// 2. WHATSAPP CHAT SERVICE - Standard Lambda with Function URL
		// =================================================================
		const whatsAppChatFn = this.createTypeScriptLambda({
			name: 'whatsapp-chat-service',
			servicePath: 'services/whatsapp-chat-service',
			handler: 'index.handler',
			description: 'WhatsApp chat handler for Twilio webhook (TypeScript)',
			timeout: cdk.Duration.seconds(30),
			memorySize: 512,
			additionalEnv: {
				SUPERMEMORY_API_KEY_SECRET_ARN: props.supermemoryApiKeySecret.secretArn,
				SUPERMEMORY_API_KEY: process.env.SUPERMEMORY_API_KEY || '',
			},
			tableGrants: [props.usersTable, props.integrationsTable, props.chatHistoryTable],
		});

		// Grant Secrets Manager read permissions
		props.supermemoryApiKeySecret.grantRead(whatsAppChatFn);

		// Add Bedrock permissions
		whatsAppChatFn.addToRolePolicy(
			new iam.PolicyStatement({
				effect: iam.Effect.ALLOW,
				actions: ['bedrock:InvokeModel'],
				resources: ['*'], // TODO: Restrict to specific model ARNs
			})
		);

		// Create Function URL for Twilio webhook
		const whatsAppFunctionUrl = whatsAppChatFn.addFunctionUrl({
			authType: lambda.FunctionUrlAuthType.NONE, // Twilio webhooks don't use AWS auth
			cors: {
				allowedOrigins: ['*'],
				allowedMethods: [lambda.HttpMethod.POST],
				allowedHeaders: ['*'],
			},
		});

		// Output the Function URL
		new cdk.CfnOutput(this, 'WhatsAppWebhookUrlV2', {
			value: whatsAppFunctionUrl.url,
			description: 'WhatsApp Webhook URL for Twilio (TypeScript)',
			exportName: 'SupermindWhatsAppWebhookUrlV2',
		});

		// =================================================================
		// 3. USER PROFILE SERVICE - API Gateway with Cognito Auth
		// =================================================================
		const userProfileFn = this.createTypeScriptLambda({
			name: 'user-profile-service',
			servicePath: 'services/user-profile-service',
			handler: 'index.handler',
			description: 'User profile and app settings CRUD operations',
			tableGrants: [props.usersTable, props.chatHistoryTable],
			additionalEnv: {
				SUPERMEMORY_API_KEY: process.env.SUPERMEMORY_API_KEY || '',
			}
		});

		// API Gateway routes for user profile
		const profileResource = this.api.root.addResource('profile');
		profileResource.addMethod('GET', new apigateway.LambdaIntegration(userProfileFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		profileResource.addMethod('POST', new apigateway.LambdaIntegration(userProfileFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		profileResource.addMethod('PUT', new apigateway.LambdaIntegration(userProfileFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		profileResource.addMethod('DELETE', new apigateway.LambdaIntegration(userProfileFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		// API Gateway routes for app settings
		const settingsResource = this.api.root.addResource('settings');
		settingsResource.addMethod('GET', new apigateway.LambdaIntegration(userProfileFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		settingsResource.addMethod('PUT', new apigateway.LambdaIntegration(userProfileFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		settingsResource.addMethod('DELETE', new apigateway.LambdaIntegration(userProfileFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		// =================================================================
		// 4. INTEGRATIONS SERVICE - API Gateway with Cognito Auth
		// =================================================================
		const integrationsFn = this.createTypeScriptLambda({
			name: 'integrations-service',
			servicePath: 'services/integrations-service',
			handler: 'index.handler',
			description: 'Third-party integrations and event logs CRUD operations',
			tableGrants: [props.integrationsTable],
			additionalEnv: {
				COMPOSIO_API_KEY: process.env.COMPOSIO_API_KEY || '',
			},
		});

		// API Gateway routes for integrations
		const integrationsResource = this.api.root.addResource('integrations');
		integrationsResource.addMethod('GET', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		integrationsResource.addMethod('POST', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		// Composio integration routes
		const composioResource = integrationsResource.addResource('composio');
		const initiateResource = composioResource.addResource('initiate');
		initiateResource.addMethod('POST', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		const statusResource = composioResource.addResource('status');
		const connectionIdResource = statusResource.addResource('{connectionId}');
		connectionIdResource.addMethod('GET', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		const integrationConnectorResource = integrationsResource.addResource('{connectorName}');
		integrationConnectorResource.addMethod('GET', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		integrationConnectorResource.addMethod('PUT', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		integrationConnectorResource.addMethod('DELETE', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		// API Gateway routes for events
		const eventsResource = this.api.root.addResource('events');
		eventsResource.addMethod('GET', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		eventsResource.addMethod('POST', new apigateway.LambdaIntegration(integrationsFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		// =================================================================
		// 5. CHAT HISTORY SERVICE - API Gateway with Cognito Auth
		// =================================================================
		const chatHistoryFn = this.createTypeScriptLambda({
			name: 'chat-history-service',
			servicePath: 'services/chat-history-service',
			handler: 'index.handler',
			description: 'Chat sessions and messages CRUD operations',
			tableGrants: [props.chatHistoryTable],
		});

		// API Gateway routes for sessions
		const sessionsResource = this.api.root.addResource('sessions');
		sessionsResource.addMethod('GET', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		sessionsResource.addMethod('POST', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		const sessionIdResource = sessionsResource.addResource('{sessionId}');
		sessionIdResource.addMethod('GET', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		sessionIdResource.addMethod('PUT', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		sessionIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		// API Gateway routes for messages
		const messagesResource = sessionIdResource.addResource('messages');
		messagesResource.addMethod('GET', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		messagesResource.addMethod('POST', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		const messageIdResource = messagesResource.addResource('{messageId}');
		messageIdResource.addMethod('GET', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		messageIdResource.addMethod('PUT', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});
		messageIdResource.addMethod('DELETE', new apigateway.LambdaIntegration(chatHistoryFn), {
			authorizationType: apigateway.AuthorizationType.COGNITO,
			authorizer: cognitoAuthorizer,
		});

		// =================================================================
		// STACK OUTPUTS
		// =================================================================
		new cdk.CfnOutput(this, 'ApiUrl', {
			value: this.api.url,
			description: 'API Gateway URL V2',
			exportName: 'SupermindApiUrl',
		});

		new cdk.CfnOutput(this, 'ApiUrlV2', {
			value: this.api.url.replace(/\/$/, ''), // Remove trailing slash if present
			description: 'API Gateway URL V2',
			exportName: 'SupermindApiUrlV2',
		});

		new cdk.CfnOutput(this, 'ApiIdV2', {
			value: this.api.restApiId,
			description: 'API Gateway ID V2',
			exportName: 'SupermindApiIdV2',
		});
	}

	/**
	 * Create TypeScript Lambda function with Bun bundling
	 */
	private createTypeScriptLambda(config: TypeScriptLambdaConfig): lambda.Function {
		// Create CloudWatch Log Group
		const logGroup = new logs.LogGroup(this, `${config.name}LogGroup`, {
			logGroupName: `/aws/lambda/supermind-${config.name.toLowerCase()}`,
			retention:
				process.env.ENVIRONMENT === 'production'
					? logs.RetentionDays.ONE_MONTH
					: logs.RetentionDays.ONE_WEEK,
			removalPolicy:
				process.env.ENVIRONMENT === 'production'
					? cdk.RemovalPolicy.RETAIN
					: cdk.RemovalPolicy.DESTROY,
		});

		// Create Lambda function with Bun bundling
		const fn = new lambda.Function(this, config.name, {
			functionName: `supermind-${config.name.toLowerCase()}`,
			description: config.description,
			handler: config.handler,
			runtime: lambda.Runtime.NODEJS_22_X, // Use Node.js 22
			architecture: lambda.Architecture.ARM_64,
			memorySize: config.memorySize || 512,
			timeout: config.timeout || cdk.Duration.seconds(30),
			code: lambda.Code.fromAsset(this.backendV2Root, {
				bundling: {
					image: lambda.Runtime.NODEJS_22_X.bundlingImage,
					command: [
						'bash',
						'-c',
						[
							// Install Bun in the container
							'curl -fsSL https://bun.sh/install | bash',
							'export BUN_INSTALL="$HOME/.bun"',
							'export PATH="$BUN_INSTALL/bin:$PATH"',

							// Navigate to backend-v2 workspace
							'cd /asset-input',

							// Install all workspace dependencies
							'bun install',

							// Build the specific service with proper bundling
							// --compile bundles everything into a single file
							// --external:@aws-sdk/* excludes AWS SDK (already in Lambda runtime)
							`cd ${config.servicePath}`,
							'mkdir -p /asset-output',
							'bun build src/index.ts --target=node --format=esm --minify --sourcemap --external="@aws-sdk/*" --outdir=/asset-output',

							// Create minimal package.json for ESM support
							'echo \'{"type":"module"}\' > /asset-output/package.json',
						].join(' && '),
					],
					user: 'root',
				},
			}),
			environment: {
				...this.commonEnv,
				...config.additionalEnv,
				NODE_OPTIONS: '--enable-source-maps', // Enable source maps for better debugging
			},
			tracing: lambda.Tracing.ACTIVE,
			logGroup: logGroup,
		});

		// Grant DynamoDB access
		config.tableGrants?.forEach((table) => {
			table.grantReadWriteData(fn);
		});

		return fn;
	}
}
