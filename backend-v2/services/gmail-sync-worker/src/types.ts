/**
 * Types for Gmail sync worker
 */

/**
 * Composio webhook payload for Gmail events
 */
export interface ComposioWebhookPayload {
  entity_id: string;
  trigger_name: string;
  data: GmailEventData;
}

/**
 * Gmail event data from Composio
 */
export interface GmailEventData {
  id?: string;
  message_id?: string;
  from?: string;
  sender?: string;
  to?: string;
  recipients?: string;
  subject?: string;
  date?: string;
  timestamp?: string;
  body?: string;
  text?: string;
  snippet?: string;
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
