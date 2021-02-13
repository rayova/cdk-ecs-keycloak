import { SynthUtils } from '@aws-cdk/assert';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import { IntegFargateStack } from '../../src/integ/integ-fargate-stack';

test('fargate', () => {
  const app = new cdk.App();
  const stack = new IntegFargateStack(app, 'integ-fargate', {
    databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});