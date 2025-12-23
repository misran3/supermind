import { useCallback, useEffect, useRef, useState } from 'react';
import { StreamStatus, StreamError } from '@/src/types/types';
import { useAuthToken } from './useAuthToken';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'streaming' | 'error';

interface UseChatStreamOptions {
    functionUrl: string;
    onMessageChunk?: (chunk: string, fullMessage: string) => void;
    onComplete?: (fullMessage: string) => void;
    onError?: (error: StreamError) => void;
    onConnection?: () => void;
}

interface UseChatStreamReturn {
    status: StreamStatus;
    connectionStatus: ConnectionStatus;
    streamedMessage: string;
    error: StreamError | null;
    startStream: (sessionId: string, messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) => Promise<void>;
    stopStream: () => void;
    isStreaming: boolean;
}

/**
 * Hook for handling Server-Sent Events (SSE) chat streaming with Cognito authentication.
 *
 * Uses fetch + ReadableStream instead of EventSource to support custom Authorization headers.
 * EventSource doesn't support custom headers, which is required for Cognito JWT auth.
 *
 * This hook manages the entire lifecycle of an SSE connection:
 * - Fetches Cognito JWT token
 * - Establishes SSE connection with Authorization header
 * - Parses SSE format (data: message\n\n)
 * - Handles streaming message chunks
 * - Manages connection state and errors
 * - Proper cleanup on unmount
 *
 * @param {UseChatStreamOptions} options - Configuration options
 * @returns {UseChatStreamReturn} Stream state and control functions
 *
 * @example
 * const { status, streamedMessage, startStream, stopStream, isStreaming } = useChatStream({
 *   functionUrl: process.env.NEXT_PUBLIC_CHAT_STREAM_URL!,
 *   onMessageChunk: (chunk, fullMessage) => {
 *     // Update UI with each chunk
 *     console.log('Chunk:', chunk);
 *   },
 *   onComplete: (fullMessage) => {
 *     // Handle completion
 *     console.log('Complete:', fullMessage);
 *   },
 *   onError: (error) => {
 *     // Handle errors
 *     console.error('Error:', error);
 *   },
 * });
 */
export const useChatStream = (options: UseChatStreamOptions): UseChatStreamReturn => {
    const { functionUrl, onMessageChunk, onComplete, onError, onConnection } = options;

    const [status, setStatus] = useState<StreamStatus>('idle');
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
    const [streamedMessage, setStreamedMessage] = useState('');
    const [error, setError] = useState<StreamError | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const accumulatedMessageRef = useRef('');
    const completedRef = useRef(false); // Track if completion has been handled
    const getToken = useAuthToken();

    /**
     * Parse SSE format and extract event type and data
     * SSE format: "event: <type>\ndata: <message>\n\n"
     */
    const parseSSEChunk = (chunk: string): { event: string; data: string } | null => {
        const lines = chunk.split('\n');
        let event = 'message'; // default event type
        let data = '';

        for (const line of lines) {
            if (line.startsWith('event: ')) {
                event = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
                data = line.slice(6);
            }
        }

        if (data) {
            return { event, data };
        }
        return null;
    };

    /**
     * Start SSE streaming connection using fetch + ReadableStream
     */
    const startStream = useCallback(async (sessionId: string, messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>) => {
        // Prevent multiple simultaneous connections
        if (abortControllerRef.current) {
            console.warn('[useChatStream] Stream already active');
            return;
        }

        try {
            setStatus('connecting');
            setConnectionStatus('connecting');
            setError(null);
            setStreamedMessage('');
            accumulatedMessageRef.current = '';
            completedRef.current = false; // Reset completion flag for new stream

            // Fetch auth token
            const token = await getToken();

            // Create AbortController for cancellation
            const abortController = new AbortController();
            abortControllerRef.current = abortController;

            // Start fetch with Authorization header and POST body
            const response = await fetch(functionUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token.idToken}`,
                    'Accept': 'text/event-stream',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ sessionId, messages }),
                signal: abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            if (!response.body) {
                throw new Error('Response body is null');
            }

            // Read stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            try {
                while (true) {
                    const { done, value } = await reader.read();

                    if (done) {
                        console.log('[useChatStream] Stream completed');
                        const finalMessage = accumulatedMessageRef.current;
                        setStatus('completed');
                        setConnectionStatus('connected');

                        // Only call onComplete if not already called
                        if (!completedRef.current) {
                            completedRef.current = true;
                            onComplete?.(finalMessage);
                        }
                        break;
                    }

                    // Decode chunk
                    const chunkText = decoder.decode(value, { stream: true });
                    const parsed = parseSSEChunk(chunkText);

                    if (parsed) {
                        const { event, data } = parsed;

                        // Handle different event types
                        switch (event) {
                            case 'connection':
                                console.log('[useChatStream] Connected:', data);
                                setConnectionStatus('connected');
                                setStatus('streaming');
                                onConnection?.();
                                break;

                            case 'message':
                                // Accumulate message chunks
                                setConnectionStatus('streaming');
                                accumulatedMessageRef.current += data;
                                setStreamedMessage(accumulatedMessageRef.current);
                                onMessageChunk?.(data, accumulatedMessageRef.current);
                                break;

                            case 'complete':
                                console.log('[useChatStream] Stream marked complete:', data);
                                const finalMessage = accumulatedMessageRef.current;
                                setStatus('completed');
                                setConnectionStatus('connected');

                                // Only call onComplete if not already called
                                if (!completedRef.current) {
                                    completedRef.current = true;
                                    onComplete?.(finalMessage);
                                }
                                break;

                            case 'error':
                                console.error('[useChatStream] Server error:', data);
                                const errorData = JSON.parse(data);
                                const streamError: StreamError = {
                                    message: errorData.error || 'Server error',
                                    code: 'SERVER_ERROR',
                                };
                                setError(streamError);
                                setStatus('error');
                                setConnectionStatus('error');
                                onError?.(streamError);
                                break;

                            default:
                                console.warn('[useChatStream] Unknown event type:', event);
                        }
                    }
                }
            } finally {
                reader.releaseLock();
                abortControllerRef.current = null;
            }

        } catch (err) {
            // Ignore abort errors (user-initiated stop)
            if (err instanceof Error && err.name === 'AbortError') {
                console.log('[useChatStream] Stream aborted by user');
                return;
            }

            console.error('[useChatStream] Failed to stream:', err);

            const streamError: StreamError = {
                message: err instanceof Error ? err.message : 'Failed to start stream',
                code: 'STREAM_ERROR',
            };

            setError(streamError);
            setStatus('error');
            setConnectionStatus('error');
            onError?.(streamError);
            abortControllerRef.current = null;
        }
    }, [functionUrl, getToken, onMessageChunk, onComplete, onError, onConnection]);

    /**
     * Stop SSE streaming connection
     */
    const stopStream = useCallback(() => {
        if (abortControllerRef.current) {
            console.log('[useChatStream] Stopping stream');
            abortControllerRef.current.abort();
            abortControllerRef.current = null;

            const finalMessage = accumulatedMessageRef.current;
            setStatus('completed');

            // Only call onComplete if not already called
            if (!completedRef.current) {
                completedRef.current = true;
                onComplete?.(finalMessage);
            }
        }
    }, [onComplete]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
                abortControllerRef.current = null;
            }
        };
    }, []);

    return {
        status,
        connectionStatus,
        streamedMessage,
        error,
        startStream,
        stopStream,
        isStreaming: status === 'streaming',
    };
};
