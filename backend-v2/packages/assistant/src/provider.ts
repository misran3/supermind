/**
 * AI Provider configuration with Supermemory integration
 */

import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';
import { withSupermemory } from '@supermemory/tools/ai-sdk';

/**
 * Provider configuration options
 */
export interface ProviderConfig {
	/**
	 * User ID for Supermemory
	 */
	userId: string;

	/**
	 * Supermemory API key
	 */
	supermemoryApiKey: string;

	/**
	 * AWS region for Bedrock
	 * @default 'us-east-1'
	 */
	region?: string;

	/**
	 * Bedrock model ID
	 * @default 'us.anthropic.claude-3-5-haiku-20241022-v1:0'
	 */
	modelId?: string;

	/**
	 * Enable verbose logging for Supermemory
	 * @default false
	 */
	verbose?: boolean;

	/**
	 * Whether to add memory to the model
	 * @default true
	 */
	addMemory?: boolean;

	/**
	 * Optional conversation ID for context grouping (sessionId from Chat History must be passed here)
	 */
	conversationId?: string;
}

/**
 * Default model configurations
 */
export const DEFAULT_MODELS = {
	// Fast and efficient for orchestration
	HAIKU: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
	// More capable for complex reasoning
	SONNET: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0',
} as const;

/**
 * Create a Bedrock model instance with Supermemory integration
 *
 * @param config - Provider configuration
 * @returns Configured language model with Supermemory
 *
 * @example
 * ```typescript
 * const model = createBedrockWithMemory({
 *   userId: 'user_123',
 *   supermemoryApiKey: process.env.SUPERMEMORY_API_KEY!,
 *   region: 'us-east-1',
 *   modelId: DEFAULT_MODELS.HAIKU,
 * });
 * ```
 */
export function createBedrockWithMemory(config: ProviderConfig): LanguageModelV2 {
	const {
		userId,
		supermemoryApiKey,
		region = process.env.AWS_REGION || 'us-east-1',
		modelId = DEFAULT_MODELS.HAIKU,
		verbose = false,
		addMemory = true,
		conversationId
	} = config;

	// Create Bedrock instance with Node Provider Chain
	// This automatically looks for AWS credentials from:
	// - Environment variables
	// - AWS SSO sessions
	// - IAM roles
	// - AWS profiles
	const bedrock = createAmazonBedrock({
		region,
		credentialProvider: fromNodeProviderChain(),
	});

	// Get the base model
	const baseModel = bedrock(modelId);

	// Wrap with Supermemory for automatic memory management
	const modelWithMemory = withSupermemory(baseModel, userId, {
		apiKey: supermemoryApiKey,
		verbose,
		addMemory: addMemory ? "always" : "never",
		conversationId,
		mode: 'full'
	});

	return modelWithMemory;
}

/**
 * Create a Bedrock model without Supermemory integration
 * Useful for sub-agents that don't need memory access
 *
 * @param config - Basic Bedrock configuration
 * @returns Configured language model
 */
export function createBedrock(config: {
	region?: string;
	modelId?: string;
}): ReturnType<ReturnType<typeof createAmazonBedrock>> {
	const { region = process.env.AWS_REGION || 'us-east-1', modelId = DEFAULT_MODELS.HAIKU } = config;

	const bedrock = createAmazonBedrock({
		region,
		credentialProvider: fromNodeProviderChain(),
	});

	return bedrock(modelId);
}
