# BusinessEventMonitoringSystemPOC

This is a proof-of-concept for a Business Event Monitoring System (BEMS) using the AWS CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Requirements
First, make sure your AWS credentials are properly configured for your environment.

```
aws configure
```

Second, you'll want to set the environment variable `AWS_ACCOUNT_ID` to your AWS Account ID.
```
export AWS_ACCOUNT_ID='123456789012'
```

Finally, before you can deploy this stack, remember to bootstrap the CDK in every deployment region in the target account.

```
cdk bootstrap 123456789012/us-east-2
cdk bootstrap 123456789012/us-west-2
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy --all`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template
