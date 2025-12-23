/**
 * @supermind/assistant
 *
 * AI Assistant package with orchestrator-worker pattern
 * Supports multiple providers, streaming, and Supermemory integration
 */

// Main orchestrator
export { createOrchestrator, Orchestrator } from './orchestrator';

// Provider configurations
export { createBedrock, createBedrockWithMemory, DEFAULT_MODELS, type ProviderConfig } from './provider';

// System prompts
export { getWorkerSystemPrompt, ORCHESTRATOR_SYSTEM_PROMPT } from './prompts';

// Sub-agents
export {
	createGmailAgent,
	createCalendarAgent,
	executeGmailTask,
	executeCalendarTask,
	type SubAgentContext,
} from './sub-agents';

// Delegation tools
export { createDelegationTools } from './tools';

// Onboarding agent
export { generateOnboardingMessage } from './onboarding-agent';

// Types and schemas
export {
	AddMemoryParams, DeleteMemoryParams, MemoryCategory,
	MemorySource, SearchMemoryParams, ToolResult, UpdateMemoryParams
} from './types';

export type {
	Message, OrchestratorConfig,
	OrchestratorResponse
} from './types';
