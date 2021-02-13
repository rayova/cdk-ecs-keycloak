import { SynthUtils } from '@aws-cdk/assert';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import { IntegEc2Stack } from '../../src/integ/integ-ec2-stack';

test('fargate', () => {
  const app = new cdk.App();
  const stack = new IntegEc2Stack(app, 'integ-ec2', {
    databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});