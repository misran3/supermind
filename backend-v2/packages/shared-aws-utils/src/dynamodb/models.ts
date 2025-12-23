export interface UserProfile {
    /**
     * Unique identifier for the user, extracted from the Cognito sub/username.
     */
    userId: string;
    email: string;
    firstName?: string;
    lastName?: string;
    nickname?: string;
    phoneNumber?: string;
    timezone?: string;
    supermemoryProfileCreated: boolean;
    whatsAppOptIn: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UserProfileDAO extends UserProfile {
    /**
     * Partition Key: USER#<userId>
     */
    PK: string;
    /**
     * Sort Key: PROFILE
     */
    SK: 'PROFILE';
}

export interface UserAppSettings {
    userId: string;
    toneOfResponse?: string;
    whatsAppNotificationsEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}

export interface UserAppSettingsDAO extends UserAppSettings {
    /**
     * Partition Key: USER#<userId>
     */
    PK: string;
    /**
     * Sort Key: APP_SETTINGS
     */
    SK: 'APP_SETTINGS';
}

export type AllowedThirdPartyConnectors = 'google_calendar' | 'gmail' | 'splitwise';
export type AllowedThirdPartyConnectorSources = 'composio' | 'manual';
export type ThirdPartyConnectionStatus = 'initiated' | 'active' | 'inactive' | 'failed';
export type ThirdPartyConnectionSyncStatus = 'success' | 'in_progress' | 'fail';

export interface ThirdPartyIntegration {
    userId: string;
    connectorName: AllowedThirdPartyConnectors;
    connectorSource: AllowedThirdPartyConnectorSources;
    connectionStatus: ThirdPartyConnectionStatus;
    connectionId: string;
    connectedEmail?: string;
    connectedPhoneNumber?: string;
    externalEntityId?: string;
    syncStatus: ThirdPartyConnectionSyncStatus;
    lastSyncAt?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ThirdPartyIntegrationDAO extends ThirdPartyIntegration {
    /**
     * Partition Key: USER#<userId>
     */
    PK: string;
    /**
     * Sort Key: INTEGRATION#<connectorName>
     */
    SK: string;
}

export type AllowedThirdPartyConnectorActionSources = AllowedThirdPartyConnectorSources | 'api' | 'ai';

export interface ThirdPartyEventLog {
    userId: string;
    connectorName: AllowedThirdPartyConnectors;
    eventType: string;
    externalId: string;
    actionSource: AllowedThirdPartyConnectorActionSources;
    timestamp: string;
    details?: { [key: string]: any };
    ttl: number;
}

export interface ThirdPartyEventLogDAO extends ThirdPartyEventLog {
    /**
     * Partition Key: USER#<userId>
     */
    PK: string;
    /**
     * Sort Key: EVENT#<connectorName>#<timestamp>
     */
    SK: string;
}

export interface WebSessionMetadata {
    userId: string;
    sessionId: string;
    title?: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    archived: boolean;
    starred: boolean;
}

export interface WebSessionMetadataDAO extends WebSessionMetadata {
    /**
     * Partition Key: USER#<userId>
     */
    PK: string;
    /**
     * Sort Key: WEB_SESSION#<sessionId>#METADATA
     */
    SK: string;
}

export interface WhatsAppSessionMetadata {
    userId: string;
    sessionId: string;
    phoneNumber: string;
    title?: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    archived: boolean;
    starred: boolean;
}

export interface WhatsAppSessionMetadataDAO extends WhatsAppSessionMetadata {
    /**
     * Partition Key: USER#<userId>
     */
    PK: string;
    /**
     * Sort Key: WHATSAPP_SESSION#<sessionId>#METADATA
     */
    SK: string;
}

export type MessageDirection = 'inbound' | 'outbound';
export type MessageSender = 'user' | 'assistant' | 'system';
export type InboundMessageProcessingStatus = 'received' | 'processing' | 'completed' | 'failed';
export type OutboundMessageProcessingStatus = 'streaming' | 'queued' | 'sent' | 'failed';

export interface ChatMessage {
    userId: string;
    sessionId: string;
    messageId: string;
    content: string;
    direction: MessageDirection;
    timestamp: string;
    sender: MessageSender;
    sentAt?: string;
    processingStatus: InboundMessageProcessingStatus | OutboundMessageProcessingStatus;
}

export interface ChatMessageDAO extends ChatMessage {
    PK: string; // USER#<userId>#WEB_SESSION#<sessionId>
    SK: string; // MESSAGE#<messageId>
}
