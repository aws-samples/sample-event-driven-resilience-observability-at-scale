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

        // Check if database and table names are properly set
        if (!DATABASE_NAME || !TABLE_NAME) {
            const error = new Error('Timestream database name or table name not set in environment variables');
            console.error(error);
            throw error;
        }

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

        // Create a single multi-measure record
        const multiMeasureRecord = {
            Dimensions: dimensions,
            Time: timestamp.toString(),
            TimeUnit: 'MILLISECONDS',
            MeasureName: 'invoice_metrics', // Common name for the group of measures
            MeasureValues: [
                { Name: 'invoiceAmount', Value: detail.invoiceAmount.toString(), Type: 'DOUBLE' },
                { Name: 'ppv', Value: detail.ppv.toString(), Type: 'DOUBLE' },
                { Name: 'pqv', Value: detail.pqv.toString(), Type: 'DOUBLE' },
                { Name: 'matchedAmount', Value: detail.matchedAmount.toString(), Type: 'DOUBLE' },
                { Name: 'authorizedAmount', Value: detail.authorizedAmount.toString(), Type: 'DOUBLE' },
                { Name: 'invoiceDate', Value: detail.invoiceDate, Type: 'VARCHAR' },
                { Name: 'invoiceDueDate', Value: detail.invoiceDueDate, Type: 'VARCHAR' }
            ],
            MeasureValueType: 'MULTI'
        };

        // Create the write request parameters with the single multi-measure record
        const params = {
            DatabaseName: DATABASE_NAME,
            TableName: TABLE_NAME,
            Records: [multiMeasureRecord]
        };

        // Write record to Timestream with improved error handling
        try {
            const result = await timestream.send(new WriteRecordsCommand(params));
            console.log('Write record successful:', result);
        } catch (timestreamError: any) {
            console.error('Timestream write error:', {
                message: timestreamError.message,
                code: timestreamError.code,
                statusCode: timestreamError['\$metadata']?.httpStatusCode,
                requestId: timestreamError['\$metadata']?.requestId
            });
            
            // Log specific error types for better debugging
            if (timestreamError.name === 'RejectedRecordsException') {
                console.error('Record was rejected:', timestreamError.RejectedRecords);
            } else if (timestreamError.name === 'ThrottlingException') {
                console.error('Request was throttled by Timestream');
            } else if (timestreamError.name === 'ValidationException') {
                console.error('Validation error - check your record format and dimensions');
            } else if (timestreamError.name === 'ResourceNotFoundException') {
                console.error('Database or table not found - check your configuration');
            }
            
            throw new Error(`Failed to write to Timestream: \${timestreamError.message}`);
        }
    } catch (error) {
        console.error('Error processing record:', error);
        // You can choose to rethrow the error to have the message return to the queue
        // or handle it differently based on your requirements
        throw error;
    }
}