import { SynthUtils } from '@aws-cdk/assert';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import { IntegEc2Stack } from '../../src/integ/integ-ec2-stack';
import { IntegFargateStack } from '../../src/integ/integ-fargate-stack';
import { IntegKeycloakAutoScalingHttpsStack } from '../../src/integ/integ-keycloak-cluster-autoscaling-https-stack';
import { IntegKeycloakClusterBYOStack } from '../../src/integ/integ-keycloak-cluster-byo-stack';
import { IntegKeycloakClusterCustomContainerStack } from '../../src/integ/integ-keycloak-cluster-custom-container-stack';
import { IntegKeycloakClusterDbInstanceStack } from '../../src/integ/integ-keycloak-cluster-db-instance-stack';
import { IntegKeycloakClusterNlbStack } from '../../src/integ/integ-keycloak-cluster-nlb-stack';
import { IntegKeycloakClusterPostgresStack } from '../../src/integ/integ-keycloak-cluster-postgres-stack';
import { IntegKeycloakClusterSimplestStack } from '../../src/integ/integ-keycloak-cluster-simplest-stack';

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

test('nlb example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterNlbStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('custom container example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterCustomContainerStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('db instance example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterDbInstanceStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('postgresql example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterPostgresStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('byo example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterBYOStack(app);

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
