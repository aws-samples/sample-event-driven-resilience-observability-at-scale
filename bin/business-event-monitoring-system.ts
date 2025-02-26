import * as cdk from 'aws-cdk-lib';

import { EventRouterStack } from './event-router-stack';
import { EventProducerStack } from './event-producer-stack';
import { EventConsumerStack } from './event-consumer-stack';

const app = new cdk.App();

const usEast2StackProps: cdk.StackProps = {
    env: { account: '619071328044', region: 'us-east-2'}
};

// us-east-2
const usEast2RouterStack = new EventRouterStack(app, 'event-router-stack', usEast2StackProps);
new EventProducerStack(app, 'event-producer-stack', usEast2RouterStack.router, usEast2StackProps);
new EventConsumerStack(app, 'event-consumer-stack', usEast2StackProps);