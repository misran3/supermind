/**
 * Type definitions and Zod schemas for the AI assistant
 */

import { z } from 'zod';

/**
 * Memory category types
 */
export const MemoryCategory = z.enum([
	'core_identity',
	'preferences',
	'external_data',
	'episodic_memory',
]);
export type MemoryCategory = z.infer<typeof MemoryCategory>;

/**
 * Memory source types
 */
export const MemorySource = z.enum(['user_chat', 'gmail', 'google_calendar', 'system']);
export type MemorySource = z.infer<typeof MemorySource>;

/**
 * Orchestrator configuration
 */
export interface OrchestratorConfig {
	/**
	 * User ID for this assistant instance
	 */
	userId: string;

	/**
	 * Session ID for conversation context
	 */
	sessionId: string;

	/**
	 * Supermemory API key
	 */
	supermemoryApiKey: string;

	/**
	 * Whether to enable streaming responses
	 */
	streaming?: boolean;

	/**
	 * AWS region for Bedrock
	 */
	region?: string;

	/**
	 * Bedrock model ID
	 */
	modelId?: string;

	/**
	 * Enable verbose logging
	 */
	verbose?: boolean;

	/**
	 * Composio API key for toolkit access
	 * Required for sub-agent delegation
	 */
	composioApiKey?: string;

	/**
	 * Connected account IDs for integrations (optional fallback)
	 * Map of connector name to Composio connection ID
	 *
	 * NOTE: Connection IDs are automatically fetched from DynamoDB.
	 * This field is only used as a fallback for testing/development
	 * or when DynamoDB fetch fails.
	 */
	connectionIds?: {
		gmail?: string;
		google_calendar?: string;
		[key: string]: string | undefined;
	};

	/**
	 * Tone of response
	 * Valid values are 'concise and direct', 'professional and friendly', 'detailed and conversational'
	 */
	toneOfResponse?: string;
}

/**
 * Tool execution result
 */
export const ToolResult = z.object({
	success: z.boolean(),
	message: z.string(),
	data: z.any().optional(),
});
export type ToolResult = z.infer<typeof ToolResult>;

export interface RunUsage {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}

/**
 * Orchestrator response for non-streaming
 */
export interface OrchestratorResponse {
	text: string;
	finishReason?: string;
	usage: RunUsage;
}

/**
 * Message in conversation
 */
export interface Message {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

/**
 * Add memory tool parameters
 */
export const AddMemoryParams = z.object({
	content: z.string().describe('The memory content to store'),
	source: MemorySource.optional().describe('Source of the memory'),
	customId: z.string().optional().describe('Optional custom identifier'),
});
export type AddMemoryParams = z.infer<typeof AddMemoryParams>;

/**
 * Search memory tool parameters
 */
export const SearchMemoryParams = z.object({
	query: z.string().describe('Search query to find relevant memories'),
	limit: z.number().optional().default(10).describe('Maximum number of results to return'),
});
export type SearchMemoryParams = z.infer<typeof SearchMemoryParams>;

/**
 * Update memory tool parameters
 */
export const UpdateMemoryParams = z.object({
	memoryId: z.string().describe('ID of the memory to update'),
	content: z.string().describe('New content for the memory'),
});
export type UpdateMemoryParams = z.infer<typeof UpdateMemoryParams>;

/**
 * Delete memory tool parameters
 */
export const DeleteMemoryParams = z.object({
	memoryId: z.string().describe('ID of the memory to delete'),
});
export type DeleteMemoryParams = z.infer<typeof DeleteMemoryParams>;
