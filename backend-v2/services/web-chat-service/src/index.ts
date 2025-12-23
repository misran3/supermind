/**
 * Web Chat Lambda with SSE Streaming and Cognito Authentication
 *
 * This handler uses Lambda Response Streaming (native Node.js support) for
 * Server-Sent Events (SSE) streaming.
 *
 * Architecture:
 * - Native Lambda Response Streaming (no web adapter needed)
 * - Cognito JWT verification with aws-jwt-verify
 * - AWS Lambda Powertools for logging and observability
 * - Orchestrator agent for AI conversation with Supermemory integration
 *
 * Reference:
 * https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-stream.html
 */

import type { APIGatewayProxyEventV2, Context } from 'aws-lambda';
import { Logger, LogLevel } from '@aws-lambda-powertools/logger';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { createOrchestrator } from '@supermind/assistant';
import { SecretsManager } from '@supermind/shared-aws-utils';

// Declare awslambda global for response streaming
declare const awslambda: {
	streamifyResponse: (
		handler: (
			event: APIGatewayProxyEventV2,
			responseStream: NodeJS.WritableStream,
			context: Context
		) => Promise<void>
	) => (event: APIGatewayProxyEventV2, context: Context) => Promise<void>;
	HttpResponseStream: {
		from: (responseStream: NodeJS.WritableStream, metadata: any) => NodeJS.WritableStream;
	};
};

// Initialize AWS Clients
const secretsManager = new SecretsManager(process.env.AWS_REGION);

// Initialize Logger
const logger = new Logger({
  serviceName: "web-chat-service",
  logLevel: LogLevel.INFO,
});

// Initialize Cognito JWT Verifier
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID || "",
  tokenUse: "access",
  clientId: process.env.USER_POOL_CLIENT_ID,
});

type ServerSentEvent = 'message' | 'error' | 'complete' | 'connection';

/**
 * SSE Message Format
 */
interface SSEMessage {
  data: string;
  event: ServerSentEvent;
  id?: string;
  retry?: number;
}

/**
 * Verified JWT Claims
 */
interface CognitoTokenPayload {
  sub: string;
  email?: string;
  "cognito:username"?: string;
  [key: string]: any;
}

/**
 * Chat request body
 */
interface ChatRequest {
  sessionId: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

/**
 * Format message as SSE
 */
function formatSSE(message: SSEMessage): string {
  let output = "";

  if (message.event) {
    output += `event: ${message.event}\n`;
  }

  if (message.id) {
    output += `id: ${message.id}\n`;
  }

  if (message.retry) {
    output += `retry: ${message.retry}\n`;
  }

  // Split data into multiple lines if needed
  const lines = message.data.split("\n");
  for (const line of lines) {
    output += `data: ${line}\n`;
  }

  output += "\n";
  return output;
}

/**
 * Verify Cognito JWT token from Authorization header
 */
async function verifyAuthToken(
  authHeader: string | undefined
): Promise<CognitoTokenPayload> {
  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  // Extract token from "Bearer <token>"
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0]?.toLowerCase() !== "bearer") {
    throw new Error("Invalid Authorization header format. Expected: Bearer <token>");
  }

  const token = parts[1];

  if (!token) {
    throw new Error("Missing token in Authorization header");
  }

  if (!process.env.USER_POOL_ID || !process.env.USER_POOL_CLIENT_ID) {
    throw new Error("Cognito User Pool configuration is missing");
  }

  try {
    // Verify JWT with Cognito
    const payload = await jwtVerifier.verify(token, {
      clientId: process.env.USER_POOL_CLIENT_ID,
      tokenUse: 'id',
    });
    logger.info("User authenticated", {
      email: payload.email,
      sub: payload.sub,
    });
    return payload as CognitoTokenPayload;
  } catch (error) {
    logger.error("Token verification failed", { error });
    throw new Error("Invalid or expired token");
  }
}

/**
 * Fetch Supermemory API key from Secrets Manager
 *
 * @returns Supermemory API key
 */
async function getSupermemoryApiKey(): Promise<string> {
  try {
    if (!process.env.SUPERMEMORY_API_KEY_SECRET_NAME) {
      throw new Error("Supermemory API key secret name is not configured");
    }

    const secret = await secretsManager.getSecret<{ api_key: string }>(
      process.env.SUPERMEMORY_API_KEY_SECRET_NAME,
      true
    );

    if (!secret || typeof secret === 'string' || !secret.api_key) {
      throw new Error('Invalid Supermemory API key format in secrets');
    }

    return secret.api_key;
  } catch (error) {
    logger.error('Failed to fetch Supermemory API key', { error });
    throw new Error('Failed to retrieve Supermemory API key from Secrets Manager');
  }
}

