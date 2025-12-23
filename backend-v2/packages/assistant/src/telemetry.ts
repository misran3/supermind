import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { LangfuseExporter } from 'langfuse-vercel';

// Initialize the SDK once (outside the handler)
const sdk = new NodeSDK({
    traceExporter: new LangfuseExporter({
        secretKey: process.env.LANGFUSE_SECRET_KEY,
        publicKey: process.env.LANGFUSE_PUBLIC_KEY,
        baseUrl: process.env.LANGFUSE_BASEURL,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

// Export a flush function to use in your Lambda handler
export async function flushTelemetry() {
    // We use the internal provider to flush without shutting down the SDK
    // This keeps the connection alive for warm starts
    const provider = (sdk as any)._tracerProvider;
    if (provider) {
        await provider.forceFlush();
    }
}
