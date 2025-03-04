import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventRouter } from './eventRouter';
import { EventProducer } from './eventProducer';
import { EventConsumer } from './eventConsumer';

export interface EventMonitoringProps {
  router: EventRouter;
  producer: EventProducer;
  consumers: EventConsumer[];
}

export class EventMonitoring extends Construct {
  // Public properties
  public readonly dashboardName: string;

  constructor(scope: Construct, id: string, props?: EventMonitoringProps) {
    super(scope, id);

    // Initialize your construct logic here
  }

  // Add any helper methods here
}