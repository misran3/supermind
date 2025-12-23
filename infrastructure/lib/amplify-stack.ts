import * as cdk from 'aws-cdk-lib';
import * as amplify from 'aws-cdk-lib/aws-amplify';

export class AmplifyStack extends cdk.Stack {
    public readonly amplifyApp: amplify.CfnApp;
    public readonly amplifyBranch: amplify.CfnBranch;

    constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        const amplifyAppConfig: any = {
            name: 'supermind-ai-assistant',
            description: 'Supermind - AI Assistant Powered by Supermemory',
            platform: 'WEB',
            customRules: [
                {
                    source: '</^[^.]+$|\\.(?!(css|gif|ico|jpg|js|png|txt|svg|woff|woff2|ttf|map|json|html)$)([^.]+$)/>',
                    target: '/index.html',
                    status: '200',
                },
            ],
            environmentVariables: [
                {
                    name: 'NEXT_PUBLIC_USER_POOL_ID',
                    value: '', // Will be set after Cognito is created
                },
                {
                    name: 'NEXT_PUBLIC_USER_POOL_CLIENT_ID',
                    value: '', // Will be set after Cognito is created
                },
                {
                    name: 'NEXT_PUBLIC_CHAT_STREAM_URL',
                    value: '', // Will be set after Lambda is created
                },
                {
                    name: 'NEXT_PUBLIC_API_BASE_URL',
                    value: '', // Will be set after API Gateway is created
                },
            ],
        };

        this.amplifyApp = new amplify.CfnApp(this, 'AiAssistantAmplifyApp', amplifyAppConfig);

        this.amplifyBranch = new amplify.CfnBranch(this, 'AiAssistantAmplifyBranch', {
            appId: this.amplifyApp.attrAppId,
            branchName: 'main',
            stage: 'PRODUCTION',
            enableAutoBuild: true,
            enablePullRequestPreview: false,
        });

        new cdk.CfnOutput(this, 'AmplifyAppId', {
            value: this.amplifyApp.attrAppId,
            description: 'AWS Amplify App ID for frontend hosting',
            exportName: 'SupermindAiAssistantAmplifyAppId',
        });

        new cdk.CfnOutput(this, 'AmplifyAppName', {
            value: this.amplifyApp.name,
            description: 'AWS Amplify App Name',
            exportName: 'SupermindAiAssistantAmplifyAppName',
        });

        // Domain Output will be available after deployment
        new cdk.CfnOutput(this, 'AmplifyDomainUrl', {
            value: `https://${this.amplifyBranch.branchName}.${this.amplifyApp.attrAppId}.amplifyapp.com`,
            description: 'AWS Amplify frontend URL',
            exportName: 'SupermindAiAssistantAmplifyDomainUrl',
        });
    }
}
