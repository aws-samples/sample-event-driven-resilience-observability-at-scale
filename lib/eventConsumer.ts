import { Duration, PhysicalName } from "aws-cdk-lib";
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
    }
}