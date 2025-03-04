import { aws_iam, aws_lambda, Duration, PhysicalName } from "aws-cdk-lib";
import { Metric } from "aws-cdk-lib/aws-cloudwatch";
import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export const EventQueueConsumerEvents = ['ingestion', 'reconciliation', 'authorization', 'posting'] as const;
export type EventQueueConsumerEventType = typeof EventQueueConsumerEvents[number] | "ALL";

export type EventConsumerProps = {
    type: EventQueueConsumerEventType;
}

export class EventConsumer extends Construct {
    public queue: Queue;
    public type: EventQueueConsumerEventType;

    constructor(scope: Construct, id: string, props: EventConsumerProps = { type: 'ALL' }) {
        super(scope, id);

        this.type = props.type;

        // create a queue with a dead letter queue attached
        this.queue = new Queue(this, id + 'EventsQueue', {
            visibilityTimeout: Duration.seconds(30),
            deadLetterQueue: {
                maxReceiveCount: 3,
                queue: new Queue(this, id + 'DeadLetterQueue', {
                    queueName: PhysicalName.GENERATE_IF_NEEDED
                })
            }
        });

        // Create custom CloudWatch metrics for queue monitoring
        const approximateAgeOfOldestMessage = new Metric({
            namespace: 'AWS/SQS',
            metricName: 'ApproximateAgeOfOldestMessage',
            dimensionsMap: { QueueName: this.queue.queueName },
            statistic: 'Maximum',
            period: Duration.minutes(1)
        });

        // Create alarm for message processing delays
        approximateAgeOfOldestMessage.createAlarm(this, 'OldMessageAlarm', {
            threshold: 60, // seconds
            evaluationPeriods: 2,
            alarmDescription: 'Messages are getting old in the queue'
        });

        // CDK code for observable Lambda consumer
        const processingFunction = new aws_lambda.Function(this, 'EventProcessingFunction', {
            runtime: aws_lambda.Runtime.NODEJS_22_X,
            handler: 'index.handler',
            code: aws_lambda.Code.fromAsset('lambda'),
            tracing: aws_lambda.Tracing.ACTIVE, // Enable X-Ray tracing
            environment: {
                LOG_LEVEL: 'INFO',
                METRICS_NAMESPACE: 'EventProcessing'
            }
        });

        // Grant permissions for CloudWatch metrics
        processingFunction.addToRolePolicy(new aws_iam.PolicyStatement({
            actions: ['cloudwatch:PutMetricData'],
            resources: ['*']
        }));

        // Connect the SQS to Lambda
        this.queue.grantConsumeMessages(processingFunction);
        processingFunction.addEventSourceMapping('EventSourceMapping', {
            eventSourceArn: this.queue.queueArn
        });
    }
}