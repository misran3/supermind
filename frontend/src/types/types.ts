export type ViewState = 'auth' | 'onboarding' | 'chat' | 'profile';

// ============================================
// UI Types (Legacy - used in current views)
// ============================================

export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  isStreaming?: boolean; // True while message is being streamed
}

export interface ChatSession {
  id: string;
  title: string;
  preview: string;
  date: string;
}

// SSE-related types
export type StreamStatus = 'idle' | 'connecting' | 'streaming' | 'error' | 'completed';

export interface StreamError {
  message: string;
  code?: string;
}

export interface ChatStreamOptions {
  functionUrl: string;
  onMessageChunk?: (chunk: string) => void;
  onComplete?: () => void;
  onError?: (error: StreamError) => void;
}

// ============================================
// API Types (REST API)
// ============================================

// User Profile & Settings
export interface UserProfile {
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

export interface UserAppSettings {
  userId: string;
  toneOfResponse?: string;
  whatsAppNotificationsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// Chat History
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

export interface ChatMessage {
  userId: string;
  sessionId: string;
  messageId: string;
  content: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  sender: 'user' | 'assistant' | 'system';
  sentAt?: string;
  processingStatus: string;
}

// Integrations (for future use)
export interface ThirdPartyIntegration {
  userId: string;
  connectorName: 'google_calendar' | 'gmail' | 'splitwise';
  connectorSource: 'composio' | 'manual';
  connectionStatus: 'initiated' | 'active' | 'inactive' | 'failed';
  connectionId: string;
  connectedEmail?: string;
  externalEntityId?: string;
  syncStatus: 'success' | 'in_progress' | 'fail';
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ThirdPartyEventLog {
  userId: string;
  connectorName: string;
  eventType: string;
  externalId: string;
  actionSource: string;
  timestamp: string;
  details?: Record<string, any>;
  ttl: number;
}

// API Response wrappers
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface ListResponse<T> {
  items: T[];
  lastEvaluatedKey?: Record<string, any>;
}