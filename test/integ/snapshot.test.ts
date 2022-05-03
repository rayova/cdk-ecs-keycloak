import { Template } from 'aws-cdk-lib/assertions';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cdk from 'aws-cdk-lib/core';
import { IntegEc2Stack } from '../../src/integ/integ-ec2-stack';
import { IntegFargateStack } from '../../src/integ/integ-fargate-stack';
import { IntegKeycloakAutoScalingHttpsStack } from '../../src/integ/integ-keycloak-cluster-autoscaling-https-stack';
import { IntegKeycloakClusterBYOStack } from '../../src/integ/integ-keycloak-cluster-byo-stack';
import { IntegKeycloakClusterCustomContainerStack } from '../../src/integ/integ-keycloak-cluster-custom-container-stack';
import { IntegKeycloakClusterDbInstanceStack } from '../../src/integ/integ-keycloak-cluster-db-instance-stack';
import { IntegKeycloakClusterNlbStack } from '../../src/integ/integ-keycloak-cluster-nlb-stack';
import { IntegKeycloakClusterPostgresStack } from '../../src/integ/integ-keycloak-cluster-postgres-stack';
import { IntegKeycloakClusterSimplestStack } from '../../src/integ/integ-keycloak-cluster-simplest-stack';
import { IntegKeycloakClusterSpotStack } from '../../src/integ/integ-keycloak-cluster-spot-stack';

test('ec2-stack', () => {
  const app = new cdk.App();
  const stack = new IntegEc2Stack(app, 'integ-ec2', {
    databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
  });

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('fargate-stack', () => {
  const app = new cdk.App();
  const stack = new IntegFargateStack(app, 'integ-fargate', {
    databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
  });

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('simplest cluster', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterSimplestStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('autoscaling https example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakAutoScalingHttpsStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('nlb example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterNlbStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('custom container example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterCustomContainerStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('db instance example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterDbInstanceStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('postgresql example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterPostgresStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('byo example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterBYOStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});

test('fargate spot example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterSpotStack(app);

  expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
});
