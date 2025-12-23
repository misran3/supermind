/**
 * Orchestrator agent for task delegation and coordination
 */

import type { ModelMessage } from 'ai';
import { generateText, streamText } from 'ai';
import { IntegrationsClient, type AllowedThirdPartyConnectors } from '@supermind/shared-aws-utils';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './prompts.js';
import { createBedrockWithMemory } from './provider.js';
import { createDelegationTools } from './tools.js';
import type { OrchestratorConfig, OrchestratorResponse } from './types.js';

/**
 * Orchestrator Agent for delegating tasks and managing conversations
 *
 * This is the main entry point for the AI assistant. It:
 * - Manages conversation with users
 * - Leverages Supermemory for automatic context management
 * - Delegates to worker agents for specialized tasks (future)
 * - Supports both streaming and non-streaming responses
 *
 * @example
 * ```typescript
 * // Non-streaming mode
 * const orchestrator = new Orchestrator({
 *   userId: 'user_123',
 *   supermemoryApiKey: process.env.SUPERMEMORY_API_KEY!,
 *   streaming: false,
 * });
 *
 * const response = await orchestrator.processMessage('My name is Alice');
 * console.log(response.text);
 * ```
 *
 * @example
 * ```typescript
 * // Streaming mode
 * const orchestrator = new Orchestrator({
 *   userId: 'user_123',
 *   supermemoryApiKey: process.env.SUPERMEMORY_API_KEY!,
 *   streaming: true,
 * });
 *
 * const stream = await orchestrator.processMessageStream('Tell me a story');
 * for await (const chunk of stream.textStream) {
 *   process.stdout.write(chunk);
 * }
 * ```
 */
export class Orchestrator {
	private model: ReturnType<typeof createBedrockWithMemory>;
	private config: Required<Omit<OrchestratorConfig, 'composioApiKey' | 'connectionIds'>> & Pick<OrchestratorConfig, 'composioApiKey' | 'connectionIds'>;
	private conversationHistory: ModelMessage[] = [];
	private delegationTools?: ReturnType<typeof createDelegationTools>;

	/**
	 * Create a new Orchestrator instance
	 *
	 * @param config - Configuration options
	 */
	constructor(config: OrchestratorConfig) {
		console.log('Creating Orchestrator with config:', config);

		// Set defaults
		this.config = {
			streaming: false,
			region: process.env.AWS_REGION || 'us-east-1',
			modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
			verbose: false,
			toneOfResponse: 'concise and direct',
			...config,
		};

		console.log('Orchestrator configuration override:', this.config)

		// Create model with Supermemory
		this.model = createBedrockWithMemory({
			userId: this.config.userId,
			conversationId: this.config.sessionId,
			supermemoryApiKey: this.config.supermemoryApiKey,
			region: this.config.region,
			modelId: this.config.modelId,
			verbose: this.config.verbose,
		});

		// Initialize with system prompt
		this.conversationHistory.push({
			role: 'system',
			content: ORCHESTRATOR_SYSTEM_PROMPT,
		});

		// Create delegation tools if Composio API key is provided
		if (this.config.composioApiKey) {
			console.log('Initializing delegation tools for Orchestrator');
			this.delegationTools = createDelegationTools(
				this.config.userId,
				this.config.composioApiKey,
				(connector) => this.getConnectionId(connector)
			);
		}
	}

	/**
	 * Get Composio connection ID for a connector
	 *
	 * @param connector - Connector name (gmail, google_calendar, etc.)
	 * @returns Connection ID or null if not connected
	 */
	private async getConnectionId(connector: string): Promise<string | null> {
		try {
			// Fetch integration from DynamoDB
			const integration = await IntegrationsClient.getIntegration(
				this.config.userId,
				connector as AllowedThirdPartyConnectors
			);

			// Return connectionId if integration exists and is active
			if (integration && integration.connectionStatus === 'active') {
				return integration.connectionId;
			}

			// Fallback to config if provided (for testing/development)
			return this.config.connectionIds?.[connector] || null;
		} catch (error) {
			console.error('Error fetching connection ID from DynamoDB:', error);

			// Fallback to config on error
			return this.config.connectionIds?.[connector] || null;
		}
	}

