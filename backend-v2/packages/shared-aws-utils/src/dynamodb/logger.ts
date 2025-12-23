import { Logger, LogLevel } from '@aws-lambda-powertools/logger';

const logger = new Logger({
    serviceName: 'web-chat-service',
    logLevel: LogLevel.INFO,
});

export default logger;
