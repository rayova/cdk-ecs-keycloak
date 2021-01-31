import * as ecs from '@aws-cdk/aws-ecs';
import * as logs from '@aws-cdk/aws-logs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';

export interface EnsureMysqlDatabaseExtensionProps {
  /**
   * Name of the container to add to do this work.
   * @default 'ensure-mysql-database'
   */
  readonly containerName?: string;

  /**
   * RDS credentials.
   */
  readonly databaseCredentials: secretsmanager.ISecret;

  /**
   * Database to create.
   */
  readonly databaseName: string;
}

export class EnsureMysqlDatabaseExtension implements ecs.ITaskDefinitionExtension {
  private readonly containerName: string;
  private readonly databaseCredentials: secretsmanager.ISecret;
  private readonly databaseName: string;

  constructor(props: EnsureMysqlDatabaseExtensionProps) {
    this.containerName = props.containerName ?? 'ensure-mysql-database';
    this.databaseCredentials = props.databaseCredentials;
    this.databaseName = props.databaseName;
  }

  extend(taskDefinition: ecs.TaskDefinition) {
    const queryContainer = taskDefinition.addContainer(this.containerName, {
      image: ecs.ContainerImage.fromRegistry('mysql'),
      command: [
        'sh', '-c',
        'mysql -u"$DB_USER" -p"$DB_PASSWORD" -h"$DB_ADDR" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME"',
      ],
      environment: {
        DB_NAME: this.databaseName,
        JDBC_PARAMS: 'useSSL=false',
      },
      secrets: {
        DB_ADDR: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'host'),
        DB_PORT: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'port'),
        DB_USER: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'username'),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'password'),
      },
      essential: false,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: '/cdk-ecs-keycloak',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    if (taskDefinition.defaultContainer) {
      taskDefinition.defaultContainer.addContainerDependencies({
        container: queryContainer,
        condition: ecs.ContainerDependencyCondition.COMPLETE,
      });
    }
  }
}