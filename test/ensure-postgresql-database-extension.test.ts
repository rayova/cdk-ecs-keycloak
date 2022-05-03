import * as cdk from 'aws-cdk-lib';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { EnsurePostgresqlDatabaseExtension } from '../src';

describe('ensure postgresql database extension', () => {
  test('adds a non-essential container', () => {
    const stack = new cdk.Stack();
    const task = new ecs.FargateTaskDefinition(stack, 'TaskDefinition');
    const addContainerSpy = jest.spyOn(task, 'addContainer');
    const secret = new secretsmanager.Secret(stack, 'DbSecret');

    task.addExtension(new EnsurePostgresqlDatabaseExtension({
      databaseCredentials: secret,
      databaseName: 'foo',
    }));

    expect(addContainerSpy).toBeCalledWith('ensure-postgresql-database', expect.objectContaining({
      command: [
        'sh', '-c',
        'echo "SELECT \'CREATE DATABASE $DB_NAME\' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = \'$DB_NAME\')\\gexec" | psql',
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

    task.addExtension(new EnsurePostgresqlDatabaseExtension({
      databaseCredentials: secret,
      databaseName: 'foo',
    }));

    expect(task.defaultContainer!.containerDependencies.length).toBeGreaterThan(0);
  });
});