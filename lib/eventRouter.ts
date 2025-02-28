import { Construct } from "constructs";
import { EventBus, Rule } from "aws-cdk-lib/aws-events";
import { Topic, TopicProps } from "aws-cdk-lib/aws-sns";
import { ServicePrincipal } from "aws-cdk-lib/aws-iam";
import targets = require('aws-cdk-lib/aws-events-targets');
import { EventQueueConsumerEvents, EventQueueConsumerEventType } from "./eventConsumer";
import { PhysicalName } from "aws-cdk-lib";

export type EventRouterProps = {

}

export type EventRouterTarget = {
    topic: Topic;
    type: EventQueueConsumerEventType;
    rule: Rule;
}

export class EventRouter extends Construct {
    targets: EventRouterTarget[] = [];
    bus: EventBus;

    constructor(scope: Construct, id: string, props: EventRouterProps = {}) {
        super(scope, id);

        // create event bus
        this.bus = new EventBus(scope, 'event-choreographer', {
            eventBusName: PhysicalName.GENERATE_IF_NEEDED
        });

        EventQueueConsumerEvents.forEach((event) => {
            this.addRoutingTarget(scope, id + 'event-choreographer-subscription' + event, event, {
                topicName: PhysicalName.GENERATE_IF_NEEDED
            });
        })
    }

    // call this method to add an sns topic as a routing target
    addRoutingTarget(stack: Construct, name: string, type: EventQueueConsumerEventType, props?: TopicProps) {
        const topic = new Topic(stack, name + 'Topic', props);
        const rule = new Rule(stack, name + 'Rule', {
            targets: [new targets.SnsTopic(topic)],
            eventBus: this.bus,
            eventPattern: {
                detailType: ['Invoice'],
                source: ['/' + type]
            }
        });

        topic.grantPublish(new ServicePrincipal('events.amazonaws.com'));

        this.targets.push({topic, type, rule});
    }
}