import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EventRouter } from './eventRouter';
import { EventProducer } from './eventProducer';
import { EventConsumer } from './eventConsumer';
import { Alarm, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Queue } from 'aws-cdk-lib/aws-sqs';

export interface EventMonitoringProps {
  router: EventRouter;
  producer: EventProducer;
  consumers: EventConsumer[];
  deadLetterQueues: Queue[];
}

export class EventMonitoring extends Construct {
  // Public properties
  public readonly dashboardName: string;

  constructor(scope: Construct, id: string, props?: EventMonitoringProps) {
    super(scope, id);

    // Create alarms on API Gateway
    props?.producer.api.metricClientError().createAlarm(scope, 'HighClientErrorAlarm', {
      evaluationPeriods: 3,
      threshold: 20,
      alarmDescription: 'Alert when client error rate exceeds 20%'
    });

    props?.producer.api.metricServerError().createAlarm(scope, 'HighServerErrorAlarm', {
      evaluationPeriods: 3,
      threshold: 1,
      alarmDescription: 'Alert when server error rate exceeds 1%'
    });

    props?.producer.api.metricLatency().createAlarm(scope, 'HighLatencyAlarm', {
      evaluationPeriods: 3,
      threshold: 1000,
      alarmDescription: 'Alert when latency exceeds 1 second'
    });

    // Create metrics on EventBridge Bus
    const busInvocations = new Metric({
      namespace: 'AWS/Events',
      metricName: 'Invocations',
      dimensionsMap: {
        EventBusName: props?.router.bus.eventBusName!
      },
      period: cdk.Duration.minutes(5),
      statistic: 'Sum'
    });

    const busFailedInvocations = new Metric({
      namespace: 'AWS/Events',
      metricName: 'FailedInvocations',
      dimensionsMap: {
        EventBusName: props?.router.bus.eventBusName!
      },
      period: cdk.Duration.minutes(5),
      statistic: 'Sum'
    });

    // Create alarms on EventBridge Bus
    new Alarm(this, 'EventBusFailedInvocationsAlarm', {
      metric: busFailedInvocations,
      threshold: 1,
      evaluationPeriods: 3,
      datapointsToAlarm: 2,
      alarmDescription: 'Alert when EventBridge bus has failed invocations',
      treatMissingData: TreatMissingData.NOT_BREACHING
    });

    // For each rule, create metrics and alarms
    props?.router.rules?.forEach((rule, index) => {
      const ruleInvocations = new Metric({
        namespace: 'AWS/Events',
        metricName: 'Invocations',
        dimensionsMap: {
          RuleName: rule.ruleName
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      });

      const ruleFailedInvocations = new Metric({
        namespace: 'AWS/Events',
        metricName: 'FailedInvocations',
        dimensionsMap: {
          RuleName: rule.ruleName
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      });

      const ruleThrottledRules = new Metric({
        namespace: 'AWS/Events',
        metricName: 'ThrottledRules',
        dimensionsMap: {
          RuleName: rule.ruleName
        },
        period: cdk.Duration.minutes(5),
        statistic: 'Sum'
      });

      // Rule Failed Invocations Alarm
      new Alarm(this, `RuleFailedInvocationsAlarm-${index}`, {
        metric: ruleFailedInvocations,
        threshold: 1,
        evaluationPeriods: 2,
        datapointsToAlarm: 2,
        alarmDescription: `Alert when EventBridge rule ${rule.ruleName} has failed invocations`,
        treatMissingData: TreatMissingData.NOT_BREACHING
      });

      // Rule Throttled Events Alarm
      new Alarm(this, `RuleThrottledEventsAlarm-${index}`, {
        metric: ruleThrottledRules,
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `Alert when EventBridge rule ${rule.ruleName} is being throttled`,
        treatMissingData: TreatMissingData.NOT_BREACHING
      });
    });

    // Create alarms for SNS topics
    props?.router.topics?.forEach((topic, index) => {
      const topicNumberOfNotificationsFailed = topic.metricNumberOfNotificationsFailed();

      new Alarm(this, `TopicFailedNotificationsAlarm-${index}`, {
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `Alert when any notifications fail to deliver for topic ${topic.topicName}`,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        metric: topicNumberOfNotificationsFailed
      });
    });

    // Create alarms for Consumer SQS queues
    props?.consumers?.forEach((consumer, index) => {
      const queueApproximateNumberOfMessagesVisible = consumer.queue.metricApproximateNumberOfMessagesVisible();

      new Alarm(this, `QueueApproximateNumberOfMessagesVisibleAlarm-${index}`, {
        threshold: 100,
        evaluationPeriods: 1,
        alarmDescription: `Alert when the approximate number of messages visible in the queue ${consumer.queue.queueName} exceeds 100`,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        metric: queueApproximateNumberOfMessagesVisible
      });

      const queueApproximateAgeOfOldestMessage = consumer.queue.metricApproximateAgeOfOldestMessage();
      new Alarm(this, `QueueApproximateAgeOfOldestMessageAlarm-${index}`, {
        threshold: 900,
        evaluationPeriods: 1,
        alarmDescription: `Alert when the approximate age of the oldest message in the queue ${consumer.queue.queueName} exceeds 900 seconds`,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        metric: queueApproximateAgeOfOldestMessage
      });
    });

    // Create alarms on Dead Letter Queues
    props?.deadLetterQueues.forEach((queue, index) => {
      const queueApproximateNumberOfMessagesVisible = queue.metricApproximateNumberOfMessagesVisible();

      new Alarm(this, `DeadLetterQueueApproximateNumberOfMessagesVisibleAlarm-${index}`, {
        threshold: 1,
        evaluationPeriods: 1,
        alarmDescription: `Alert when the approximate number of messages visible in the dead letter queue ${queue.queueName} exceeds 1`,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        metric: queueApproximateNumberOfMessagesVisible
      });

      // make an alarm on the age of the oldest message > 1 day
      const queueApproximateAgeOfOldestMessage = queue.metricApproximateAgeOfOldestMessage();
      new Alarm(this, `DeadLetterQueueApproximateAgeOfOldestMessageAlarm-${index}`, {
        threshold: 86400,
        evaluationPeriods: 1,
        alarmDescription: `Alert when the approximate age of the oldest message in the dead letter queue ${queue.queueName} exceeds 1 day`,
        comparisonOperator: cdk.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        metric: queueApproximateAgeOfOldestMessage
      });
    });
  }
}