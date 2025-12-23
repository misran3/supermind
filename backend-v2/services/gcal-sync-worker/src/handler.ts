/**
 * AWS Lambda handler for Google Calendar webhook events
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2, Context } from "aws-lambda";
import { Logger } from "@aws-lambda-powertools/logger";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { MemoryManager, MemoryCategory, MemorySource } from "@supermind/supermemory-wrapper";
import { CalendarAgent } from "./agent.js";
import type { ComposioWebhookPayload, WebhookResponse } from "./types.js";

// Initialize AWS Lambda Powertools
const logger = new Logger({ serviceName: "gcal-sync-webhook" });
const tracer = new Tracer({ serviceName: "gcal-sync-webhook" });

/**
 * Webhook handler class for processing Composio Calendar events
 */
class WebhookHandler {
  private memoryManager: MemoryManager;
  private calendarAgent: CalendarAgent;

  constructor() {
    const apiKey = process.env.SUPERMEMORY_API_KEY;
    if (!apiKey) {
      throw new Error("SUPERMEMORY_API_KEY environment variable is required");
    }

    this.memoryManager = new MemoryManager({ apiKey });
    this.calendarAgent = new CalendarAgent();

    logger.info("WebhookHandler initialized");
  }

  /**
   * Process incoming Composio webhook event
   *
   * @param eventBody - Parsed webhook JSON body
   * @returns Response with status and details
   */
  @tracer.captureMethod()
  async processWebhook(eventBody: ComposioWebhookPayload): Promise<WebhookResponse> {
    try {
      // Extract entity_id (user_id) from webhook
      const { entity_id: entityId, trigger_name: triggerName, data: eventData } = eventBody;

      if (!entityId) {
        logger.error("Missing entity_id in webhook payload", { payload: eventBody });
        return {
          status: "error",
          message: "Missing entity_id in webhook payload",
        };
      }

      logger.info("Processing calendar webhook", { entityId, triggerName });

      // Enhance the calendar event using AI
      const enhancedContent = await this.calendarAgent.processCalendarEvent(eventData);

      // Store in Supermemory
      const response = await this.memoryManager.addMemory({
        content: enhancedContent,
        userId: entityId,
        category: MemoryCategory.WORK_CONTEXT,
        source: MemorySource.CALENDAR_SYNC,
        customId: eventData.id || eventData.event_id,
      });

      logger.info("Successfully stored calendar memory", {
        memoryId: response.id,
        userId: entityId,
        status: response.status,
      });

      return {
        status: "success",
        memory_id: response.id,
        entity_id: entityId,
        trigger_name: triggerName,
      };
    } catch (error) {
      logger.error("Failed to process calendar webhook", {
        error,
        payload: eventBody,
      });

      return {
        status: "error",
        message: error instanceof Error ? error.message : String(error),
        entity_id: eventBody.entity_id,
      };
    }
  }
}

// Initialize handler (reuse across warm starts)
const handler = new WebhookHandler();

/**
 * AWS Lambda handler function for Function URL
 *
 * @param event - Lambda Function URL event
 * @param context - Lambda context
 * @returns HTTP response
 */
export const lambdaHandler = async (
  event: APIGatewayProxyEventV2,
  context: Context
): Promise<APIGatewayProxyResultV2> => {
  logger.addContext(context);

  logger.info("Received calendar webhook event", { event });

  try {
    // Parse JSON body
    let body: ComposioWebhookPayload;

    if (event.body) {
      if (event.isBase64Encoded) {
        const decoded = Buffer.from(event.body, "base64").toString("utf-8");
        body = JSON.parse(decoded);
      } else {
        body = JSON.parse(event.body);
      }
    } else {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "error",
          message: "Missing request body",
        }),
      };
    }

    // Process the webhook
    const result = await handler.processWebhook(body);

    // Return HTTP response
    const statusCode = result.status === "success" ? 200 : 500;

    return {
      statusCode,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.error("Invalid JSON in request body", { error });
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "error",
          message: "Invalid JSON in request body",
        }),
      };
    }

    logger.error("Unhandled exception in lambda handler", { error });
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "error",
        message: "Internal server error",
      }),
    };
  }
};
