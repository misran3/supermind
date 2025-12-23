/**
 * AI agent for processing Gmail messages using Vercel AI SDK + Bedrock
 */

import { bedrock } from "@ai-sdk/amazon-bedrock";
import { generateText } from "ai";
import { Logger } from "@aws-lambda-powertools/logger";
import type { GmailEventData } from "./types.js";

const logger = new Logger({ serviceName: "gmail-sync-agent" });

/**
 * Email enhancement agent using Vercel AI SDK with AWS Bedrock
 */
export class EmailAgent {
  private model: ReturnType<typeof bedrock>;

  constructor() {
    const modelId = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
    const region = process.env.AWS_REGION || "us-east-1";

    this.model = bedrock(modelId, {
      region,
    });
  }

  /**
   * Process email data and create an enhanced memory string
   *
   * @param emailData - Raw email data from Composio webhook
   * @returns Enhanced, structured string suitable for Supermemory storage
   */
  async processEmail(emailData: GmailEventData): Promise<string> {
    const prompt = this.buildPrompt(emailData);

    try {
      logger.info("Processing email with AI agent");

      const { text } = await generateText({
        model: this.model,
        prompt,
        temperature: 0.7,
        maxTokens: 500,
      });

      logger.info("Successfully enhanced email", { contentLength: text.length });
      return text;
    } catch (error) {
      logger.error("Failed to enhance email with AI", { error });
      // Fallback: return basic formatted email data
      return this.createFallbackSummary(emailData);
    }
  }

  /**
   * Build the AI prompt for email enhancement
   */
  private buildPrompt(emailData: GmailEventData): string {
    return `Analyze the following email and create a concise, structured summary:

Email Data:
${JSON.stringify(emailData, null, 2)}

Extract and format:
1. Sender and recipients (To/CC)
2. Subject line
3. Key points or main message
4. Action items or requests (if any)
5. Important dates, deadlines, or references
6. Relevant context or background

Format the output as a clear, searchable memory entry that a personal AI assistant
can use to help the user remember this communication and respond appropriately.

Keep it concise but informative (200-300 words max).
Focus on what matters for future recall and context.`;
  }

  /**
   * Create a basic summary if AI enhancement fails
   */
  private createFallbackSummary(emailData: GmailEventData): string {
    const parts: string[] = [];

    const sender = emailData.from || emailData.sender;
    if (sender) {
      parts.push(`From: ${sender}`);
    }

    const recipients = emailData.to || emailData.recipients;
    if (recipients) {
      parts.push(`To: ${recipients}`);
    }

    if (emailData.subject) {
      parts.push(`Subject: ${emailData.subject}`);
    }

    const date = emailData.date || emailData.timestamp;
    if (date) {
      parts.push(`Date: ${date}`);
    }

    const body = emailData.body || emailData.text || emailData.snippet;
    if (body) {
      // Truncate long bodies
      const bodyPreview = body.length > 500 ? `${body.substring(0, 500)}...` : body;
      parts.push(`Message: ${bodyPreview}`);
    }

    return parts.length > 0 ? parts.join("\n") : "Email message (details unavailable)";
  }
}
