# Supermind AI Assistant

A production-ready, memory-powered personal assistant that showcases intelligent chatbot capabilities enhanced by long-term memory. Built for the [DevHouse SF hackathon](https://devhouse.devlabs.club/), Supermind demonstrates seamless integration of AI agents, persistent memory, and real-world productivity tools.

---

## Project Description

**Powered by [supermemory.ai](https://supermemory.ai/)**, Supermind is a full-stack personal assistant that combines the conversational power of Amazon Bedrock's Claude models with Supermemory's long-term memory capabilities. The assistant remembers conversations across sessions, integrates with Gmail and Google Calendar for context-aware assistance, and provides a smooth web-based chat experience.

### Key Features
- **Long-term Memory**: Automatic memory storage and retrieval using Supermemory SDK
- **Gmail & Calendar Integration**: Access and manage emails and calendar events via Composio
- **Real-time Streaming**: Fast, responsive chat with streaming responses
- **Multi-platform Ready**: Web-based chat with WhatsApp infrastructure prepared
- **Serverless Architecture**: Fully deployed on AWS for production scalability
- **Secure Authentication**: AWS Cognito with passwordless authentication support

---

## Technical Architecture

Supermind follows a modern serverless architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  Next.js 16 + React 19 + TailwindCSS (AWS Amplify)         │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                    API Gateway + Lambda                      │
│  ┌────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Web Chat       │  │ User Profile    │  │ Integrations │ │
│  │ Service        │  │ Service         │  │ Service      │ │
│  └───────┬────────┘  └─────────────────┘  └──────┬───────┘ │
│          │                                         │         │
│  ┌───────▼────────────────────────────────────────▼───────┐ │
│  │           AI Assistant Orchestrator                    │ │
│  │    (Amazon Bedrock + Supermemory Integration)         │ │
│  └───────┬────────────────────────────────────────────────┘ │
└──────────┼──────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                    Storage & Services                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ DynamoDB     │  │ Cognito      │  │ Secrets Manager  │  │
│  │ (Chat, User) │  │ (Auth)       │  │ (API Keys)       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────────┐
│                  External Integrations                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Supermemory  │  │ Composio     │  │ Amazon Bedrock   │  │
│  │ API          │  │ (Gmail, Cal) │  │ (Claude Models)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Core Components
- **Frontend**: Next.js application with real-time chat UI
- **API Layer**: AWS Lambda functions with streaming response support
- **AI Orchestrator**: Agent-based architecture with task delegation
- **Memory Layer**: Supermemory SDK for automatic context management
- **Storage**: DynamoDB for users, chat history, and integrations
- **Authentication**: AWS Cognito user pools
- **Integrations**: Composio for Gmail and Google Calendar access

---

## Directory Structure

```
supermind/
├── frontend/                   # Next.js 16 web application
│   ├── app/                    # App router pages
│   │   ├── auth/               # Authentication pages
│   │   ├── chat/               # Chat interface
│   │   ├── profile/            # User profile
│   │   └── onboarding/         # Onboarding flow
│   └── src/
│       ├── components/         # React components
│       ├── hooks/              # Custom hooks (auth, chat, history)
│       ├── services/           # API client services
│       └── views/              # View components
│
├── backend-v2/                   # TypeScript backend monorepo
│   ├── packages/                 # Shared packages
│   │   ├── assistant/            # AI orchestrator & agent logic
│   │   ├── supermemory-wrapper/  # Supermemory SDK wrapper
│   │   ├── shared-aws-utils/     # AWS utilities
│   │   └── shared-utils/         # Common utilities
│   │
│   └── services/                   # Lambda microservices
│       ├── web-chat-service/       # Web chat with streaming
│       ├── whatsapp-chat-service/  # WhatsApp integration (ready)
│       ├── chat-history-service/   # Chat persistence
│       ├── user-profile-service/   # User management
│       ├── integrations-service/   # OAuth & integrations
│       ├── gmail-sync-worker/      # Gmail background sync
│       └── gcal-sync-worker/       # Calendar background sync
│
├── infrastructure/             # AWS CDK (Infrastructure as Code)
│   ├── lib/                    # CDK stack definitions
│   │   ├── amplify-stack.ts    # Frontend hosting
│   │   ├── auth-stack.ts       # Cognito authentication
│   │   ├── storage-stack.ts    # DynamoDB tables & secrets
│   │   └── api-v2-stack.ts     # API Gateway & Lambda functions
│   └── bin/
│       └── supermind.ts        # CDK app entry point
│
├── deploy-amplify-app.sh      # Automated deployment script
└── update-frontend-env.sh     # Environment variable updater
```

---

## Setup and Deployment Instructions (on AWS)

### Prerequisites
- **Node.js** 18+ and **Bun** runtime
- **AWS CLI** configured with appropriate credentials
- **AWS CDK** 2.x (`npm install -g aws-cdk`)
- **Supermemory API Key** (from [supermemory.ai](https://supermemory.ai))
- **Composio API Key** (from [composio.dev/](https://composio.dev/) for Gmail/Calendar features)
- AWS account with appropriate permissions
- AWS CLI configured with credentials
- CDK bootstrapped in your account/region

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/misran3/supermind
cd supermind
export root_dir=$(pwd)

# Install frontend dependencies
cd $root_dir/frontend
bun install

# Install backend dependencies
cd $root_dir/backend-v2
bun install

# Install infrastructure dependencies
cd $root_dir/infrastructure
npm install
```

### 2. Bootstrap CDK (First-time only)

```bash
cd ${root_dir}/infrastructure
cdk bootstrap aws://ACCOUNT-ID/REGION
```

### 3. Deploy Infrastructure Stacks

Deploy in the following order (dependencies managed automatically):

```bash
# Deploy all stacks
cdk deploy --all

# Or deploy individually
cdk deploy SupermindStorageStack      # DynamoDB + Secrets
cdk deploy SupermindAmplifyStack      # Frontend hosting
cdk deploy SupermindAuthStack         # Cognito authentication
cdk deploy SupermindApiV2Stack        # API Gateway + Lambda
```

### 4. Update Secrets

After deployment, retrieve secret names from CloudFormation outputs:

```bash
cd ${root_dir}/infrastructure

export SUPERMEMORY_API_KEY="supermemory-api-key"
export COMPOSIO_API_KEY="composio-api-key"

./scripts/update-secrets.sh
```

### 4. Deploy Frontend to Amplify

```bash
# Automated deployment script
./deploy-amplify-app.sh
```

### 5. Access Your Application

Get your application URL:
```bash
aws cloudformation describe-stacks \
  --stack-name SupermindAmplifyStack \
  --query 'Stacks[0].Outputs[?OutputKey==`AmplifyDomainUrl`].OutputValue' \
  --output text
```

---

## Limitations & Future Work

As a hackathon project, Supermind demonstrates core capabilities while leaving room for enhancements. Below are known limitations and planned improvements:

### Missing Hackathon Requirements

**Web Search Integration** ⚠️
- Web search via parallel.ai or exa.ai is not yet implemented
- **Future Work**: Add web search tool to the orchestrator for real-time information retrieval

**Proactive Messaging** ⚠️
- The assistant currently responds to user messages but doesn't initiate conversations
- **Future Work**: Implement background workers that analyze calendar events, emails, and memory to trigger proactive notifications (e.g., "You have a meeting in 30 minutes" or "Follow up on email from yesterday")

**Memory Visualization** ⚠️
- Memory graph UI component from Supermemory package is not integrated
- **Future Work**: Add interactive memory graph visualization in the profile section using [@supermemory/memory-graph](https://supermemory.ai/docs/memory-graph/installation)

**Memory Management UI** ⚠️
- Users cannot currently delete or edit memories via the UI
- **Future Work**: Build memory management interface with Supermemory API integration for CRUD operations

**Real-time Tool Calling Visibility** ⚠️
- Tool invocations (Gmail, Calendar) happen in the background without UI feedback
- **Future Work**: Stream tool calling events to frontend and display in chat (e.g., "🔍 Searching your emails...")

**Rapid Message Batching** ⚠️
- Multiple rapid messages are treated as separate conversations
- **Future Work**: Implement message queuing with 2-3 second debounce to batch rapid messages into single agent invocation

### Platform Integration

**WhatsApp Activation** ⚠️
- WhatsApp service infrastructure exists but webhook integration is not configured
- **Future Work**: Set up Meta Business API webhooks and test end-to-end messaging flow

### Scalability & Performance

**Cold Start Optimization**
- Lambda functions may experience cold starts (2-3s delay)
- **Future Work**: Implement Lambda warming strategies or migrate to containerized deployments

**Concurrent User Handling**
- Current architecture supports moderate concurrent users
- **Future Work**: Add DynamoDB auto-scaling, CloudFront CDN, and connection pooling

### UI/UX Enhancements

**Design Polish**
- Basic functional UI with room for visual improvements
- **Future Work**: Enhanced animations, dark mode, mobile responsiveness, accessibility improvements

**Conversation Management**
- Session list is basic
- **Future Work**: Search, filter, archive, and export chat history

---

## License

This project was built for the [DevHouse SF hackathon](https://devhouse.devlabs.club/). See [LICENSE](LICENSE) for details.

## Acknowledgments

Built with:
- [Supermemory](https://supermemory.ai) - Long-term memory for AI agents
- [Amazon Bedrock](https://aws.amazon.com/bedrock/) - Claude AI models
- [Composio](https://composio.dev) - Tool integrations (Gmail, Calendar)
- [AWS CDK](https://aws.amazon.com/cdk/) - Infrastructure as Code
  
---
**Huge thanks to the [Devlabs](https://www.linkedin.com/company/devlabsclub) team for organizing an amazing hackathon!**
