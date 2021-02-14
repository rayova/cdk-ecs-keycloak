import * as ecs from '@aws-cdk/aws-ecs';
import * as logs from '@aws-cdk/aws-logs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';

/**
 * Props for EnsurePostgresqlDatabaseExtension
 */
export interface EnsurePostgresqlDatabaseExtensionProps {
  /**
   * Name of the container to add to do this work.
   * @default 'ensure-postgresql-database'
   */
  readonly containerName?: string;

  /**
   * RDS credentials.
   */
  readonly databaseCredentials: secretsmanager.ISecret;

  /**
   * Name of the database to create.
   */
  readonly databaseName: string;

  /**
   * Logging driver.
   */
  readonly logging?: ecs.LogDriver;
}

/**
 * Ensures a Postgresql database exists by adding an init container. Makes the
 * default container depend on the successful completion of this container.
 */
export class EnsurePostgresqlDatabaseExtension implements ecs.ITaskDefinitionExtension {
  private readonly containerName: string;
  private readonly databaseCredentials: secretsmanager.ISecret;
  private readonly databaseName: string;
  private readonly logging: ecs.LogDriver;

  constructor(props: EnsurePostgresqlDatabaseExtensionProps) {
    this.containerName = props.containerName ?? 'ensure-postgresql-database';
    this.databaseCredentials = props.databaseCredentials;
    this.databaseName = props.databaseName;
    this.logging = props.logging ?? ecs.LogDriver.awsLogs({
      streamPrefix: '/cdk-ecs-keycloak',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });
  }

  extend(taskDefinition: ecs.TaskDefinition) {
    const queryContainer = taskDefinition.addContainer(this.containerName, {
      image: ecs.ContainerImage.fromRegistry('postgres'),
      command: [
        'sh', '-c',
        // https://stackoverflow.com/questions/18389124/simulate-create-database-if-not-exists-for-postgresql
        'echo "SELECT \'CREATE DATABASE $DB_NAME\' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = \'$DB_NAME\')\\gexec" | psql',
      ],
      environment: {
        DB_NAME: this.databaseName,
      },
      secrets: {
        PGHOST: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'host'),
        PGPORT: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'port'),
        PGUSER: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'username'),
        PGPASSWORD: ecs.Secret.fromSecretsManager(this.databaseCredentials, 'password'),
      },
      essential: false,
      logging: this.logging,
      memoryReservationMiB: 32,
      memoryLimitMiB: 128,
    });

    if (taskDefinition.defaultContainer) {
      taskDefinition.defaultContainer.addContainerDependencies({
        container: queryContainer,
        condition: ecs.ContainerDependencyCondition.COMPLETE,
      });
    }
  }
}