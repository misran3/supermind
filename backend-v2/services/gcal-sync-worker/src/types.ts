/**
 * Types for Google Calendar sync worker
 */

/**
 * Composio webhook payload for Google Calendar events
 */
export interface ComposioWebhookPayload {
  entity_id: string;
  trigger_name: string;
  data: CalendarEventData;
}

/**
 * Calendar event data from Composio
 */
export interface CalendarEventData {
  id?: string;
  event_id?: string;
  title?: string;
  summary?: string;
  start?: string;
  end?: string;
  attendees?: string[] | string;
  location?: string;
  description?: string;
  [key: string]: unknown;
}

/**
 * Response from webhook handler
 */
export interface WebhookResponse {
  status: "success" | "error";
  message?: string;
  memory_id?: string;
  entity_id?: string;
  trigger_name?: string;
}
