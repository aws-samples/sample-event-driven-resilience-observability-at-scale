export const handler = async () => {
    // Implement your event processing code here.

    return {
        statusCode: 200,
        body: JSON.stringify({
            message: 'Hello World!'
        })
    }

}