/**
 * Chat History Service
 *
 * API calls for web sessions and chat messages
 */

import { apiClient, ApiError, ListResponse } from './api-client';

// ============================================
// Types
// ============================================

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

export interface CreateSessionRequest {
  sessionId?: string;
  title?: string;
}

export interface UpdateSessionRequest {
  title?: string;
  archived?: boolean;
  starred?: boolean;
}

export interface CreateMessageRequest {
  messageId?: string;
  content: string;
  direction: 'inbound' | 'outbound';
  sender: 'user' | 'assistant' | 'system';
  timestamp?: string;
  sentAt?: string;
  processingStatus?: string;
}

export interface UpdateMessageRequest {
  content?: string;
  processingStatus?: string;
}

export interface FetchSessionsOptions {
  archived?: boolean;
  starred?: boolean;
  limit?: number;
}

export interface FetchMessagesOptions {
  limit?: number;
  startKey?: Record<string, unknown>;
}

// ============================================
// Session API Methods
// ============================================

/**
 * Get all sessions for current user
 */
export async function fetchSessions(options?: FetchSessionsOptions): Promise<ListResponse<WebSessionMetadata>> {
  try {
    const params = new URLSearchParams();
    if (options?.archived !== undefined) {
      params.append('archived', options.archived.toString());
    }
    if (options?.starred !== undefined) {
      params.append('starred', options.starred.toString());
    }
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }

    const queryString = params.toString();
    const url = queryString ? `/sessions?${queryString}` : '/sessions';

    const response = await apiClient.get<ListResponse<WebSessionMetadata>>(url);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to fetch sessions', error);
  }
}

/**
 * Get specific session
 */
export async function fetchSession(sessionId: string): Promise<WebSessionMetadata> {
  try {
    const response = await apiClient.get<WebSessionMetadata>(`/sessions/${sessionId}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to fetch session', error);
  }
}

/**
 * Create new session
 */
export async function createSession(data: CreateSessionRequest): Promise<WebSessionMetadata> {
  try {
    const sessionId = data.sessionId || `session-${Date.now()}`;
    const response = await apiClient.post<WebSessionMetadata>('/sessions', {
      ...data,
      sessionId,
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to create session', error);
  }
}

/**
 * Update session
 */
export async function updateSession(sessionId: string, data: UpdateSessionRequest): Promise<WebSessionMetadata> {
  try {
    const response = await apiClient.put<WebSessionMetadata>(`/sessions/${sessionId}`, data);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to update session', error);
  }
}

/**
 * Delete session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await apiClient.delete(`/sessions/${sessionId}`);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to delete session', error);
  }
}

// ============================================
// Message API Methods
// ============================================

/**
 * Get messages for a session
 */
export async function fetchMessages(
  sessionId: string,
  options?: FetchMessagesOptions
): Promise<ListResponse<ChatMessage>> {
  try {
    const params = new URLSearchParams();
    if (options?.limit) {
      params.append('limit', options.limit.toString());
    }
    if (options?.startKey) {
      params.append('startKey', JSON.stringify(options.startKey));
    }

    const queryString = params.toString();
    const url = queryString
      ? `/sessions/${sessionId}/messages?${queryString}`
      : `/sessions/${sessionId}/messages`;

    const response = await apiClient.get<ListResponse<ChatMessage>>(url);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to fetch messages', error);
  }
}

/**
 * Get specific message
 */
export async function fetchMessage(sessionId: string, messageId: string): Promise<ChatMessage> {
  try {
    const response = await apiClient.get<ChatMessage>(`/sessions/${sessionId}/messages/${messageId}`);
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to fetch message', error);
  }
}

/**
 * Create message in session
 */
export async function createMessage(sessionId: string, data: CreateMessageRequest): Promise<ChatMessage> {
  try {
    const messageId = data.messageId || `msg-${Date.now()}`;
    const timestamp = data.timestamp || new Date().toISOString();

    const response = await apiClient.post<ChatMessage>(`/sessions/${sessionId}/messages`, {
      ...data,
      messageId,
      timestamp,
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to create message', error);
  }
}

/**
 * Update message
 */
export async function updateMessage(
  sessionId: string,
  messageId: string,
  data: UpdateMessageRequest
): Promise<ChatMessage> {
  try {
    const response = await apiClient.put<ChatMessage>(
      `/sessions/${sessionId}/messages/${messageId}`,
      data
    );
    return response.data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to update message', error);
  }
}

/**
 * Delete message
 */
export async function deleteMessage(sessionId: string, messageId: string): Promise<void> {
  try {
    await apiClient.delete(`/sessions/${sessionId}/messages/${messageId}`);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, 'Failed to delete message', error);
  }
}
