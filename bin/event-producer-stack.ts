import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventRouter } from '../lib/eventRouter';
import { EventProducer } from '../lib/eventProducer';

export class EventProducerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, router: EventRouter, props?: cdk.StackProps) {
    super(scope, id, props);

    new EventProducer(this, id + 'Invoice', {
      router: router
    })
  }
}
