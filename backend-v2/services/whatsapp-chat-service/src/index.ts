/**
 * WhatsApp Chat Lambda Handler for Twilio Webhook
 *
 * This handler receives WhatsApp messages via Twilio webhook,
 * parses the incoming message, and returns a TwiML response.
 *
 * Reference:
 * https://www.twilio.com/docs/sms/twiml
 */

import { type APIGatewayProxyEvent, type APIGatewayProxyResult, type Context } from 'aws-lambda';
import { Logger, LogLevel } from '@aws-lambda-powertools/logger';

// Initialize Logger
const logger = new Logger({
    serviceName: 'whatsapp-chat-service',
    logLevel: LogLevel.INFO,
});

/**
 * Parsed WhatsApp message data from Twilio
 */
interface TwilioWebhookData {
    Body?: string;
    From?: string;
    To?: string;
    MessageSid?: string;
    [key: string]: string | undefined;
}

/**
 * Parse application/x-www-form-urlencoded data
 */
function parseFormData(body: string): TwilioWebhookData {
    const params = new URLSearchParams(body);
    const data: TwilioWebhookData = {};

    // Convert URLSearchParams to object
    params.forEach((value, key) => {
        data[key] = value;
    });

    return data;
}

/**
 * Create TwiML XML response
 */
function createTwiMLResponse(message: string): string {
    // Escape XML special characters
    const escapedMessage = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message>${escapedMessage}</Message>
</Response>`;
}

/**
 * Lambda handler for WhatsApp webhook from Twilio
 *
 * Parses incoming message and returns an echo response in TwiML format.
 */
export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
    try {
        logger.info('Received WhatsApp webhook event', {
            requestId: context.awsRequestId,
            event,
        });

        // Parse the body - handle both raw string and base64 encoded
        let body = event.body || '';

        if (event.isBase64Encoded) {
            body = Buffer.from(body, 'base64').toString('utf-8');
            logger.debug('Decoded base64 body');
        }

        // Parse application/x-www-form-urlencoded data
        const parsedData = parseFormData(body);

        logger.info('Parsed webhook data', {
            parsedData,
            messagePreview: parsedData.Body?.substring(0, 50),
        });

        // Extract message text and sender
        const messageText = parsedData.Body || '';
        const sender = parsedData.From || 'unknown';

        logger.info('Processing message', {
            sender,
            messageLength: messageText.length,
        });

        // Create echo response
        const echoMessage = `Echo: ${messageText}`;

        // Build TwiML XML response
        const twimlBody = createTwiMLResponse(echoMessage);

        // Return Lambda response with proper format
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'text/xml',
            },
            body: twimlBody,
        };
    } catch (error) {
        // Log the error
        logger.error('Error processing WhatsApp message', {
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
        });

        // Return error response in TwiML format
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        const errorTwiml = createTwiMLResponse(`Error processing message: ${errorMessage}`);

        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'text/xml',
            },
            body: errorTwiml,
        };
    }
};
