import { ChatSession, Message } from '@/src/types/types';

export const DUMMY_CHATS: ChatSession[] = [
    {
        id: '1',
        title: 'Project Titan Brainstorm',
        preview: 'The architecture looks solid, but we need to...',
        date: '2m ago',
    },
    {
        id: '2',
        title: 'Weekly Groceries & Meal Prep',
        preview: 'Here is a list of high-protein options...',
        date: '1d ago',
    },
    { id: '3', title: 'Learning Rust', preview: 'Ownership and borrowing are key concepts...', date: '3d ago' },
    { id: '4', title: 'Q3 Financial Review', preview: 'Analyzing the spreadsheet data now...', date: '1w ago' },
];

export const DUMMY_MESSAGES: Message[] = [
    {
        id: '1',
        sender: 'ai',
        text: "Hello! I'm ready to help you organize your thoughts. What are we working on today?",
        timestamp: '10:00 AM',
    },
    {
        id: '2',
        sender: 'user',
        text: 'I need to structure a proposal for the new marketing campaign.',
        timestamp: '10:01 AM',
    },
    {
        id: '3',
        sender: 'ai',
        text: "Excellent. Let's start with the core objective. Is this for brand awareness or lead generation?",
        timestamp: '10:01 AM',
    },
];
