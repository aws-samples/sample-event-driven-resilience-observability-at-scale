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
        this.queue = new Queue(scope, id + 'Queue', {
            deadLetterQueue: { queue: new Queue(scope, id + 'DLQ'), maxReceiveCount: 3 }
        })
    }
}