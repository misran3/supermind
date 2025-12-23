/**
 * Chat History Hook
 *
 * Provides methods for managing web chat sessions and messages
 * with loading states, error handling, and automatic token management.
 */

import { useState, useCallback } from 'react';
import {
  fetchSessions,
  fetchSession,
  createSession,
  updateSession,
  deleteSession,
  fetchMessages,
  fetchMessage,
  createMessage,
  updateMessage,
  deleteMessage,
  type WebSessionMetadata,
  type ChatMessage,
  type CreateSessionRequest,
  type UpdateSessionRequest,
  type CreateMessageRequest,
  type UpdateMessageRequest,
  type FetchSessionsOptions,
  type FetchMessagesOptions,
} from '@/src/services/chat-history.service';
import { ApiError, ListResponse } from '@/src/services/api-client';

interface UseChatHistoryReturn {
  // Sessions state
  sessions: WebSessionMetadata[];
  currentSession: WebSessionMetadata | null;
  sessionsLoading: boolean;
  sessionsError: string | null;

  // Messages state
  messages: ChatMessage[];
  messagesLoading: boolean;
  messagesError: string | null;

  // Session operations
  loadSessions: (options?: FetchSessionsOptions) => Promise<void>;
  loadSession: (sessionId: string) => Promise<WebSessionMetadata | null>;
  createNewSession: (data?: CreateSessionRequest) => Promise<WebSessionMetadata | null>;
  updateCurrentSession: (sessionId: string, data: UpdateSessionRequest) => Promise<WebSessionMetadata | null>;
  deleteCurrentSession: (sessionId: string) => Promise<boolean>;
  setCurrentSession: (session: WebSessionMetadata | null) => void;

  // Message operations
  loadMessages: (sessionId: string, options?: FetchMessagesOptions) => Promise<void>;
  loadMessage: (sessionId: string, messageId: string) => Promise<ChatMessage | null>;
  addMessage: (sessionId: string, data: CreateMessageRequest) => Promise<ChatMessage | null>;
  updateExistingMessage: (sessionId: string, messageId: string, data: UpdateMessageRequest) => Promise<ChatMessage | null>;
  deleteExistingMessage: (sessionId: string, messageId: string) => Promise<boolean>;

  // Utility
  clearErrors: () => void;
}

/**
 * Hook for managing chat sessions and messages
 *
 * @example
 * const {
 *   sessions,
 *   currentSession,
 *   messages,
 *   loadSessions,
 *   createNewSession,
 *   addMessage
 * } = useChatHistory();
 *
 * useEffect(() => {
 *   loadSessions();
 * }, []);
 *
 * const handleNewChat = async () => {
 *   const session = await createNewSession({ title: 'New Chat' });
 *   if (session) {
 *     setCurrentSession(session);
 *   }
 * };
 */
