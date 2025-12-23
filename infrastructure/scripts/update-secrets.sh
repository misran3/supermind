#!/bin/bash

# Helper script to update AWS Secrets Manager secrets after CDK deployment
# This keeps secrets out of CloudFormation templates and version control.
#
# Usage:
#   1. Set environment variables with your actual secret values
#   2. Run: ./scripts/update-secrets.sh
#
# Or pass values as arguments:
#   ./scripts/update-secrets.sh <google_client_id> <google_client_secret> <supermemory_api_key>

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_PROFILE="${AWS_PROFILE:-default}"
AWS_REGION="${AWS_REGION:-us-east-1}"
STACK_NAME="SupermindStorageStack"

# Get secret names dynamically from CloudFormation outputs
echo -e "${YELLOW}Fetching secret names from CloudFormation stack...${NC}"

GOOGLE_OAUTH_SECRET_NAME=$(aws cloudformation describe-stacks \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`GoogleOAuthSecretName`].OutputValue' \
  --output text 2>/dev/null)

SUPERMEMORY_SECRET_NAME=$(aws cloudformation describe-stacks \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --stack-name "$STACK_NAME" \
  --query 'Stacks[0].Outputs[?OutputKey==`SupermemoryApiKeySecretName`].OutputValue' \
  --output text 2>/dev/null)

# Check if we got the secret names
if [ -z "$GOOGLE_OAUTH_SECRET_NAME" ] || [ -z "$SUPERMEMORY_SECRET_NAME" ]; then
  echo -e "${RED}Error: Could not retrieve secret names from CloudFormation stack.${NC}"
  echo "Make sure the stack '$STACK_NAME' is deployed and AWS credentials are configured."
  exit 1
fi

echo -e "${GREEN}✓ Found secret names${NC}"
echo "  Google OAuth: $GOOGLE_OAUTH_SECRET_NAME"
echo "  Supermemory: $SUPERMEMORY_SECRET_NAME"

# Get values from arguments or environment variables
GOOGLE_CLIENT_ID="${1:-${GOOGLE_OAUTH_CLIENT_ID}}"
GOOGLE_CLIENT_SECRET="${2:-${GOOGLE_OAUTH_CLIENT_SECRET}}"
SUPERMEMORY_API_KEY="${3:-${SUPERMEMORY_API_KEY}}"
GOOGLE_REDIRECT_URI="${GOOGLE_OAUTH_REDIRECT_URI:-http://localhost:3000/oauth/callback}"

echo -e "${YELLOW}=== Updating AWS Secrets Manager ===${NC}"
echo "AWS Profile: $AWS_PROFILE"
echo "AWS Region: $AWS_REGION"
echo ""

# Update Google OAuth credentials
if [ -n "$GOOGLE_CLIENT_ID" ] && [ -n "$GOOGLE_CLIENT_SECRET" ]; then
  echo -e "${GREEN}Updating Google OAuth credentials...${NC}"

  SECRET_VALUE=$(cat <<EOF
{
  "client_id": "$GOOGLE_CLIENT_ID",
  "client_secret": "$GOOGLE_CLIENT_SECRET",
  "redirect_uri": "$GOOGLE_REDIRECT_URI"
}
EOF
)

  aws secretsmanager put-secret-value \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --secret-id "$GOOGLE_OAUTH_SECRET_NAME" \
    --secret-string "$SECRET_VALUE" \
    > /dev/null

  echo -e "${GREEN}✓ Google OAuth credentials updated${NC}"
else
  echo -e "${YELLOW}⚠ Skipping Google OAuth (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)${NC}"
fi

echo ""

# Update Supermemory API Key
if [ -n "$SUPERMEMORY_API_KEY" ]; then
  echo -e "${GREEN}Updating Supermemory API key...${NC}"

  SECRET_VALUE=$(cat <<EOF
{
  "api_key": "$SUPERMEMORY_API_KEY"
}
EOF
)

  aws secretsmanager put-secret-value \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --secret-id "$SUPERMEMORY_SECRET_NAME" \
    --secret-string "$SECRET_VALUE" \
    > /dev/null

  echo -e "${GREEN}✓ Supermemory API key updated${NC}"
else
  echo -e "${YELLOW}⚠ Skipping Supermemory API key (missing SUPERMEMORY_API_KEY)${NC}"
fi

echo ""
echo -e "${GREEN}=== Done ===${NC}"
echo ""
echo "To verify secrets were updated:"
echo "  aws secretsmanager get-secret-value --secret-id $GOOGLE_OAUTH_SECRET_NAME --query SecretString --output text | jq"
echo "  aws secretsmanager get-secret-value --secret-id $SUPERMEMORY_SECRET_NAME --query SecretString --output text | jq"
