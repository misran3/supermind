# Gmail Sync Worker

AWS Lambda webhook listener for Gmail messages from Composio.

## Features

- Receives Composio webhook events for Gmail messages
- Extracts email details (sender, subject, body, recipients)
- Uses Vercel AI SDK + AWS Bedrock (Claude) for content enhancement
- Identifies action items and key information
- Stores enhanced memories in Supermemory with multi-tenancy support
- AWS Lambda Powertools for observability

## Webhook Payload

Expected Composio webhook format:

```json
{
  "entity_id": "user_123",
  "trigger_name": "gmail_new_message",
  "data": {
    "id": "msg_id_123",
    "message_id": "abc123@mail.gmail.com",
    "from": "sender@example.com",
    "to": "recipient@example.com",
    "subject": "Project Update",
    "date": "2025-12-22T09:30:00Z",
    "body": "Here's the latest update on the project...",
    "snippet": "Here's the latest update..."
  }
}
```

## Environment Variables

```bash
# Required
SUPERMEMORY_API_KEY=your_api_key
AWS_REGION=us-east-1

# Optional (defaults shown)
BEDROCK_MODEL_ID=us.anthropic.claude-3-5-sonnet-20241022-v2:0
POWERTOOLS_SERVICE_NAME=gmail-sync-worker
POWERTOOLS_LOG_LEVEL=INFO
```

## Lambda Configuration

Recommended settings:
- **Runtime**: Node.js 22.x
- **Memory**: 512 MB
- **Timeout**: 60 seconds
- **Architecture**: arm64 (Graviton2)

## Memory Storage

Stored in Supermemory with:
- **Category**: `COMMUNICATION`
- **Source**: `EMAIL_SYNC`
- **Container Tag**: User's `entity_id`
- **Custom ID**: Message ID (for deduplication)

## AI Enhancement

The AI agent processes each email to:
- Summarize key points
- Extract action items
- Identify important dates/deadlines
- Provide context for future recall
- Keep summaries concise (200-300 words)