export function useChatHistory(): UseChatHistoryReturn {
  // Sessions state
  const [sessions, setSessions] = useState<WebSessionMetadata[]>([]);
  const [currentSession, setCurrentSession] = useState<WebSessionMetadata | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);

  // Messages state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState<string | null>(null);

  // Clear all errors
  const clearErrors = useCallback(() => {
    setSessionsError(null);
    setMessagesError(null);
  }, []);

  // ============================================
  // Session Operations
  // ============================================

  /**
   * Load all sessions
   */
  const loadSessions = useCallback(async (options?: FetchSessionsOptions) => {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const response = await fetchSessions(options);
      console.log('Fetched sessions:', response);
      setSessions(response.items);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load sessions';
      setSessionsError(message);
      console.error('Failed to load sessions:', error);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  /**
   * Load specific session
   */
  const loadSession = useCallback(async (sessionId: string): Promise<WebSessionMetadata | null> => {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const session = await fetchSession(sessionId);
      setCurrentSession(session);
      return session;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load session';
      setSessionsError(message);
      console.error('Failed to load session:', error);
      return null;
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  /**
   * Create new session
   */
  const createNewSession = useCallback(async (data?: CreateSessionRequest): Promise<WebSessionMetadata | null> => {
    setSessionsLoading(true);
    setSessionsError(null);

    try {
      const newSession = await createSession(data || {});
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
      return newSession;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to create session';
      setSessionsError(message);
      console.error('Failed to create session:', error);
      return null;
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  /**
   * Update session
   */
  const updateCurrentSession = useCallback(
    async (sessionId: string, data: UpdateSessionRequest): Promise<WebSessionMetadata | null> => {
      setSessionsLoading(true);
      setSessionsError(null);

      try {
        const updatedSession = await updateSession(sessionId, data);
        setSessions((prev) => prev.map((s) => (s.sessionId === sessionId ? updatedSession : s)));
        if (currentSession?.sessionId === sessionId) {
          setCurrentSession(updatedSession);
        }
        return updatedSession;
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Failed to update session';
        setSessionsError(message);
        console.error('Failed to update session:', error);
        return null;
      } finally {
        setSessionsLoading(false);
      }
    },
    [currentSession]
  );

  /**
   * Delete session
   */
  const deleteCurrentSession = useCallback(
    async (sessionId: string): Promise<boolean> => {
      setSessionsLoading(true);
      setSessionsError(null);

      try {
        await deleteSession(sessionId);
        setSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (currentSession?.sessionId === sessionId) {
          setCurrentSession(null);
          setMessages([]);
        }
        return true;
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Failed to delete session';
        setSessionsError(message);
        console.error('Failed to delete session:', error);
        return false;
      } finally {
        setSessionsLoading(false);
      }
    },
    [currentSession]
  );

  // ============================================
  // Message Operations
  // ============================================

  /**
   * Load messages for a session
   */
  const loadMessages = useCallback(async (sessionId: string, options?: FetchMessagesOptions) => {
    setMessagesLoading(true);
    setMessagesError(null);

    try {
      const response = await fetchMessages(sessionId, options);
      setMessages(response.items);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to load messages';
      setMessagesError(message);
      console.error('Failed to load messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  /**
   * Load specific message
   */
  const loadMessage = useCallback(async (sessionId: string, messageId: string): Promise<ChatMessage | null> => {
    setMessagesLoading(true);
    setMessagesError(null);

    try {
      const message = await fetchMessage(sessionId, messageId);
      return message;
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : 'Failed to load message';
      setMessagesError(errorMessage);
      console.error('Failed to load message:', error);
      return null;
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  /**
   * Add message to session
   */
  const addMessage = useCallback(async (sessionId: string, data: CreateMessageRequest): Promise<ChatMessage | null> => {
    setMessagesLoading(true);
    setMessagesError(null);

    try {
      const newMessage = await createMessage(sessionId, data);
      setMessages((prev) => [...prev, newMessage]);
      return newMessage;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to add message';
      setMessagesError(message);
      console.error('Failed to add message:', error);
      return null;
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  /**
   * Update message
   */
  const updateExistingMessage = useCallback(
    async (sessionId: string, messageId: string, data: UpdateMessageRequest): Promise<ChatMessage | null> => {
      setMessagesLoading(true);
      setMessagesError(null);

      try {
        const updatedMessage = await updateMessage(sessionId, messageId, data);
        setMessages((prev) => prev.map((m) => (m.messageId === messageId ? updatedMessage : m)));
        return updatedMessage;
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Failed to update message';
        setMessagesError(message);
        console.error('Failed to update message:', error);
        return null;
      } finally {
        setMessagesLoading(false);
      }
    },
    []
  );

  /**
   * Delete message
   */
  const deleteExistingMessage = useCallback(async (sessionId: string, messageId: string): Promise<boolean> => {
    setMessagesLoading(true);
    setMessagesError(null);

    try {
      await deleteMessage(sessionId, messageId);
      setMessages((prev) => prev.filter((m) => m.messageId !== messageId));
      return true;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : 'Failed to delete message';
      setMessagesError(message);
      console.error('Failed to delete message:', error);
      return false;
    } finally {
      setMessagesLoading(false);
    }
  }, []);

  return {
    // Sessions state
    sessions,
    currentSession,
    sessionsLoading,
    sessionsError,

    // Messages state
    messages,
    messagesLoading,
    messagesError,

    // Session operations
    loadSessions,
    loadSession,
    createNewSession,
    updateCurrentSession,
    deleteCurrentSession,
    setCurrentSession,

    // Message operations
    loadMessages,
    loadMessage,
    addMessage,
    updateExistingMessage,
    deleteExistingMessage,

    // Utility
    clearErrors,
  };
}
