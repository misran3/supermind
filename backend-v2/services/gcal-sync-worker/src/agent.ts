/**
 * AI agent for processing Google Calendar events using Vercel AI SDK + Bedrock
 */

import { bedrock, createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { generateText } from "ai";
import { Logger } from "@aws-lambda-powertools/logger";
import type { CalendarEventData } from "./types.js";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { supermemoryTools } from "@supermemory/tools/ai-sdk";

const logger = new Logger({ serviceName: "gcal-sync-agent" });

/**
 * Calendar enhancement agent using Vercel AI SDK with AWS Bedrock
 */
export class CalendarAgent {
  private model: ReturnType<typeof bedrock>;

  constructor() {
    const modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
    const region = process.env.AWS_REGION || "us-east-1";

    this.model = createAmazonBedrock({
      region,
      credentialProvider: fromNodeProviderChain(),
    })(modelId);
  }

  /**
   * Process calendar event data and create an enhanced memory string
   *
   * @param eventData - Raw calendar event data from Composio webhook
   * @returns Enhanced, structured string suitable for Supermemory storage
   */
  async processCalendarEvent(eventData: CalendarEventData): Promise<string> {
    const prompt = this.buildPrompt(eventData);

    try {
      logger.info("Processing calendar event with AI agent");

      const { text } = await generateText({
        model: this.model,
        prompt,
        temperature: 0.7,
        maxOutputTokens: 500,
        tools: supermemoryTools(process.env.SUPERMEMORY_API_KEY || ''),
      });

      logger.info("Successfully enhanced calendar event", { contentLength: text.length });
      return text;
    } catch (error) {
      logger.error("Failed to enhance calendar event with AI", { error });
      // Fallback: return basic formatted event data
      return this.createFallbackSummary(eventData);
    }
  }

  /**
   * Build the AI prompt for calendar event enhancement
   */
  private buildPrompt(eventData: CalendarEventData): string {
    return `Analyze the following calendar event and create a concise, structured summary:

Event Data:
${JSON.stringify(eventData, null, 2)}

Extract and format:
1. Event title and description
2. Date, time, and duration
3. Attendees (if any)
4. Location (if any)
5. Key action items or discussion points (if mentioned)
6. Any important context or notes

Format the output as a clear, searchable memory entry that a personal AI assistant
can use to help the user remember this event and its details.

Keep it concise but informative (200-300 words max).`;
  }

  /**
   * Create a basic summary if AI enhancement fails
   */
  private createFallbackSummary(eventData: CalendarEventData): string {
    const parts: string[] = [];

    const title = eventData.title || eventData.summary;
    if (title) {
      parts.push(`Event: ${title}`);
    }

    if (eventData.start) {
      parts.push(`Start: ${eventData.start}`);
    }

    if (eventData.end) {
      parts.push(`End: ${eventData.end}`);
    }

    if (eventData.attendees) {
      const attendeeList = Array.isArray(eventData.attendees)
        ? eventData.attendees.join(", ")
        : eventData.attendees;
      parts.push(`Attendees: ${attendeeList}`);
    }

    if (eventData.location) {
      parts.push(`Location: ${eventData.location}`);
    }

    if (eventData.description) {
      parts.push(`Description: ${eventData.description}`);
    }

    return parts.length > 0 ? parts.join("\n") : "Calendar event (details unavailable)";
  }
}
