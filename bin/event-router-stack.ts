import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventRouter } from '../lib/eventRouter';

export class EventRouterStack extends cdk.Stack {
  router: EventRouter;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    this.router = new EventRouter(this, id + 'Router');
  }
}
