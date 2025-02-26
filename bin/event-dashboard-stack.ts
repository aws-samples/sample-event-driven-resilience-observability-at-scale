import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventDashboardDataSource } from '../lib/eventDashboardDataSource';

export class EventDashboardStack extends cdk.Stack {
  source: EventDashboardDataSource;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // create a consumer for all types of event
    this.source = new EventDashboardDataSource(this, 'EventDashboardDataSource', { type: 'ALL' });
  }
}