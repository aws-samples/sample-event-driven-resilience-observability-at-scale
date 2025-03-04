import { Construct } from "constructs";
import { Archive, EventBus, Rule, RuleTargetInput } from "aws-cdk-lib/aws-events";
import { LoggingProtocol, Topic, TopicProps } from "aws-cdk-lib/aws-sns";
import { PolicyStatement, Role, ServicePrincipal } from "aws-cdk-lib/aws-iam";
import targets = require('aws-cdk-lib/aws-events-targets');
import { EventQueueConsumerEvents, EventQueueConsumerEventType } from "./eventConsumer";
import { Duration, PhysicalName, RemovalPolicy } from "aws-cdk-lib";
import { ComparisonOperator, Metric } from "aws-cdk-lib/aws-cloudwatch";
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
    bus: EventBus;
    logGroup: LogGroup;

    constructor(scope: Construct, id: string, props: EventRouterProps = {}) {
        super(scope, id);

        // create event bus with a dead letter queue
        this.bus = new EventBus(scope, 'EventChoreographer', {
            eventBusName: id + 'CustomEventBus',
            deadLetterQueue: new Queue(scope, id + 'EventChoreographerDLQ', {
                queueName: PhysicalName.GENERATE_IF_NEEDED
            })
        });

        // Archive all events for replay capability
        new Archive(this, 'EventsArchive', {
            sourceEventBus: this.bus,
            archiveName: PhysicalName.GENERATE_IF_NEEDED,
            retention: Duration.days(30),
            eventPattern: {}
        });

        // Create metrics for EventBridge
        const eventsProcessedMetric = new Metric({
            namespace: 'ApplicationEvents',
            metricName: 'EventsProcessed',
            dimensionsMap: {
                'EventSource': 'API',
                'EventType': 'Transaction'
            },
            statistic: 'Sum',
            period: Duration.minutes(1)
        })
        
        eventsProcessedMetric.createAlarm(this, 'LowEventThroughputAlarm', {
            evaluationPeriods: 3,
            // Tune this threshold based on your application
            threshold: 100,
            comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
            alarmDescription: 'Alert when event throughput drops below expected levels'
        });

        // Create CloudWatch Log Group
        this.logGroup = new LogGroup(this, 'EventRouterLogs', {
            logGroupName: `/aws/events/${id}`,
            retention: RetentionDays.ONE_MONTH,
            removalPolicy: RemovalPolicy.RETAIN
        });

        // Create a rule to log all events
        new Rule(this, 'LogAllEventsRule', {
            eventBus: this.bus,
            eventPattern: {
                // This pattern matches all events
                version: ['0']
            },
            targets: [
                new targets.CloudWatchLogGroup(this.logGroup)
            ]
        });

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

        // Add CloudWatch metrics and alarms for the topic
        const numberOfMessagesPublished = topic.metricNumberOfMessagesPublished();
        const numberOfNotificationsDelivered = topic.metricNumberOfNotificationsDelivered();
        const numberOfNotificationsFailed = topic.metricNumberOfNotificationsFailed();

        // Create alarms for failed notifications
        numberOfNotificationsFailed.createAlarm(stack, `${name}FailedNotificationsAlarm`, {
            threshold: 1,
            evaluationPeriods: 1,
            alarmDescription: 'Alert when any notifications fail to deliver',
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
        });

        // Create a rule with enhanced monitoring
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
    }
}