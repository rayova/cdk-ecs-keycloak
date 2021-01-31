import * as ecs from '@aws-cdk/aws-ecs';
import * as logs from '@aws-cdk/aws-logs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';

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

/**
 * Extends a task definition by adding a keycloak container to it. To cluster
 * your KeyCloak servers, you need to enable service discovery and you must
 * call KeyCloakContainerExtension.useService(service) with the ECS service
 * so that we can configure the correct DNS query.
 */
export class KeyCloakContainerExtension implements ecs.ITaskDefinitionExtension {
  public readonly containerName: string;
  private readonly databaseCredentials?: secretsmanager.ISecret;
  public readonly databaseName: string;
  public readonly databaseVendor: string;
  private service: ecs.BaseService|undefined;

  constructor(props?: KeyCloakContainerExtensionProps) {
    this.containerName = props?.containerName ?? 'keycloak';
    this.databaseVendor = props?.databaseVendor ?? KeyCloakDatabaseVendor.H2;
    this.databaseName = props?.databaseName ?? 'keycloak';
    this.databaseCredentials = props?.databaseCredentials;

    if (!this.databaseCredentials && this.databaseVendor !== KeyCloakDatabaseVendor.H2) {
      throw new Error(`The ${this.databaseVendor} database vendor requires credentials`);
    }
  }

  useService(service: ecs.BaseService) {
    this.service = service;
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
        JGROUPS_DISCOVERY_PROTOCOL: 'dns.DNS_PING',
        JGROUPS_DISCOVERY_PROPERTIES: this.getJGroupsDiscoveryProperties(),
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

  private getJGroupsDiscoveryProperties() {
    return cdk.Lazy.string({
      produce: (): string => {
        if (!this.service) {
          throw new Error('Please call KeyCloakContainerExtension.useService so that we can discover the service discovery info');
        }

        if (!this.service.cloudMapService) {
          throw new Error('Please configure the service with cloudmap service discovery');
        }

        const cloudMapService = this.service.cloudMapService;

        // TODO: Actually map the record type and throw if it's incompatible.
        const mappedRecordType = cloudMapService.dnsRecordType;

        return cdk.Fn.sub('dns_query=${ServiceName}.${ServiceNamespace},dns_record_type=${QueryType}', {
          ServiceName: cloudMapService.serviceName,
          ServiceNamespace: cloudMapService.namespace.namespaceName,
          QueryType: mappedRecordType,
        });
      },
    });
  }
}