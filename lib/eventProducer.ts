import { AccessLogFormat, AuthorizationType, AwsIntegration, LogGroupLogDestination, MethodLoggingLevel, MethodOptions, Resource, RestApi, CfnAccount, CfnRestApi } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { EventRouter } from "./eventRouter";
import { Effect, ManagedPolicy, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { PassthroughBehavior } from "aws-cdk-lib/aws-apigatewayv2";
import { LogGroup } from "aws-cdk-lib/aws-logs";


export type EventProducerProps = {
    router: EventRouter;
}

export class EventProducer extends Construct {
    api: RestApi;

    constructor(scope: Construct, id: string, props: EventProducerProps) {
        super(scope, id);

        // Create a role for writing logs to CloudWatch
        const cloudWatchRole = new Role(this, 'ApiGatewayCloudWatchRole', {
            assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('service-role/AmazonAPIGatewayPushToCloudWatchLogs')
            ]
        });

        // Update API Gateway account settings to use this role.
        const apiGatewayAccount = new CfnAccount(this, 'ApiGatewayAccount', {
            cloudWatchRoleArn: cloudWatchRole.roleArn
          });

        // Create a log group for storing access logs
        const accessLogs = new LogGroup(this, id + 'ApiAccessLogs', {
            logGroupName: id + 'ApiAccessLogs'
        });

        // CDK code for API Gateway with enhanced logging
        const api = new RestApi(scope, id + 'EventsRestApi', {
            deployOptions: {
                accessLogFormat: AccessLogFormat.jsonWithStandardFields({
                    caller: true,
                    httpMethod: true,
                    ip: true,
                    protocol: true,
                    requestTime: true,
                    resourcePath: true,
                    responseLength: true,
                    status: true,
                    user: true
                }),
                accessLogDestination: new LogGroupLogDestination(accessLogs),
                loggingLevel: MethodLoggingLevel.INFO,
                dataTraceEnabled: true,
                metricsEnabled: true,
            },
            // setting this prevents replacement behavior
            restApiName: id + 'EventProducerApi',
        });

        // add dependency between api gateway and the account/role for CloudWatch
        (api.node.defaultChild as CfnRestApi).addDependency(apiGatewayAccount);
        this.api = api;

        // Create service role for API Gateway granting access to EventBridge
        const role = new Role(scope, 'role', {
            assumedBy: new ServicePrincipal('apigateway.amazonaws.com'),
            inlinePolicies: {
                'PutEvents': new PolicyDocument({
                    statements: [
                        new PolicyStatement({
                            actions: ['events:PutEvents'],
                            effect: Effect.ALLOW,
                            resources: [props.router.bus.eventBusArn],
                        }),
                    ]
                })
            }
        });

        // set up the AWS integration with the event bus as a target
        const integration = new AwsIntegration({
            service: 'events',
            action: 'PutEvents',
            options: {
                credentialsRole: role,
                passthroughBehavior: PassthroughBehavior.WHEN_NO_MATCH,
                // this is where you will set response mapping
                integrationResponses: [
                    {
                        statusCode: '200',
                        responseTemplates: {
                            "application/json": `#set($inputRoot = $input.path('$'))
                            {
                                $util.escapeJavaScript($input.body)
                            }`
                        }
                    }
                ],
                // this is where you will set request mapping
                requestTemplates: {
                    "application/json": `#set($context.requestOverride.header.X-Amz-Target = "AWSEvents.PutEvents")
                        #set($context.requestOverride.header.Content-Type = "application/x-amz-json-1.1")
                        #set($inputRoot = $input.path('$'))
                        {
                            "Entries": [
                                {
                                    "Detail": "$util.escapeJavaScript($input.body)",
                                    "DetailType": "BusinessEvent",
                                    "EventBusName": "${props.router.bus.eventBusArn}",
                                    "Source": "$context.resourcePath",
                                    "TraceHeader": "$context.requestId",
                                    "Time": $context.requestTimeEpoch,
                                    "Resources": ["$context.apiId"]
                                }
                            ]
                        }`
                }
            }
        });

        // add request to all routes
        const businessEventPost: MethodOptions = {
            // WARNING: For production APIs, we recommend an
            // authorization strategy as a security best practice.
            // We use IAM here as this is a sample API.
            authorizationType: AuthorizationType.IAM,
            requestParameters: {
                "method.request.header.Authorization": true,
                "method.request.header.X-Amz-Target": false,
                "method.request.header.Content-Type": false,
                "method.request.header.X-Correlation-Id": false,
                "method.request.header.X-Request-Id": false
                /* Add required request parameters here like:
                "method.request.body.param": true,
                */
            },
            methodResponses: [
                {
                    // success response
                    statusCode: '200',
                    // validate the schema on the response here
                }
            ]
        }

        // create the api routes for each event type
        const resources: Resource[] = [];
        resources.push(api.root.addResource('ingestion'));
        resources.push(api.root.addResource('reconciliation'));
        resources.push(api.root.addResource('authorization'));
        resources.push(api.root.addResource('posting'));

        resources.forEach(resource => resource.addMethod('POST', integration, businessEventPost))
    }
}