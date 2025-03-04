import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

import { EventConsumer } from './eventConsumer';
import { EventProducer } from './eventProducer';
import { EventRouter } from './eventRouter';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { EventMonitoring } from './eventMonitoring';
import { consumers } from 'stream';

export class CellStack extends cdk.Stack {
    router: EventRouter;
    producer: EventProducer;
    consumers: EventConsumer[] = [];
    deadLetterQueues: Queue[] = [];
    monitoring: EventMonitoring;

    constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // create an event router
        this.router = new EventRouter(this, id + 'Router');

        // create an event producer
        this.producer = new EventProducer(this, id + 'Producer', {
            router: this.router
        })

        // create a consumer for every type of event
        this.consumers.push(new EventConsumer(this, id + 'IngestionConsumer', { type: 'ingestion' }));
        this.consumers.push(new EventConsumer(this, id + 'ReconciliationConsumer', { type: 'reconciliation' }));
        this.consumers.push(new EventConsumer(this, id + 'AuthorizationConsumer', { type: 'authorization' }));
        this.consumers.push(new EventConsumer(this, id + 'PostingConsumer', { type: 'posting' }));

        // connect consumers to the router
        this.consumers.forEach(consumer => {
            const target = this.router.targets.find(target => target.type == consumer.type)!;

            const deadLetterQueue = new Queue(this, consumer.node.id + consumer.type + 'DeadLetterQueue');
            target.topic.addSubscription(new SqsSubscription(consumer.queue, {
                deadLetterQueue: deadLetterQueue
            }));

            this.deadLetterQueues.push(deadLetterQueue);
        });

        const deadLetterQueues = [
            ...this.deadLetterQueues, 
            this.router.deadLetterQueue,
            ...this.consumers?.map(consumer => consumer.deadLetterQueue)
        ]

        // create Dashboards and Alarms
        this.monitoring = new EventMonitoring(this, id + 'Dashboard', {
            router: this.router,
            producer: this.producer,
            consumers: this.consumers,
            deadLetterQueues: deadLetterQueues
        });
    }
}
