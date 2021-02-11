import * as ecs from '@aws-cdk/aws-ecs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';
import { EnsureMysqlDatabaseExtension } from '../src';

describe('ensure mysql database extension', () => {
  test('adds a non-essential container', () => {
    const stack = new cdk.Stack();
    const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');
    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const secret = new secretsmanager.Secret(stack, 'DbSecret');

    task.addExtension(new EnsureMysqlDatabaseExtension({
      databaseCredentials: secret,
      databaseName: 'foo',
    }));

    expect(addContainerSpy).toBeCalledWith('ensure-mysql-database', expect.objectContaining({
      command: [
        'sh', '-c',
        'mysql -u"$DB_USER" -p"$DB_PASSWORD" -h"$DB_ADDR" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME"',
      ],
      essential: false,
    }));
  });

  test('makes the default container depend on the password container', () => {
    const stack = new cdk.Stack();
    const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');
    const secret = new secretsmanager.Secret(stack, 'DbSecret');

    task.addContainer('main', {
      image: ecs.ContainerImage.fromRegistry('nginx'),
    });

    task.addExtension(new EnsureMysqlDatabaseExtension({
      databaseCredentials: secret,
      databaseName: 'foo',
    }));

    expect(task.defaultContainer!.containerDependencies.length).toBeGreaterThan(0);
  });
});