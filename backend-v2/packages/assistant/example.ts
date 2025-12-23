/**
 * Example usage of the @supermind/assistant package
 *
 * Run with: bun run example.ts
 */

import 'dotenv/config';
import { createOrchestrator } from './src/index';

async function main() {
	// Check environment variables
	if (!process.env.SUPERMEMORY_API_KEY) {
		console.error('Error: SUPERMEMORY_API_KEY environment variable is required');
		process.exit(1);
	}

	console.log('🤖 Starting AI Assistant Example\n');
	const userId = 'd448a4a8-90a1-7040-3756-aaaeef1877f2';
	const sessionId = 'example_session_' + Date.now();

	// Example 1: Non-streaming mode
	console.log('--- Example 1: Non-Streaming Mode ---');
	const orchestrator1 = createOrchestrator({
		userId: userId,
		sessionId: sessionId,
		supermemoryApiKey: process.env.SUPERMEMORY_API_KEY,
		streaming: false,
		verbose: true,
	});

	// Share information
	const message = 'Who am I?'
	console.log(`\n👤 User: ${message}`);
	const response1 = await orchestrator1.processMessage(message);
	console.log(`🤖 Assistant: ${response1.text}`);
	console.log(`📊 Usage: ${JSON.stringify(response1.usage)}\n`);

	// Example 2: With Delegation (requires COMPOSIO_API_KEY)
	// Connection IDs are automatically fetched from DynamoDB
	if (process.env.COMPOSIO_API_KEY) {
		console.log('--- Example 2: Multi-Agent Delegation ---');
		console.log('💡 Connection IDs will be fetched from DynamoDB automatically\n');

		const orchestratorWithDelegation = createOrchestrator({
			userId: userId,
			sessionId: sessionId + '_delegation',
			supermemoryApiKey: process.env.SUPERMEMORY_API_KEY,
			composioApiKey: process.env.COMPOSIO_API_KEY,
			// connectionIds are now optional - automatically fetched from DynamoDB
			// Only provide for testing/development fallback:
			// connectionIds: {
			//   gmail: process.env.GMAIL_CONNECTION_ID || '',
			//   google_calendar: process.env.CALENDAR_CONNECTION_ID || '',
			// },
			streaming: false,
			verbose: true,
		});

		console.log('👤 User: Check my emails from today');
		const delegationResponse = await orchestratorWithDelegation.processMessage(
			'Check my emails from today and tell me about any important ones'
		);
		console.log(`🤖 Assistant: ${delegationResponse.text}`);
		console.log(`📊 Usage: ${JSON.stringify(delegationResponse.usage)}\n`);
	} else {
		console.log('\n⚠️  Skipping delegation example - COMPOSIO_API_KEY not set');
		console.log('To test delegation:');
		console.log('  1. Set: export COMPOSIO_API_KEY=your_key');
		console.log('  2. Connect Gmail/Calendar in your profile (stores in DynamoDB)');
		console.log('  3. Connection IDs will be fetched automatically!\n');
	}

	// // Ask a question
	// console.log('👤 User: What do you know about me?');
	// const response2 = await orchestrator1.processMessage('What do you know about me?');
	// console.log(`🤖 Assistant: ${response2.text}`);
	// console.log(`📊 Usage: ${JSON.stringify(response2.usage)}\n`);

	// // Example 2: Streaming mode
	// console.log('--- Example 2: Streaming Mode ---');
	// const orchestrator2 = createOrchestrator({
	// 	userId: 'example_user_123',
	// 	supermemoryApiKey: process.env.SUPERMEMORY_API_KEY,
	// 	streaming: true,
	// 	verbose: true,
	// });

	// console.log('\n👤 User: Tell me a short story about jazz');
	// process.stdout.write('🤖 Assistant: ');

	// const stream = await orchestrator2.processMessageStream('Tell me a short story about jazz');

	// for await (const chunk of stream.textStream) {
	// 	process.stdout.write(chunk);
	// }

	// console.log('\n');

	// // Example 3: Conversation history
	// console.log('--- Example 3: Conversation History ---');
	// const history = orchestrator2.getHistory();
	// console.log(`\n📝 Conversation has ${history.length} messages`);
	// console.log('Messages:', JSON.stringify(history.slice(0, 2), null, 2));

	// // Example 4: Clearing history
	// console.log('\n--- Example 4: Clear History ---');
	// orchestrator2.clearHistory();
	// console.log('✨ History cleared (system prompt preserved)');
	// console.log(`📝 Conversation now has ${orchestrator2.getHistory().length} message(s)\n`);

	// console.log('✅ Examples completed!');
}

main().catch((error) => {
	console.error('❌ Error:', error);
	process.exit(1);
});
