/**
 * Onboarding agent for generating welcome messages for new users
 */

import { generateText } from 'ai';
import { createBedrockWithMemory } from './provider.js';

/**
 * Generate a welcome greeting message for a new user
 *
 * This agent creates a short, friendly greeting when a user first joins.
 * It introduces itself as a personal AI assistant and mentions key capabilities.
 *
 * @param userId - User ID for Supermemory context
 * @param supermemoryApiKey - Supermemory API key
 * @param fullName - User's full name (firstName + lastName)
 * @param nickname - Optional nickname
 * @returns Greeting message text
 *
 * @example
 * ```typescript
 * const greeting = await generateOnboardingMessage(
 *   'user_123',
 *   process.env.SUPERMEMORY_API_KEY!,
 *   'Alice Johnson',
 *   'Ali'
 * );
 * ```
 */
export async function generateOnboardingMessage(
	userId: string,
    sessionId: string,
	fullName: string,
	nickname?: string,
	supermemoryApiKey?: string,
): Promise<string> {
	// Create model with Supermemory (Haiku for speed)
	const model = createBedrockWithMemory({
		userId,
		conversationId: sessionId,
		supermemoryApiKey: supermemoryApiKey || process.env.SUPERMEMORY_API_KEY || '',
		modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0',
	});

	// Generate greeting
	const result = await generateText({
		model,
		prompt: `You are a friendly AI assistant greeting a new user${nickname ? ` (they go by ${nickname})` : ''}.

User's name: ${fullName}

Generate a warm, SHORT welcome message (2-3 sentences max) that:
1. Greets them by name${nickname ? ' (use their nickname)' : ''}
2. Mentions you're their personal AI assistant
3. Briefly mention you can help with emails and calendars
4. Mention they can use you as a personal journal to jot down thoughts or just casually talk

Keep it conversational and friendly. Make it feel like texting a friend, not reading an essay.`,
	});

	return result.text;
}
