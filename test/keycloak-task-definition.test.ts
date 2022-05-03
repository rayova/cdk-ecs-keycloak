import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { KeycloakDatabaseVendor, KeycloakEc2TaskDefinition, KeycloakFargateTaskDefinition } from '../src';

describe('keycloak ec2 task definition', () => {
  test('adds the keycloak extension', () => {
    const taskDefinition = new KeycloakEc2TaskDefinition(new cdk.Stack(), 'TaskDefinition');
    expect(taskDefinition.keycloakContainerExtension).toBeDefined();
    expect(taskDefinition.networkMode).toEqual(ecs.NetworkMode.AWS_VPC);
    expect(taskDefinition.defaultContainer?.containerName).toEqual(taskDefinition.keycloakContainerExtension.containerName);
  });

  test('uses VPC network mode by default', () => {
    const taskDefinition = new KeycloakEc2TaskDefinition(new cdk.Stack(), 'TaskDefinition');
    expect(taskDefinition.networkMode).toEqual(ecs.NetworkMode.AWS_VPC);
  });

  test('passes keycloak config to the container extension', () => {
    const taskDefinition = new KeycloakEc2TaskDefinition(new cdk.Stack(), 'TaskDefinition', {
      keycloak: {
        containerName: 'foobar',
      },
    });
    expect(taskDefinition.defaultContainer?.containerName).toEqual('foobar');
  });

  test('throws when network mode is something other than vpc', () => {
    expect(() => {
      new KeycloakEc2TaskDefinition(new cdk.Stack(), 'TaskDefinition', {
        networkMode: ecs.NetworkMode.BRIDGE,
      });
    }).toThrow(/networking mode/i);
  });

  test('adds ensure mysql database when mysql database vendor is selected', () => {
    const stack = new cdk.Stack();
    const secret = new secretsmanager.Secret(stack, 'Secret');
    const taskDefinition = new KeycloakEc2TaskDefinition(stack, 'TaskDefinition', {
      keycloak: {
        containerName: 'foobar',
        databaseVendor: KeycloakDatabaseVendor.MYSQL,
        databaseCredentials: secret,
      },
    });
    expect(taskDefinition.defaultContainer?.containerDependencies.some(d => d.container.containerName === 'ensure-mysql-database')).toBeTruthy();
  });
});

describe('keycloak fargate task definition', () => {
  test('adds the keycloak extension', () => {
    const taskDefinition = new KeycloakFargateTaskDefinition(new cdk.Stack(), 'TaskDefinition');
    expect(taskDefinition.keycloakContainerExtension).toBeDefined();
    expect(taskDefinition.networkMode).toEqual(ecs.NetworkMode.AWS_VPC);
    expect(taskDefinition.defaultContainer?.containerName).toEqual(taskDefinition.keycloakContainerExtension.containerName);
  });

  test('passes keycloak config to the container extension', () => {
    const taskDefinition = new KeycloakEc2TaskDefinition(new cdk.Stack(), 'TaskDefinition', {
      keycloak: {
        containerName: 'foobar',
      },
    });
    expect(taskDefinition.defaultContainer?.containerName).toEqual('foobar');
  });

  test('adds ensure mysql database when mysql database vendor is selected', () => {
    const stack = new cdk.Stack();
    const secret = new secretsmanager.Secret(stack, 'Secret');
    const taskDefinition = new KeycloakFargateTaskDefinition(stack, 'TaskDefinition', {
      keycloak: {
        containerName: 'foobar',
        databaseVendor: KeycloakDatabaseVendor.MYSQL,
        databaseCredentials: secret,
      },
    });
    expect(taskDefinition.defaultContainer?.containerDependencies.some(d => d.container.containerName === 'ensure-mysql-database')).toBeTruthy();
  });
});
