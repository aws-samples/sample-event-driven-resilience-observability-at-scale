import * as cdk from 'aws-cdk-lib';

import { EventRouterStack } from './event-router-stack';
import { EventProducerStack } from './event-producer-stack';
import { EventConsumerStack } from './event-consumer-stack';

const app = new cdk.App();

// create stacks in us-east-2
const usEast2StackProps: cdk.StackProps = {
    env: { account: process.env.AWS_ACCOUNT_ID, region: 'us-east-2'}
};

// there will only be one router shared between regions and accounts
const routerStack = new EventRouterStack(app, 'event-router-stack', usEast2StackProps);

// create consumers and producers in us-east-2
new EventProducerStack(app, 'event-producer-stack-cmh', routerStack.router, usEast2StackProps);
new EventConsumerStack(app, 'event-consumer-stack-cmh', usEast2StackProps);

// create stacks in us-west-2
const usWest2StackProps: cdk.StackProps = {
    env: { account: process.env.AWS_ACCOUNT_ID, region: 'us-west-2'}
};

// create consumers and producers in us-west-2
new EventProducerStack(app, 'event-producer-stack-pdx', routerStack.router, usWest2StackProps);
new EventConsumerStack(app, 'event-consumer-stack-pdx', usWest2StackProps);