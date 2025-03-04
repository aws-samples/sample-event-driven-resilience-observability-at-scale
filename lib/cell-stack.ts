import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

import { EventConsumer } from './eventConsumer';
import { EventProducer } from './eventProducer';
import { EventRouter } from './eventRouter';
import { Queue } from 'aws-cdk-lib/aws-sqs';
import { EventDashboard } from './eventDashboard';
import { EventAlarms } from './eventAlarms';

export class CellStack extends cdk.Stack {
    router: EventRouter;
    producer: EventProducer;
    consumers: EventConsumer[] = [];
    dashboard: EventDashboard;
    alarms: EventAlarms;

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
            target.topic.addSubscription(new SqsSubscription(consumer.queue, {
                deadLetterQueue: new Queue(this, consumer.node.id + consumer.type + 'DeadLetterQueue')
            }));
        });

        // create Dashboards and Alarms
        this.dashboard = new EventDashboard(this, id + 'Dashboard');
        this.alarms = new EventAlarms(this, id + 'Alarms');
    }
}
