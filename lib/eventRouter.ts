import { Construct } from "constructs";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { Topic, TopicProps } from "aws-cdk-lib/aws-sns";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import { Stack } from "aws-cdk-lib";

export type EventRouterProps = {

}

export class EventRouter extends Construct {
    targets: Topic[] = [];
    rules: Rule[] = [];
    bus: EventBus;

    constructor(scope: Construct, id: string, props: EventRouterProps = {}) {
        super(scope, id);

        this.bus = new EventBus(scope, 'event-choreographer', {
            eventBusName: 'event-choreographer'
        });
    }

    addRoutingTarget(stack: Stack, name: string, props: TopicProps) {
        const routingTarget = new Topic(stack, name + 'Topic', props);
        const rule = new Rule(stack, name + 'Rule', {
            targets: [routingTarget.bindAsNotificationRuleTarget],
            eventBus: this.bus
        });

        routingTarget.grantPublish(new ServicePrincipal('events.amazonaws.com'));

        this.targets.push(routingTarget);
        this.rules.push(rule);
    }
}