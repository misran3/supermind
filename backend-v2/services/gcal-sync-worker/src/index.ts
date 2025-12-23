/**
 * Google Calendar Sync Worker - Entry point
 *
 * AWS Lambda webhook listener for Google Calendar events from Composio
 */

export { lambdaHandler } from "./handler.js";
export type { ComposioWebhookPayload, CalendarEventData, WebhookResponse } from "./types.js";
