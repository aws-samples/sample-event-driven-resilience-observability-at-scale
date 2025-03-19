# Event Driven Resilience Code Sample

This is a code sample demonstrating a serverless event-driven architecture enabling engineering teams to process millions of daily events with near real-time visibility and strong resilience.

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
cdk bootstrap 123456789012/us-east-2 123456789012/us-east-1 123456789012/us-west-2 123456789012/us-west-1
```

Now you're ready to deploy! Check out **Useful commands* below.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `npx cdk deploy --all`  deploy this stack to your default AWS account/region
* `npx cdk diff`    compare deployed stack with current state
* `npx cdk synth`   emits the synthesized CloudFormation template

## Contributing

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## Security

See [CONTRIBUTING](CONTRIBUTING.md#security-issue-notifications) for more information.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

## Author

This sample was developed by [Grey Newell](mailto:greyshipscode@gmail.com), a Senior Solutions Architect at AWS.

Connect with Grey on [GitHub](https://github.com/greynewell), [X](https://x.com/greynewell) or [LinkedIn](https://www.linkedin.com/in/greynewell/).