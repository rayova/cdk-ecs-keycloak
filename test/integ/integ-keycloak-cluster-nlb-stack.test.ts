import { SynthUtils } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { IntegKeycloakClusterNlbStack } from '../../src/integ/integ-keycloak-cluster-nlb-stack';

test('nlb example', () => {
  const app = new cdk.App();
  const stack = new IntegKeycloakClusterNlbStack(app, 'integ-lit-simplest');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