	/**
	 * Process a user message (non-streaming)
	 *
	 * @param message - User's message
	 * @param additionalContext - Optional additional context to include
	 * @returns Complete response from the orchestrator
	 *
	 * @example
	 * ```typescript
	 * const response = await orchestrator.processMessage('What is my name?');
	 * console.log(response.text);
	 * console.log(response.usage);
	 * ```
	 */
	async processMessage(message: string, additionalContext?: string): Promise<OrchestratorResponse> {
		console.log('[Orchestrator.processMessage] Starting message processing', {
			sessionId: this.config.sessionId,
			messageLength: message.length,
			hasAdditionalContext: !!additionalContext,
			historyLength: this.conversationHistory.length,
			hasDelegationTools: !!this.delegationTools,
		});

		// Add user message to history
		let userContent = additionalContext ? `${additionalContext}\n\nUser message: ${message}` : message;

		if (this.config.toneOfResponse) {
			const toneOfResponse = this.config.toneOfResponse.trim().toLowerCase();
			
			if ('concise and direct' === toneOfResponse) {
				userContent = `${userContent}\n\nResponse Tone: Skip the fluff, speedrun the answer."`;
			} else if ('professional and friendly' === toneOfResponse) {
				userContent = `${userContent}\n\nResponse Tone: Helpful genius, but fun at parties."`;
			} else if ('detailed and conversational' === toneOfResponse) {
				userContent = `${userContent}\n\nNerd out and spill the tea.`;
			} else {
				console.warn(`[Orchestrator.processMessage] Invalid toneOfResponse: ${this.config.toneOfResponse}`);
			}
		}

		this.conversationHistory.push({
			role: 'user',
			content: userContent,
		});

		console.log('[Orchestrator.processMessage] User message added to history', {
			historyLength: this.conversationHistory.length,
		});

		try {
			console.log('[Orchestrator.processMessage] Calling generateText with model and tools');
			const result = await generateText({
				model: this.model,
				messages: this.conversationHistory,
				tools: this.delegationTools,
			});

			console.log('[Orchestrator.processMessage] generateText completed', {
				textLength: result.text.length,
				finishReason: result.finishReason,
				toolCalls: result.toolCalls?.length || 0,
				usage: result.usage,
			});

			// Log tool calls if any
			if (result.toolCalls && result.toolCalls.length > 0) {
				console.log('[Orchestrator.processMessage] Tool calls executed:', {
					tools: result.toolCalls,
				});
			}

			// Add assistant response to history
			this.conversationHistory.push({
				role: 'assistant',
				content: result.text,
			});

			console.log('[Orchestrator.processMessage] Assistant response added to history', {
				historyLength: this.conversationHistory.length,
			});

			return {
				text: result.text,
				finishReason: result.finishReason,
				usage: {
					inputTokens: result.usage.inputTokens,
					outputTokens: result.usage.outputTokens,
					totalTokens: result.usage.totalTokens,
				}
			};
		} catch (error) {
			console.error('[Orchestrator.processMessage] Error during message processing', {
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
			});

			// Remove failed message from history
			this.conversationHistory.pop();
			throw error;
		}
	}

