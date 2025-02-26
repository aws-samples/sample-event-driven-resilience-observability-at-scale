import { Queue } from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export type EventQueueConsumerEventType = 'ALL' | 'ingestion'| 'reconciliation' | 'authorization' | 'posting';

export type EventConsumerProps = {
    type: EventQueueConsumerEventType;
}

export class EventConsumer extends Construct {
    queue: Queue;
    type: EventQueueConsumerEventType;

    constructor(scope: Construct, id: string, props: EventConsumerProps = { type: 'ALL' }) {
        super(scope, id);

        this.type = props.type;

        // create a queue with a dead letter queue attached
        this.queue = new Queue(scope, id + 'Queue', {
            deadLetterQueue: { queue: new Queue(scope, id + 'DLQ'), maxReceiveCount: 3 }
        })
    }
}