import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventConsumer } from '../lib/eventConsumer';

export class EventConsumerStack extends cdk.Stack {
  consumers: EventConsumer[] = [];

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create a consumer for every type of event
    this.consumers.push(new EventConsumer(this, 'IngestionConsumer', { type: 'ingestion' }));
    this.consumers.push(new EventConsumer(this, 'ReconciliationConsumer', { type: 'reconciliation' }));
    this.consumers.push(new EventConsumer(this, 'AuthorizationConsumer', { type: 'authorization' }));
    this.consumers.push(new EventConsumer(this, 'PostingConsumer', { type: 'posting' }));
  }
}
