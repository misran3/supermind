/**
 * @supermind/shared-aws-utils
 *
 * Shared AWS utility functions and clients
 */

export { getUserSecret, SecretsManager, updateUserSecret } from './secrets';

export { ChatHistoryClient, IntegrationsClient, UsersClient } from './dynamodb';

export type {
    AllowedThirdPartyConnectors,
    ChatMessage,
    ThirdPartyEventLog,
    ThirdPartyIntegration, UserAppSettings, UserProfile, WebSessionMetadata
} from './dynamodb';

export { createResponse } from './response';
