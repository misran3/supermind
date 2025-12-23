#!/bin/bash

set -e

# Configuration
AUTH_STACK_NAME="SupermindAuthStack"
API_STACK_NAME="SupermindApiV2Stack"
AMPLIFY_STACK_NAME="SupermindAmplifyStack"
FRONTEND_DIR="./frontend"
ENV_FILE="$FRONTEND_DIR/.env"

echo "Running environment checks..."

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install AWS CLI and configure it."
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "$FRONTEND_DIR" ]; then
    echo "❌ Frontend directory not found. Please run this script from the project root."
    exit 1
fi
echo "✅ Environment checks passed."

echo -e "\n📋 Fetching CloudFormation stack outputs..."
# Function to get stack output value
get_stack_output() {
    local stack_name=$1
    local output_key=$2
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text 2>/dev/null || echo ""
}

# Get all required outputs from CloudFormation
USER_POOL_ID=$(get_stack_output "$AUTH_STACK_NAME" "UserPoolId")
USER_POOL_CLIENT_ID=$(get_stack_output "$AUTH_STACK_NAME" "UserPoolClientId")
CHAT_STREAM_URL=$(get_stack_output "$API_STACK_NAME" "WebChatStreamUrlV2")
API_GW_BASE_URL=$(get_stack_output "$API_STACK_NAME" "ApiUrlV2")

# Validate required outputs
if [ -z "$USER_POOL_ID" ]; then
    echo "❌ Could not retrieve Cognito User Pool ID from CloudFormation stack: $AUTH_STACK_NAME"
    echo "   Make sure the stack has been deployed successfully."
    exit 1
fi

if [ -z "$USER_POOL_CLIENT_ID" ]; then
    echo "❌ Could not retrieve Cognito User Pool Client ID from CloudFormation stack: $AUTH_STACK_NAME"
    echo "   Make sure the stack has been deployed successfully."
    exit 1
fi

if [ -z "$CHAT_STREAM_URL" ]; then
    echo "❌ Could not retrieve Chat Stream URL from CloudFormation stack: $API_STACK_NAME"
    echo "   Make sure the stack has been deployed successfully."
    exit 1
fi

if [ -z "$API_GW_BASE_URL" ]; then
    echo "❌ Could not retrieve API Gateway Base URL from CloudFormation stack: $API_STACK_NAME"
    echo "   Make sure the stack has been deployed successfully."
    exit 1
fi

echo "✅ Retrieved stack outputs:"
echo "   Cognito User Pool ID: $USER_POOL_ID"
echo "   Cognito User Pool Client ID: $USER_POOL_CLIENT_ID"
echo "   Web Chat Stream URL: $CHAT_STREAM_URL"
echo "   API Gateway Base URL: $API_GW_BASE_URL"
# Create .env.production file for the build
echo -e "\n🛠️ Updating environment variables in $ENV_FILE"
cat > "$ENV_FILE" << EOF
# Auto-generated production environment variables
# Generated on $(date)

NEXT_PUBLIC_USER_POOL_ID=$USER_POOL_ID
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
NEXT_PUBLIC_CHAT_STREAM_URL=$CHAT_STREAM_URL
NEXT_PUBLIC_API_BASE_URL=$API_GW_BASE_URL
EOF

echo "✅ Created $ENV_FILE with latest environment variables"
