#!/bin/bash

set -e

# Configuration
AUTH_STACK_NAME="SupermindAuthStack"
API_STACK_NAME="SupermindApiV2Stack"
AMPLIFY_STACK_NAME="SupermindAmplifyStack"
FRONTEND_DIR="./frontend"
ENV_FILE="$FRONTEND_DIR/.env.production"

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
AMPLIFY_APP_ID=$(get_stack_output "$AMPLIFY_STACK_NAME" "AmplifyAppId")
AMPLIFY_DOMAIN_URL=$(get_stack_output "$AMPLIFY_STACK_NAME" "AmplifyDomainUrl")

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
echo "   Amplify App ID: $AMPLIFY_APP_ID"
echo "   Amplify Domain URL: $AMPLIFY_DOMAIN_URL"

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


# Build the frontend
echo "🔨 Building frontend application..."
cd "$FRONTEND_DIR"

# Check if bun is installed
if ! command -v bun &> /dev/null; then
    echo "❌ Bun not found. Install with: curl -fsSL https://bun.sh/install | bash"
    echo "   Falling back to npm..."
    USE_BUN=false
else
    USE_BUN=true
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    if [ "$USE_BUN" = true ]; then
        bun install --frozen-lockfile
    else
        npm ci
    fi
fi

# Build the application
echo "🏗️  Running build command..."
if [ "$USE_BUN" = true ]; then
    echo "   Using Bun for faster builds..."
    bun run build
else
    npm run build
fi

# Check if build was successful
if [ ! -d "dist" ]; then
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "✅ Build completed successfully"

# Go back to project root
cd ..

# Deploy to Amplify using AWS CLI
echo "🚀 Deploying to AWS Amplify..."

# Create a deployment package
DEPLOY_PACKAGE="amplify-deploy-$(date +%Y%m%d-%H%M%S).zip"
echo "📦 Creating deployment package: $DEPLOY_PACKAGE"

# Create _redirects file for SPA support (client-side routing)
echo "📝 Creating _redirects file for SPA support..."
cat > "$FRONTEND_DIR/dist/_redirects" << 'EOF'
/* /index.html 200
EOF

# Navigate into dist directory and zip its contents (not the dist folder itself)
cd "$FRONTEND_DIR/dist"
zip -r "../../$DEPLOY_PACKAGE" . -x "*.DS_Store"
cd ../..

# Start the deployment
echo "📤 Uploading to Amplify App: $AMPLIFY_APP_ID"

# Create deployment and get upload URL
echo "📤 Creating deployment..."
DEPLOYMENT_RESPONSE=$(aws amplify create-deployment \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "main" \
    --output json)

JOB_ID=$(echo "$DEPLOYMENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['jobId'])")
UPLOAD_URL=$(echo "$DEPLOYMENT_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin)['zipUploadUrl'])")

if [ -z "$JOB_ID" ] || [ -z "$UPLOAD_URL" ]; then
    echo "❌ Failed to create Amplify deployment"
    echo "Response: $DEPLOYMENT_RESPONSE"
    rm -f "$DEPLOY_PACKAGE"
    exit 1
fi

echo "✅ Deployment created with Job ID: $JOB_ID"

# Upload the zip file to the presigned URL
echo "📤 Uploading deployment package..."
curl -X PUT -T "$DEPLOY_PACKAGE" "$UPLOAD_URL"

if [ $? -ne 0 ]; then
    echo "❌ Failed to upload deployment package"
    rm -f "$DEPLOY_PACKAGE"
    exit 1
fi

echo "✅ Deployment package uploaded successfully"

# Start the deployment
echo "🚀 Starting deployment..."
aws amplify start-deployment \
    --app-id "$AMPLIFY_APP_ID" \
    --branch-name "main" \
    --job-id "$JOB_ID"

if [ $? -ne 0 ]; then
    echo "❌ Failed to start deployment"
    rm -f "$DEPLOY_PACKAGE"
    exit 1
fi

echo "✅ Deployment started successfully"

# Monitor deployment status
echo "⏳ Monitoring deployment status..."
while true; do
    JOB_STATUS=$(aws amplify get-job \
        --app-id "$AMPLIFY_APP_ID" \
        --branch-name "main" \
        --job-id "$JOB_ID" \
        --query 'job.summary.status' \
        --output text)
    
    case $JOB_STATUS in
        "SUCCEED")
            echo "✅ Deployment completed successfully!"
            break
            ;;
        "FAILED"|"CANCELLED")
            echo "❌ Deployment failed with status: $JOB_STATUS"
            rm -f "$DEPLOY_PACKAGE"
            exit 1
            ;;
        "RUNNING"|"PENDING")
            echo "⏳ Deployment in progress... (Status: $JOB_STATUS)"
            sleep 5
            ;;
        *)
            echo "⚠️  Unknown deployment status: $JOB_STATUS"
            sleep 5
            ;;
    esac
done

# Clean up
rm -f "$DEPLOY_PACKAGE"

echo ""
echo "🎉 Frontend deployment completed successfully!"
echo ""
echo "📱 Application URLs:"
echo "   Frontend: $AMPLIFY_DOMAIN_URL"
echo "   API Gateway: $API_GW_BASE_URL"
echo ""
echo "✨ Your Supermind AI Assistant is now live!"