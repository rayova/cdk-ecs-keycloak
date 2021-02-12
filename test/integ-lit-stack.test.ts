import { SynthUtils } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import { IntegLitBiggerStack, IntegLitByolStack, IntegLitSimplestStack } from '../src/integ/integ-lit-stack';

test('simplest example', () => {
  const app = new cdk.App();
  const stack = new IntegLitSimplestStack(app, 'integ-lit-simplest');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('bigger example', () => {
  const app = new cdk.App();
  const stack = new IntegLitBiggerStack(app, 'integ-lit-bigger');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});

test('byol example', () => {
  const app = new cdk.App();
  const stack = new IntegLitByolStack(app, 'integ-lit-byol');

  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});