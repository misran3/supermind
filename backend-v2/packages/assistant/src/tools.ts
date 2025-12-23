/**
 * Delegation tools for orchestrator
 *
 * Provides tools that delegate tasks to specialized sub-agents
 */

import { tool } from 'ai';
import { z } from 'zod';
import {
	createCalendarAgent,
	createGmailAgent,
	executeCalendarTask,
	executeGmailTask,
} from './sub-agents.js';

/**
 * Create delegation tools for the orchestrator
 *
 * These tools allow the orchestrator to delegate tasks to specialized sub-agents
 * with access to Composio toolkits (Gmail, Calendar, etc.)
 *
 * @param userId - User ID (used as Composio entity ID)
 * @param composioApiKey - Composio API key
 * @param getConnectionId - Function to retrieve connection ID for a connector
 * @returns Object containing delegation tools
 *
 * @example
 * ```typescript
 * const tools = createDelegationTools(
 *   'user_123',
 *   process.env.COMPOSIO_API_KEY!,
 *   async (connector) => connectionIds[connector] || null
 * );
 * ```
 */
export function createDelegationTools(
	userId: string,
	composioApiKey: string,
	getConnectionId: (connector: string) => Promise<string | null>
) {
	return {
		delegate_to_gmail: tool({
			description:
				'Delegate Gmail-related tasks like searching emails, sending emails, reading emails, managing drafts',
			parameters: z.object({
				task: z.string().describe('The specific Gmail task to perform'),
			}),
			// @ts-expect-error - AI SDK v5 type inference issue
			execute: async (args: { task: string }) => {
				const connectionId = await getConnectionId('gmail');
				if (!connectionId) {
					return {
						error: 'Gmail not connected. Please connect Gmail first in your profile settings.',
					};
				}

				try {
					const agent = await createGmailAgent(userId, connectionId, composioApiKey);
					const result = await executeGmailTask(agent, args.task);
					return { result };
				} catch (error: any) {
					return { error: `Gmail task failed: ${error.message}` };
				}
			},
		}),

		delegate_to_calendar: tool({
			description:
				'Delegate Google Calendar tasks like checking schedule, creating events, finding meetings, updating events',
			parameters: z.object({
				task: z.string().describe('The specific Calendar task to perform'),
			}),
			// @ts-expect-error - AI SDK v5 type inference issue
			execute: async (args: { task: string }) => {
				const connectionId = await getConnectionId('google_calendar');
				if (!connectionId) {
					return {
						error:
							'Google Calendar not connected. Please connect Calendar first in your profile settings.',
					};
				}

				try {
					const agent = await createCalendarAgent(userId, connectionId, composioApiKey);
					const result = await executeCalendarTask(agent, args.task);
					return { result };
				} catch (error: any) {
					return { error: `Calendar task failed: ${error.message}` };
				}
			},
		}),
	};
}
