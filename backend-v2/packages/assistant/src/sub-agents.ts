/**
 * Sub-agent factory functions and executors
 *
 * Creates specialized sub-agents with Composio toolkits for Gmail and Google Calendar
 */

import { Composio } from '@composio/core';
import type { LanguageModelV2 } from '@ai-sdk/provider';
import { generateText } from 'ai';
import { createBedrock } from './provider.js';

/**
 * Sub-agent context containing tools, model, and connection info
 */
export interface SubAgentContext {
	/** Composio tools for this agent */
	tools: any;
	/** Language model instance */
	model: LanguageModelV2;
	/** Composio SDK instance */
	composio: Composio;
	/** Connected account ID for authenticated actions */
	connectedAccountId: string;
}

/**
 * Create Gmail sub-agent with Composio Gmail toolkit
 *
 * @param userId - User ID (used as Composio entity ID)
 * @param connectedAccountId - Composio connection ID for Gmail
 * @param composioApiKey - Composio API key
 * @returns Sub-agent context with Gmail tools
 *
 * @example
 * ```typescript
 * const agent = await createGmailAgent(userId, 'conn_xxx', apiKey);
 * const result = await executeGmailTask(agent, 'Search emails from today');
 * ```
 */
export async function createGmailAgent(
	userId: string,
	connectedAccountId: string,
	composioApiKey: string
): Promise<SubAgentContext> {
	const composio = new Composio({ apiKey: composioApiKey });

	// Get Gmail tools from Composio
	const tools = await composio.tools.get(userId, {
		toolkits: ['gmail'],
	});

	return {
		tools,
		model: createBedrock({ modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' }),
		composio,
		connectedAccountId,
	};
}

/**
 * Create Calendar sub-agent with Composio Google Calendar toolkit
 *
 * @param userId - User ID (used as Composio entity ID)
 * @param connectedAccountId - Composio connection ID for Google Calendar
 * @param composioApiKey - Composio API key
 * @returns Sub-agent context with Calendar tools
 *
 * @example
 * ```typescript
 * const agent = await createCalendarAgent(userId, 'conn_yyy', apiKey);
 * const result = await executeCalendarTask(agent, 'Show my schedule for today');
 * ```
 */
export async function createCalendarAgent(
	userId: string,
	connectedAccountId: string,
	composioApiKey: string
): Promise<SubAgentContext> {
	const composio = new Composio({ apiKey: composioApiKey });

	// Get Calendar tools from Composio
	const tools = await composio.tools.get(userId, {
		toolkits: ['googlecalendar'],
	});

	return {
		tools,
		model: createBedrock({ modelId: 'us.anthropic.claude-3-5-haiku-20241022-v1:0' }),
		composio,
		connectedAccountId,
	};
}

/**
 * Execute Gmail task with sub-agent
 *
 * @param agent - Gmail sub-agent context
 * @param task - Task description
 * @returns Assistant's response
 */
export async function executeGmailTask(agent: SubAgentContext, task: string): Promise<string> {
	const result = await generateText({
		model: agent.model,
		tools: agent.tools,
		prompt: `You are a Gmail assistant. ${task}`,
	});

	return result.text;
}

/**
 * Execute Calendar task with sub-agent
 *
 * @param agent - Calendar sub-agent context
 * @param task - Task description
 * @returns Assistant's response
 */
export async function executeCalendarTask(agent: SubAgentContext, task: string): Promise<string> {
	const result = await generateText({
		model: agent.model,
		tools: agent.tools,
		prompt: `You are a Google Calendar assistant. ${task}`,
	});

	return result.text;
}
