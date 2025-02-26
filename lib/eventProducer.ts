import { AuthorizationType, AwsIntegration, MethodOptions, Resource, RestApi } from "aws-cdk-lib/aws-apigateway";
import { Construct } from "constructs";
import { EventRouter } from "./eventRouter";
import { Effect, PolicyDocument, PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { PassthroughBehavior } from "aws-cdk-lib/aws-apigatewayv2";


export type EventProducerProps = {
    router: EventRouter;
}

export class EventProducer extends Construct {
    constructor(scope: Construct, id: string, props: EventProducerProps) {
        super(scope, id);

        const api = new RestApi(scope, id + 'RestApi', {
            // setting this prevents replacement behavior
            restApiName: id + 'EventProducerApi'
        });

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
                                    "DetailType": "Invoice",
                                    "EventBusName": "${props.router.bus.eventBusArn}",
                                    "Source": "$context.resourcePath"
                                }
                            ]
                        }`
                }
            }
        });

        // add request to all routes
        const invoiceEventPost: MethodOptions = {
            // Change to your preferred type
            authorizationType: AuthorizationType.IAM,
            requestParameters: {
                "method.request.header.X-Amz-Target": false,
                "method.request.header.Content-Type": false,
                /* Add required request parameters below

                "method.request.body.invoiceId": true,
                "method.request.body.payeeCode": true,
                "method.request.body.legalEntityId": true,
                "method.request.body.invoiceDate": true,
                "method.request.body.invoiceDueDate": true,
                "method.request.body.invoiceAmount": true,
                "method.request.body.ppv": true,
                "method.request.body.pqv": true,
                "method.request.body.matchedAmount": true,
                "method.request.body.authorizedAmount": true,
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

        // create the api routes
        const resources: Resource[] = [];
        resources.push(api.root.addResource('ingestion'));
        resources.push(api.root.addResource('reconciliation'));
        resources.push(api.root.addResource('authorization'));
        resources.push(api.root.addResource('posting'));

        resources.forEach(resource => resource.addMethod('POST', integration, invoiceEventPost))
    }
}