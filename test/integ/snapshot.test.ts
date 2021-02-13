import { SynthUtils } from '@aws-cdk/assert';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import { IntegEc2Stack } from '../../src/integ/integ-ec2-stack';
import { IntegFargateStack } from '../../src/integ/integ-fargate-stack';
import { IntegKeycloakAutoScalingHttpsStack } from '../../src/integ/integ-keycloak-cluster-autoscaling-https-stack';
import { IntegKeycloakClusterBYOLStack } from '../../src/integ/integ-keycloak-cluster-byol-stack';
import { IntegKeycloakClusterNlbStack } from '../../src/integ/integ-keycloak-cluster-nlb-stack';
import { IntegKeycloakClusterSimplestStack } from '../../src/integ/integ-keycloak-cluster-simplest';

test('ec2-stack', () => {
  const app = new cdk.App();
  const stack = new IntegEc2Stack(app, 'integ-ec2', {
    databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('fargate-stack', () => {
  const app = new cdk.App();
  const stack = new IntegFargateStack(app, 'integ-fargate', {
    databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
  });

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('simplest cluster', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterSimplestStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('autoscaling https example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakAutoScalingHttpsStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('byol example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterBYOLStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('nlb example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterNlbStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});