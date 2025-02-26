import { aws_quicksight, aws_timestream, lambda_layer_awscli, PhysicalName } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import { EventConsumer } from "./eventConsumer";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export type EventDashboardProps = {

}

export class EventDashboardDataSource extends EventConsumer {
    constructor(scope: Construct, id: string, props: EventDashboardProps) {
        super(scope, id);

        const db = new aws_timestream.CfnDatabase(scope, 'EventDatabase', {
            databaseName: 'BEMSEventDatabase'
        });
        
        const table = new aws_timestream.CfnTable(scope, 'EventDashboardTable', {
            databaseName: db.databaseName!,
            tableName: 'BEMSEventTable'
        }).addDependency(db)

        const lambda = new NodejsFunction(scope, 'ingest');
        lambda.addEnvironment('TIMESTREAM_DATABASE_NAME', db.databaseName!);
        lambda.addEnvironment('TIMESTREAM_TABLE_NAME', 'BEMSEventTable');

        lambda.addEventSource(new SqsEventSource(this.queue));

        // quicksight does not provide L2 CDK constructs - recommend creating and managing it another way
    }
}