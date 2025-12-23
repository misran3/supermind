import { Message, ViewState } from '@/src/types/types';
import { Brain, ChevronLeft, Loader2, Menu, MoreHorizontal, Plus, Search, Send, Settings, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useChatStream } from '@/src/hooks/useChatStream';
import { useChatHistory } from '@/src/hooks/useChatHistory';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface ChatViewProps {
    onNavigate: (view: ViewState) => void;
    sessionId?: string; // Optional - provided when viewing specific session
}

export const ChatView = ({ onNavigate, sessionId }: ChatViewProps) => {
    const router = useRouter();
    const [isSidebarOpen, setSidebarOpen] = useState(true);
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Chat history hook
    const {
        sessions,
        currentSession,
        messages: apiMessages,
        sessionsLoading,
        loadSessions,
        setCurrentSession,
        loadMessages,
        addMessage,
        createNewSession,
    } = useChatHistory();

    // Chat streaming hook - must be declared before effects that use isStreaming
    const chatStreamUrl = process.env.NEXT_PUBLIC_CHAT_STREAM_URL || '';
    const { startStream, isStreaming, connectionStatus } = useChatStream({
        functionUrl: chatStreamUrl,
        onConnection: () => {
            console.log('[ChatView] Connection established');
        },
        onMessageChunk: (_chunk, fullMessage) => {
            // Update the streaming message in real-time
            setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage?.isStreaming) {
                    // Update existing streaming message
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMessage, text: fullMessage },
                    ];
                }
                return prev;
            });
        },
        onComplete: async (fullMessage) => {
            // Mark message as complete (no longer streaming)
            setMessages((prev) => {
                const lastMessage = prev[prev.length - 1];
                if (lastMessage?.isStreaming) {
                    return [
                        ...prev.slice(0, -1),
                        { ...lastMessage, isStreaming: false },
                    ];
                }
                return prev;
            });
            console.log('[ChatView] Stream completed:', fullMessage);

            // Persist AI message to backend
            if (currentSession && fullMessage.trim()) {
                try {
                    await addMessage(currentSession.sessionId, {
                        content: fullMessage,
                        direction: 'outbound',
                        sender: 'assistant',
                        processingStatus: 'completed',
                    });
                    console.log('[ChatView] AI message persisted');
                } catch (error) {
                    console.error('[ChatView] Failed to persist AI message:', error);
                    toast.error('Failed to save message');
                }
            }
        },
        onError: (error) => {
            console.error('[ChatView] Stream error:', error);
            // Remove streaming message and show error
            setMessages((prev) => {
                const filtered = prev.filter((msg) => !msg.isStreaming);
                return [
                    ...filtered,
                    {
                        id: Date.now().toString(),
                        sender: 'ai',
                        text: `Error: ${error.message}`,
                        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                ];
            });
        },
    });

    // Load sessions on mount
    useEffect(() => {
        loadSessions({ archived: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Session validation: Load session from URL if sessionId is provided
    useEffect(() => {
        if (sessionId && sessions.length > 0) {
            const session = sessions.find((s) => s.sessionId === sessionId);
            if (session) {
                setCurrentSession(session);
            } else {
                // Invalid session ID, redirect to /chat
                console.warn('[ChatView] Invalid session ID:', sessionId);
                toast.error('Chat not found');
                router.push('/chat');
            }
        }
    }, [sessionId, sessions, setCurrentSession, router]);

    // Load messages when session changes
    useEffect(() => {
        if (currentSession) {
            loadMessages(currentSession.sessionId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentSession]);

    // Convert API messages to UI Message format
    useEffect(() => {
        // Don't overwrite messages while streaming - check for streaming message in current state
        setMessages((currentMessages) => {
            const hasStreamingMessage = currentMessages.some((msg) => msg.isStreaming);

            // If there's a streaming message, don't overwrite - preserve it
            if (hasStreamingMessage || isStreaming) {
                console.log('[ChatView] Skipping message sync - streaming in progress');
                return currentMessages;
            }

            // Safe to sync with API messages
            if (apiMessages.length > 0) {
                const uiMessages: Message[] = apiMessages.map((msg) => ({
                    id: msg.messageId,
                    sender: msg.sender === 'user' ? 'user' : 'ai',
                    text: msg.content,
                    timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }));
                return uiMessages;
            }
            return [];
        });
    }, [apiMessages, isStreaming]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages]);

    // Get status dot color and animation based on connection status
    const getStatusDotStyle = (status: string) => {
        switch (status) {
            case 'connected':
                return 'bg-green-500 shadow-green-500/50';
            case 'streaming':
                return 'bg-blue-500 shadow-blue-500/50 animate-pulse';
            case 'connecting':
                return 'bg-yellow-500 shadow-yellow-500/50 animate-pulse';
            case 'error':
                return 'bg-red-500 shadow-red-500/50';
            case 'disconnected':
            default:
                return 'bg-slate-300 shadow-slate-300/50';
        }
    };

    const handleNewChat = async () => {
        try {
            // Check if most recent session is empty (no messages)
            const mostRecentSession = sessions[0];

            if (mostRecentSession && mostRecentSession.messageCount === 0) {
                // Reuse the empty session - just navigate to it
                console.log('[ChatView] Reusing empty session:', mostRecentSession.sessionId);
                router.push(`/chat/${mostRecentSession.sessionId}`);
                return;
            }

            // Create new session if most recent has messages
            const newSession = await createNewSession({});
            if (newSession) {
                console.log('[ChatView] Created new session:', newSession.sessionId);
                router.push(`/chat/${newSession.sessionId}`);
            }
        } catch (error) {
            console.error('[ChatView] Failed to create new chat:', error);
            toast.error('Failed to create new chat');
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim() || isStreaming || !currentSession) return;

        const userInput = inputValue;
        setInputValue('');

        // Add user message to UI
        const userMsg: Message = {
            id: Date.now().toString(),
            sender: 'user',
            text: userInput,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, userMsg]);

        // Persist user message to backend
        try {
            await addMessage(currentSession.sessionId, {
                content: userInput,
                direction: 'inbound',
                sender: 'user',
                processingStatus: 'completed',
            });
        } catch (error) {
            console.error('[ChatView] Failed to persist user message:', error);
            toast.error('Failed to save message');
        }

        // Add streaming AI message placeholder
        const aiMsg: Message = {
            id: (Date.now() + 1).toString(),
            sender: 'ai',
            text: '',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isStreaming: true,
        };

        setMessages((prev) => [...prev, aiMsg]);

        // Start streaming with messages array
        await startStream(currentSession.sessionId, [
            {
                role: 'user',
                content: userInput,
            },
        ]);
    };

    return (
        <div className="flex h-screen bg-white overflow-hidden">
            {/* Sidebar - Desktop: Sticky, Mobile: Fixed overlay */}
            <div
                className={`${
                    isSidebarOpen ? 'w-80' : 'w-0'
                } bg-slate-50 border-r border-slate-200 flex-shrink-0 transition-all duration-300 ease-in-out flex flex-col relative`}
            >
                {/* Sidebar Header */}
                <div className="p-4 flex items-center justify-between sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
                    <div className="flex items-center space-x-2 text-indigo-600 font-bold text-xl tracking-tight">
                        <div className="relative">
                            <Brain size={24} />
                            {/* Status Dot Indicator */}
                            <div
                                className={`absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full shadow-lg transition-all duration-300 ${getStatusDotStyle(
                                    connectionStatus
                                )}`}
                                title={`Status: ${connectionStatus}`}
                            />
                        </div>
                        <span className={!isSidebarOpen ? 'hidden' : ''}>Supermind</span>
                    </div>
                    <button
                        onClick={() => onNavigate('profile')}
                        className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"
                    >
                        <User size={20} />
                    </button>
                </div>

                {/* New Chat Button */}
                <div className="px-4 py-3">
                    <button
                        onClick={handleNewChat}
                        disabled={sessionsLoading}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
                    >
                        <Plus size={18} />
                        <span>New Chat</span>
                    </button>
                </div>

                {/* Chat List */}
                <div className="flex-1 overflow-y-auto px-2 space-y-1">
                    <div className="px-2 py-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Recent
                    </div>

                    {sessionsLoading && (
                        <div className="px-4 py-8 text-center text-slate-400">
                            <Loader2 size={20} className="animate-spin mx-auto" />
                        </div>
                    )}

                    {!sessionsLoading && sessions?.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-slate-400">
                            No chats yet. Start a new one!
                        </div>
                    )}

                    {sessions && sessions.map((session) => (
                        <button
                            key={session.sessionId}
                            onClick={() => router.push(`/chat/${session.sessionId}`)}
                            className={`w-full text-left p-3 rounded-lg hover:bg-white hover:shadow-sm hover:border-slate-200 border transition-all group ${
                                currentSession?.sessionId === session.sessionId
                                    ? 'bg-white shadow-sm border-slate-200'
                                    : 'border-transparent'
                            }`}
                        >
                            <div className="flex justify-between items-start mb-0.5">
                                <span className="font-medium text-slate-900 truncate pr-2 text-sm">
                                    {session.title || 'Untitled Chat'}
                                </span>
                                <span className="text-[10px] text-slate-400 flex-shrink-0">
                                    {new Date(session.createdAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                    })}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 truncate group-hover:text-slate-600">
                                {session.messageCount} message{session.messageCount !== 1 ? 's' : ''}
                            </p>
                        </button>
                    ))}
                </div>

                {/* Sidebar Footer */}
                <div className="p-4 border-t border-slate-200">
                    <button className="flex items-center space-x-3 w-full p-2 rounded-lg hover:bg-slate-200 transition-colors text-slate-600">
                        <Settings size={18} />
                        <span className="text-sm font-medium">Settings</span>
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-white relative">
                {/* Top Navigation Bar */}
                <header className="h-16 border-b border-slate-100 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md sticky top-0 z-20">
                    <div className="flex items-center">
                        <button
                            onClick={() => setSidebarOpen(!isSidebarOpen)}
                            className="mr-4 p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
                        >
                            {isSidebarOpen ? <ChevronLeft size={20} /> : <Menu size={20} />}
                        </button>
                        <h2 className="font-semibold text-slate-800">
                            {currentSession?.title || 'Select or create a chat'}
                        </h2>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <Search size={20} />
                        </button>
                        <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors">
                            <MoreHorizontal size={20} />
                        </button>
                    </div>
                </header>

                {/* Messages Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`flex max-w-2xl ${msg.sender === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                            >
                                {/* Avatar */}
                                <div
                                    className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-1 ${
                                        msg.sender === 'user'
                                            ? 'bg-indigo-100 text-indigo-600 ml-4'
                                            : 'bg-slate-900 text-white mr-4'
                                    }`}
                                >
                                    {msg.sender === 'user' ? <User size={14} /> : <Brain size={14} />}
                                </div>

                                {/* Bubble */}
                                <div
                                    className={`group relative p-5 rounded-2xl ${
                                        msg.sender === 'user'
                                            ? 'bg-indigo-600 text-white rounded-tr-sm'
                                            : 'bg-slate-50 border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
                                    }`}
                                >
                                    <p className="text-sm md:text-base leading-relaxed whitespace-pre-wrap">
                                        {msg.text}
                                        {msg.isStreaming && (
                                            <span className="inline-block ml-1 w-2 h-4 bg-slate-400 animate-pulse" />
                                        )}
                                    </p>
                                    <span
                                        className={`absolute bottom-1 text-[10px] opacity-0 group-hover:opacity-60 transition-opacity ${
                                            msg.sender === 'user'
                                                ? 'right-full mr-2 text-slate-400'
                                                : 'left-full ml-2 text-slate-400'
                                        }`}
                                    >
                                        {msg.timestamp}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 md:p-6 bg-white">
                    <div className="max-w-4xl mx-auto relative">
                        <div className="relative flex items-end shadow-lg shadow-slate-200/50 rounded-2xl bg-white border border-slate-200 focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500 transition-all overflow-hidden">
                            <textarea
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder="Ask anything..."
                                className="w-full max-h-48 py-4 pl-4 pr-12 bg-transparent border-none focus:ring-0 resize-none text-slate-800 placeholder:text-slate-400 text-sm md:text-base"
                                rows={1}
                                style={{ minHeight: '56px' }}
                            />
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isStreaming}
                                className="absolute right-2 bottom-2 p-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition-all"
                            >
                                {isStreaming ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Send size={18} />
                                )}
                            </button>
                        </div>
                        <p className="text-center text-xs text-slate-400 mt-3">
                            Supermind can make mistakes. Verify important information.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
