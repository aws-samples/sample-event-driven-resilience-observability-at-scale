import { Construct } from "constructs";
import { Archive, EventBus, Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { LoggingProtocol, Topic, TopicProps } from "aws-cdk-lib/aws-sns";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import targets = require('aws-cdk-lib/aws-events-targets');
import { EventQueueConsumerEvents, EventQueueConsumerEventType } from "./eventConsumer";
import { Duration, PhysicalName, RemovalPolicy } from "aws-cdk-lib";
import { LogGroup, RetentionDays } from "aws-cdk-lib/aws-logs";
import { Queue } from "aws-cdk-lib/aws-sqs";

export type EventRouterProps = {

}

export type EventRouterTarget = {
    topic: Topic;
    type: EventQueueConsumerEventType;
    rule: Rule;
}

export class EventRouter extends Construct {
    targets: EventRouterTarget[] = [];
    rules: Rule[] = [];
    topics: Topic[] = [];
    bus: EventBus;
    logGroup: LogGroup;
    deadLetterQueue: Queue;

    constructor(scope: Construct, id: string, props: EventRouterProps = {}) {
        super(scope, id);

        const deadLetterQueue = new Queue(scope, id + 'EventChoreographerDLQ', {
            queueName: PhysicalName.GENERATE_IF_NEEDED
        });

        // create event bus with a dead letter queue
        this.bus = new EventBus(scope, 'EventChoreographer', {
            eventBusName: id + 'CustomEventBus',
            deadLetterQueue: deadLetterQueue
        });

        this.deadLetterQueue = deadLetterQueue;

        // Archive all events for replay capability
        new Archive(this, 'EventsArchive', {
            sourceEventBus: this.bus,
            archiveName: PhysicalName.GENERATE_IF_NEEDED,
            retention: Duration.days(30),
            eventPattern: {}
        });

        // Create CloudWatch Log Group
        this.logGroup = new LogGroup(this, 'EventRouterLogs', {
            logGroupName: `/aws/events/${id}`,
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.RETAIN
        });

        // Create a rule to log all events
        const allEventsRule = new Rule(this, 'LogAllEventsRule', {
            eventBus: this.bus,
            eventPattern: {
                // This pattern matches all events
                version: ['0']
            },
            targets: [
                new targets.CloudWatchLogGroup(this.logGroup)
            ]
        });

        this.rules.push(allEventsRule);

        EventQueueConsumerEvents.forEach((event) => {
            this.addRoutingTarget(scope, id + 'event-choreographer-subscription' + event, event, {
                topicName: PhysicalName.GENERATE_IF_NEEDED
            });
        })
    }

    // call this method to add an sns topic as a routing target
    addRoutingTarget(stack: Construct, name: string, type: EventQueueConsumerEventType, props?: TopicProps) {
        // create the necessary IAM roles for delivery status logging
        const successFeedbackRole = new Role(stack, `${name}SuccessFeedbackRole`, {
            assumedBy: new ServicePrincipal('sns.amazonaws.com'),
        });

        successFeedbackRole.addToPolicy(new PolicyStatement({
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            resources: ['*'], // You might want to restrict this to specific log groups
        }));

        const failureFeedbackRole = new Role(stack, `${name}FailureFeedbackRole`, {
            assumedBy: new ServicePrincipal('sns.amazonaws.com'),
        });

        failureFeedbackRole.addToPolicy(new PolicyStatement({
            actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
            resources: ['*'], // You might want to restrict this to specific log groups
        }));

        // Create the SNS topic
        const topic = new Topic(stack, name + 'Topic', {
            ...props,
            loggingConfigs: [{
                protocol: LoggingProtocol.SQS,
                successFeedbackRole: successFeedbackRole,
                failureFeedbackRole: failureFeedbackRole,
                successFeedbackSampleRate: 100, // Percentage of successful deliveries to log (0-100)
            }],
        });

        // Create a rule with enhanced delivery
        const rule = new Rule(stack, name + 'Rule', {
            targets: [new targets.SnsTopic(topic, {
                // Add retry policy
                retryAttempts: 3,
                // Set maximum event age
                maxEventAge: Duration.hours(2),
                // Customize the message if needed
                message: RuleTargetInput.fromEventPath('$.detail')
            })],
            eventBus: this.bus,
            eventPattern: {
                detailType: ['BusinessEvent'],
                source: ['/' + type]
            }
        });

        topic.grantPublish(new ServicePrincipal('events.amazonaws.com'));

        this.targets.push({ topic, type, rule });
        this.topics.push(topic);
        this.rules.push(rule);
    }
}