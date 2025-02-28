import * as cdk from 'aws-cdk-lib';
import { CellStack } from '../lib/cell-stack';

const app = new cdk.App();

// create independent cells in multiple regions
new CellStack(app, 'CellStackA', {
    env: {
        region: 'us-west-2'
    }
});

new CellStack(app, 'CellStackB', {
    env: {
        region: 'us-west-1'
    }
});

new CellStack(app, 'CellStackC', {
    env: {
        region: 'us-east-2'
    }
});

new CellStack(app, 'CellStackD', {
    env: {
        region: 'us-east-1'
    }
});