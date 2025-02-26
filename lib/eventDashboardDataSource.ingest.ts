const { TimestreamWrite, WriteRecordsCommand } = require('@aws-sdk/client-timestream-write');

// Configure Timestream client
const timestream = new TimestreamWrite({ region: process.env.AWS_REGION });

// Define environment variables (set these in your Lambda configuration)
const DATABASE_NAME = process.env.TIMESTREAM_DATABASE_NAME || '';
const TABLE_NAME = process.env.TIMESTREAM_TABLE_NAME || '';

/**
 * Lambda handler for processing SQS events
 */
exports.handler = async (event: any) => {
    try {
        console.log(`Processing \${event.Records.length} SQS messages`);
        console.log('Received event:', JSON.stringify(event, null, 2));

        for (const record of event.Records) {
            await processRecord(record);
        }

        console.log('Successfully processed all records');
    } catch (error) {
        console.error('Error processing SQS messages:', error);
        throw error;
    }
};

/**
 * Process a single SQS record
 * @param {Object} record - SQS record
 */
async function processRecord(record: any) {
    try {
        // Parse the SQS message body
        const payload = JSON.parse(record.body);
        const sqsRecords = Array.isArray(payload) ? payload : [payload];
        console.log('Received records:', sqsRecords);

        // Parse the SNS message body
        const event = JSON.parse(sqsRecords[0].Message);
        console.log('Received event:', event);


        // Extract the time from the event
        const timestamp = new Date(event.time).getTime();

        // Extract detail data
        const detail = event.detail;

        // Create dimensions that identify the record
        const dimensions = [
            { Name: 'invoiceId', Value: detail.invoiceId.toString() },
            { Name: 'payeeCode', Value: detail.payeeCode },
            { Name: 'legalEntityId', Value: detail.legalEntityId.toString() },
            { Name: 'source', Value: event.source },
            { Name: 'detailType', Value: event['detail-type'] },
            { Name: 'region', Value: event.region },
            { Name: 'account', Value: event.account }
        ];

        // Create the measures as record values
        const records = [
            {
                Dimensions: dimensions,
                MeasureName: 'invoiceAmount',
                MeasureValue: detail.invoiceAmount.toString(),
                MeasureValueType: 'DOUBLE',
                Time: timestamp.toString(),
                TimeUnit: 'MILLISECONDS'
            },
            {
                Dimensions: dimensions,
                MeasureName: 'ppv',
                MeasureValue: detail.ppv.toString(),
                MeasureValueType: 'DOUBLE',
                Time: timestamp.toString(),
                TimeUnit: 'MILLISECONDS'
            },
            {
                Dimensions: dimensions,
                MeasureName: 'pqv',
                MeasureValue: detail.pqv.toString(),
                MeasureValueType: 'DOUBLE',
                Time: timestamp.toString(),
                TimeUnit: 'MILLISECONDS'
            },
            {
                Dimensions: dimensions,
                MeasureName: 'matchedAmount',
                MeasureValue: detail.matchedAmount.toString(),
                MeasureValueType: 'DOUBLE',
                Time: timestamp.toString(),
                TimeUnit: 'MILLISECONDS'
            },
            {
                Dimensions: dimensions,
                MeasureName: 'authorizedAmount',
                MeasureValue: detail.authorizedAmount.toString(),
                MeasureValueType: 'DOUBLE',
                Time: timestamp.toString(),
                TimeUnit: 'MILLISECONDS'
            },
            {
                Dimensions: dimensions,
                MeasureName: 'invoiceDate',
                MeasureValue: detail.invoiceDate,
                MeasureValueType: 'VARCHAR',
                Time: timestamp.toString(),
                TimeUnit: 'MILLISECONDS'
            },
            {
                Dimensions: dimensions,
                MeasureName: 'invoiceDueDate',
                MeasureValue: detail.invoiceDueDate,
                MeasureValueType: 'VARCHAR',
                Time: timestamp.toString(),
                TimeUnit: 'MILLISECONDS'
            }
        ];

        // Create the write request parameters
        const params = {
            DatabaseName: DATABASE_NAME,
            TableName: TABLE_NAME,
            Records: records
        };

        // Write records to Timestream
        timestream.send(new WriteRecordsCommand(params)).then((result: any) => console.log('Write records successful:', result))
    } catch (error) {
        console.error('Error processing record:', error);
        // You can choose to rethrow the error to have the message return to the queue
        // or handle it differently based on your requirements
        throw error;
    }
}