	/**
	 * Process a user message (streaming)
	 *
	 * @param message - User's message
	 * @param additionalContext - Optional additional context to include
	 * @returns Stream response from the orchestrator
	 *
	 * @example
	 * ```typescript
	 * const stream = await orchestrator.processMessageStream('Tell me about yourself');
	 *
	 * // Stream text chunks
	 * for await (const chunk of stream.textStream) {
	 *   process.stdout.write(chunk);
	 * }
	 *
	 * // Or get full text after streaming
	 * const fullText = await stream.fullText;
	 * console.log(fullText);
	 * ```
	 */
	async processMessageStream(message: string, additionalContext?: string) {
		console.log('[Orchestrator.processMessageStream] Starting streaming message processing', {
			sessionId: this.config.sessionId,
			messageLength: message.length,
			hasAdditionalContext: !!additionalContext,
			historyLength: this.conversationHistory.length,
			hasDelegationTools: !!this.delegationTools,
		});

		// Add user message to history
		const userContent = additionalContext ? `${additionalContext}\n\nUser message: ${message}` : message;

		this.conversationHistory.push({
			role: 'user',
			content: userContent,
		});

		console.log('[Orchestrator.processMessageStream] User message added to history', {
			historyLength: this.conversationHistory.length,
		});

		try {
			console.log('[Orchestrator.processMessageStream] Calling streamText with model and tools');
			const result = streamText({
				model: this.model,
				messages: this.conversationHistory,
				tools: this.delegationTools,
			});

			console.log('[Orchestrator.processMessageStream] streamText initiated');

			// Create a wrapper to update history after streaming completes
			const originalTextStream = result.textStream;
			let fullText = '';
			let chunkCount = 0;

			const enhancedTextStream = (async function* (this: Orchestrator) {
				console.log('[Orchestrator.processMessageStream] Starting text stream consumption');

				for await (const chunk of originalTextStream) {
					chunkCount++;
					if (chunkCount === 1) {
						console.log('[Orchestrator.processMessageStream] First chunk received', {
							chunkLength: chunk.length,
						});
					}
					fullText += chunk;
					yield chunk;
				}

				console.log('[Orchestrator.processMessageStream] Stream completed', {
					totalChunks: chunkCount,
					fullTextLength: fullText.length,
				});

				// After streaming completes, add to history
				this.conversationHistory.push({
					role: 'assistant',
					content: fullText,
				});

				console.log('[Orchestrator.processMessageStream] Assistant response added to history', {
					historyLength: this.conversationHistory.length,
				});
			}.call(this));

			return {
				...result,
				textStream: enhancedTextStream,
			};
		} catch (error) {
			console.error('[Orchestrator.processMessageStream] Error during streaming', {
				error: error instanceof Error ? error.message : error,
				stack: error instanceof Error ? error.stack : undefined,
			});

			// Remove failed message from history
			this.conversationHistory.pop();
			throw error;
		}
	}

	/**
	 * Process a message based on the streaming configuration
	 *
	 * This is a convenience method that routes to either processMessage
	 * or processMessageStream based on the config.
	 *
	 * @param message - User's message
	 * @param additionalContext - Optional additional context
	 * @returns Response (either complete or stream based on config)
	 */
	async process(message: string, additionalContext?: string) {
		if (this.config.streaming) {
			return this.processMessageStream(message, additionalContext);
		} else {
			return this.processMessage(message, additionalContext);
		}
	}

	/**
	 * Clear conversation history (keeps system prompt)
	 */
	clearHistory(): void {
		this.conversationHistory = [
			{
				role: 'system',
				content: ORCHESTRATOR_SYSTEM_PROMPT,
			},
		];
	}

	/**
	 * Get current conversation history
	 */
	getHistory(): ModelMessage[] {
		return [...this.conversationHistory];
	}

	/**
	 * Set custom conversation history
	 *
	 * @param messages - New conversation history
	 */
	setHistory(messages: ModelMessage[]): void {
		this.conversationHistory = messages;
	}

	/**
	 * Get configuration
	 */
	getConfig(): Readonly<OrchestratorConfig> {
		return { ...this.config };
	}
}

/**
 * Factory function to create an Orchestrator instance
 *
 * @param config - Configuration options
 * @returns Configured Orchestrator instance
 *
 * @example
 * ```typescript
 * const orchestrator = createOrchestrator({
 *   userId: 'user_123',
 *   supermemoryApiKey: process.env.SUPERMEMORY_API_KEY!,
 *   streaming: true,
 * });
 * ```
 */
export function createOrchestrator(config: OrchestratorConfig): Orchestrator {
	return new Orchestrator(config);
}
