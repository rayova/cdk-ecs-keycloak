import * as ecs from '@aws-cdk/aws-ecs';
import * as logs from '@aws-cdk/aws-logs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';

export enum KeyCloakDatabaseVendor {
  H2 = 'h2',
  POSTGRES = 'postgres',
  MYSQL = 'mysql',
  MARIADB = 'mariadb',
  ORACLE = 'oracle',
  MSSQL = 'mssql',
}

export interface KeyCloakContainerExtensionProps {
  /**
   * @default 'keycloak'
   */
  readonly containerName?: string;

  /**
   * @default - none
   */
  readonly databaseCredentials?: secretsmanager.ISecret;

  /**
   * Database name
   * @default 'keycloak'
   */
  readonly databaseName?: string;

  /**
   * @default KeyCloakDatabaseVendor.MARIADB
   */
  readonly databaseVendor?: KeyCloakDatabaseVendor;
}

export class KeyCloakContainerExtension implements ecs.ITaskDefinitionExtension {
  public readonly containerName: string;
  private readonly databaseCredentials?: secretsmanager.ISecret;
  public readonly databaseName: string;
  public readonly databaseVendor: string;

  constructor(props?: KeyCloakContainerExtensionProps) {
    this.containerName = props?.containerName ?? 'keycloak';
    this.databaseVendor = props?.databaseVendor ?? KeyCloakDatabaseVendor.H2;
    this.databaseName = props?.databaseName ?? 'keycloak';
    this.databaseCredentials = props?.databaseCredentials;

    if (!this.databaseCredentials && this.databaseVendor !== KeyCloakDatabaseVendor.H2) {
      throw new Error(`The ${this.databaseVendor} database vendor requires credentials`);
    }
  }

  // Works for fargate and ec2 task definitions in general.
  extend(taskDefinition: ecs.TaskDefinition): void {
    const keycloakSecrets: Record<string, ecs.Secret> = {};

    if (this.databaseCredentials) {
      keycloakSecrets.DB_ADDR = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'host');
      keycloakSecrets.DB_PORT = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'port');
      keycloakSecrets.DB_USER = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'username');
      keycloakSecrets.DB_PASSWORD = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'password');
    }

    const keycloak = taskDefinition.addContainer(this.containerName, {
      image: ecs.ContainerImage.fromRegistry('jboss/keycloak'),
      environment: {
        KEYCLOAK_USER: 'admin',
        KEYCLOAK_PASSWORD: 'admin',
        DB_VENDOR: this.databaseVendor,
        DB_NAME: this.databaseName,
      },
      secrets: keycloakSecrets,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: '/cdk-ecs-keycloak',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    keycloak.addPortMappings({
      containerPort: 8080,
    });
  }
}