/**
 * Process messages with orchestrator and stream responses
 *
 * @param userId - User ID for the conversation
 * @param messages - Array of messages to process
 * @param supermemoryApiKey - Supermemory API key
 */
async function* streamOrchestratorResponse(
  userId: string,
  sessionId: string,
  messages: ChatRequest['messages'],
  supermemoryApiKey: string
): AsyncGenerator<SSEMessage> {
  try {
    // Create orchestrator instance with streaming enabled
    const orchestrator = createOrchestrator({
      userId,
      sessionId,
      supermemoryApiKey,
      composioApiKey: process.env.COMPOSIO_API_KEY || '',
      streaming: true,
      region: process.env.AWS_REGION || 'us-east-1',
      verbose: process.env.VERBOSE === 'true',
    });

    // Combine all user messages into a single message
    // (or process them sequentially based on your requirements)
    const combinedMessage = messages
      .filter(m => m.role === 'user')
      .map(m => m.content)
      .join('\n\n');

    if (!combinedMessage.trim()) {
      throw new Error('No user messages found in request');
    }

    // Process the message stream
    const stream = await orchestrator.processMessageStream(combinedMessage);

    // Stream text chunks as SSE
    let chunkId = 1;
    for await (const chunk of stream.textStream) {
      yield {
        data: chunk,
        id: String(chunkId++),
        event: 'message',
      };
    }

    // Send completion message
    yield {
      data: '[DONE]',
      event: 'complete',
    };
  } catch (error) {
    logger.error('Error in orchestrator streaming', { error });

    // Send error message
    yield {
      data: JSON.stringify({
        error: error instanceof Error ? error.message : 'Internal streaming error',
      }),
      event: 'error',
    };
  }
}

/**
 * Main Lambda handler with streaming
 */
const lambdaHandler = async (
	event: APIGatewayProxyEventV2,
	responseStream: NodeJS.WritableStream,
	context: Context
): Promise<void> => {
  // Add metadata for response streaming
  // Note: CORS headers are handled by Lambda Function URL configuration
  // Do not set Access-Control-* headers here to avoid duplicates
  const metadata = {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no", // Disable buffering in nginx/proxy
    },
  };

  try {
    // Log incoming request
    logger.info("Incoming request", {
      httpMethod: event.requestContext?.http?.method,
      path: event.requestContext?.http?.path,
      headers: event.headers,
      hasBody: !!event.body,
    });

    // Verify authentication
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    const claims = await verifyAuthToken(authHeader);
    const userId = claims.sub;
    const userEmail = claims.email || claims["cognito:username"];

    logger.info("Starting chat stream", {
      userId,
      userEmail,
      requestId: context.awsRequestId,
    });

    // Parse request body to get messages
    if (!event.body) {
      throw new Error("Missing request body");
    }

    const requestBody: ChatRequest = JSON.parse(event.body);

    const sessionId = requestBody.sessionId;

    if (!requestBody.messages || !Array.isArray(requestBody.messages)) {
      throw new Error("Invalid request: messages array is required");
    }

    if (requestBody.messages.length === 0) {
      throw new Error("Invalid request: at least one message is required");
    }

    // Fetch Supermemory API key
    const supermemoryApiKey = await getSupermemoryApiKey();

    // Write metadata
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    // Send initial connection message
    responseStream.write(
      formatSSE({
        data: JSON.stringify({ type: "connection", status: "connected", userId }),
        event: "connection",
      })
    );

    // Stream messages from orchestrator
    for await (const message of streamOrchestratorResponse(
      userId,
      sessionId,
      requestBody.messages,
      supermemoryApiKey
    )) {
      responseStream.write(formatSSE(message));
    }

    // Close the stream
    responseStream.end();

    logger.info("Chat stream completed", { userId });
  } catch (error) {
    logger.error("Error in chat stream", { error });

    // Determine status code based on error type
    let statusCode = 500;
    if (error instanceof Error) {
      if (error.message.includes("Authorization") || error.message.includes("token")) {
        statusCode = 401;
      } else if (error.message.includes("Invalid request")) {
        statusCode = 400;
      }
    }

    // Send error as SSE
    // Note: CORS headers are handled by Lambda Function URL configuration
    const errorMetadata = {
      statusCode,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    };

    responseStream = awslambda.HttpResponseStream.from(responseStream, errorMetadata);

    responseStream.write(
      formatSSE({
        data: JSON.stringify({
          error: error instanceof Error ? error.message : "Internal server error",
        }),
        event: "error",
      })
    );

    responseStream.end();
  }
};

// Export the streamified handler
export const handler = awslambda.streamifyResponse(lambdaHandler);
