import { aws_quicksight, aws_timestream, lambda_layer_awscli, PhysicalName } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { EventConsumer } from "./eventConsumer";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export type EventDashboardProps = {

}

export class EventDashboard extends EventConsumer {
    constructor(scope: Construct, id: string, props: EventDashboardProps) {
        super(scope, id);

        const db = new aws_timestream.CfnDatabase(scope, 'EventDatabase', {
            databaseName: 'BEMSEventDatabase'
        });
        
        const table = new aws_timestream.CfnTable(scope, 'EventDashboardTable', {
            databaseName: db.databaseName!
        })

        const lambda = new NodejsFunction(scope, 'ingest');

        lambda.addEventSource(new SqsEventSource(this.queue));

        const dashboard = new aws_quicksight.CfnDashboard(scope, 'EventDashboard', {
            awsAccountId: process.env.AWS_ACCOUNT_ID!,
            name: 'InvoiceBusinessEventMonitoringSystem',
            dashboardId: PhysicalName.GENERATE_IF_NEEDED
        })

        dashboard.add
    }
}