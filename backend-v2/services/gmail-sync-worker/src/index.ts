/**
 * Gmail Sync Worker - Entry point
 *
 * AWS Lambda webhook listener for Gmail messages from Composio
 */

export { lambdaHandler } from "./handler.js";
export type { ComposioWebhookPayload, GmailEventData, WebhookResponse } from "./types.js";
