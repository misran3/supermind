/**
 * Composio tools provider for orchestrator
 *
 * Provides direct access to Composio tools (Gmail, Calendar, etc.)
 */

import { Composio } from '@composio/core';
import { IntegrationsClient } from '@supermind/shared-aws-utils';

/**
 * Create Composio tools for the orchestrator
 *
 * Fetches tools directly from Composio based on user's connected integrations
 *
 * @param userId - User ID (used as Composio entity ID)
 * @param composioApiKey - Composio API key
 * @returns Object containing Composio tools
 *
 * @example
 * ```typescript
 * const tools = await createComposioTools('user_123', process.env.COMPOSIO_API_KEY!);
 * ```
 */
export async function createComposioTools(
	userId: string,
	composioApiKey: string
) {
	const composio = new Composio({ apiKey: composioApiKey });

	// Fetch user's active integrations
	const integrations = await IntegrationsClient.listIntegrations(userId);
	const activeIntegrations = integrations?.filter(i => i.connectionStatus === 'active') || [];

	console.log('[createComposioTools] Active integrations:', {
		userId,
		integrations: activeIntegrations.map(i => i.connectorName),
	});

	if (activeIntegrations.length === 0) {
		console.log('[createComposioTools] No active integrations found, returning empty tools');
		return {};
	}

	// Map integration providers to Composio app names
	const appMap: Record<string, string> = {
		'gmail': 'gmail',
		'google_calendar': 'googlecalendar',
	};

	// Get toolkits for all active integrations
	const toolkits = activeIntegrations
		.map(i => appMap[i.connectorName])
		.filter(Boolean);

	console.log('[createComposioTools] Fetching tools for toolkits:', toolkits);

	if (toolkits.length === 0) {
		console.log('[createComposioTools] No supported toolkits found');
		return {};
	}

	try {
		// Get all tools for connected integrations
		const tools = await composio.tools.get(userId, {
			toolkits: toolkits as any,
		});

		console.log('[createComposioTools] Successfully fetched Composio tools:', {
			toolCount: Object.keys(tools).length,
			toolNames: Object.keys(tools),
		});

		return tools;
	} catch (error: any) {
		console.error('[createComposioTools] Error fetching Composio tools:', error);
		return {};
	}
}
