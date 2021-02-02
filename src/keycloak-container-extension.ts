import * as ecs from '@aws-cdk/aws-ecs';
import * as logs from '@aws-cdk/aws-logs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';

export enum KeycloakDatabaseVendor {
  /** H2 In-memory Database (Warning: data deleted when task restarts.) */
  H2 = 'h2',
  /** Postgres */
  POSTGRES = 'postgres',
  /** MySQL */
  MYSQL = 'mysql',
  /** MariaDB */
  MARIADB = 'mariadb',
  /** Oracle database */
  ORACLE = 'oracle',
  /** MSSQL */
  MSSQL = 'mssql',
}

export interface KeycloakContainerExtensionProps {
  /**
   * A name for the container added to the task definition.
   * @default 'keycloak'
   */
  readonly containerName?: string;

  /**
   * The default number of distributed cache owners for each key.
   * @default 1
   */
  readonly cacheOwnersCount?: number;

  /**
   * The number of distributed cache owners for authentication sessions.
   * @default - same as `cacheOwnersCount`
   */
  readonly cacheOwnersAuthSessionsCount?: number;

  /**
   * Secrets manager secret containing the RDS database credentials and
   * connection information in JSON format.
   * @default - none
   */
  readonly databaseCredentials?: secretsmanager.ISecret;

  /**
   * Database name
   * @default 'keycloak'
   */
  readonly databaseName?: string;

  /**
   * The database vendor.
   * @default KeycloakDatabaseVendor.H2
   */
  readonly databaseVendor?: KeycloakDatabaseVendor;

  /**
   * Default admin user. This user is created in the master realm if it doesn't exist.
   * @default 'admin'
   */
  readonly defaultAdminUser?: string;

  /**
   * Default admin user's password. This password is applied when the default admin user
   * is created.
   * @default 'admin'
   */
  readonly defaultAdminPassword?: string;
}

/**
 * Adds a keycloak container to a task definition it. To use ECS service
 * discovery to locate cluster members, you need to call `useCloudMapService`
 * with the CloudMap service so that we can configure the correct DNS query.
 * Without CloudMap service discovery, the default will be to use JDBC_ping.
 */
export class KeycloakContainerExtension implements ecs.ITaskDefinitionExtension {
  /**
   * Name of the container added to the task definition.
   */
  public readonly containerName: string;

  /**
   * Name of the Keycloak database.
   */
  public readonly databaseName: string;

  /**
   * Database vendor name.
   */
  public readonly databaseVendor: string;

  /**
   * The number of distributed cache owners for each key.
   */
  public readonly cacheOwnersCount: number;

  /**
   * The number of distributed auth session cache owners for each key.
   */
  public readonly cacheOwnersAuthSessionsCount: number;

  /**
   * The default admin user's name.
   */
  public readonly defaultAdminUser: string;

  /**
   * The default admin user password.
   */
  public readonly defaultAdminPassword: string;

  private readonly databaseCredentials?: secretsmanager.ISecret;
  private cloudMapService?: cloudmap.IService;

  constructor(props?: KeycloakContainerExtensionProps) {
    this.cacheOwnersCount = props?.cacheOwnersCount ?? 1;
    this.cacheOwnersAuthSessionsCount = props?.cacheOwnersAuthSessionsCount ?? this.cacheOwnersCount;

    this.containerName = props?.containerName ?? 'keycloak';
    this.databaseVendor = props?.databaseVendor ?? KeycloakDatabaseVendor.H2;
    this.databaseName = props?.databaseName ?? 'keycloak';
    this.databaseCredentials = props?.databaseCredentials;
    this.defaultAdminUser = props?.defaultAdminUser ?? 'admin';
    this.defaultAdminPassword = props?.defaultAdminPassword ?? 'admin';

    if (!this.databaseCredentials && this.databaseVendor !== KeycloakDatabaseVendor.H2) {
      throw new Error(`The ${this.databaseVendor} database vendor requires credentials`);
    }
  }

  /**
   * Inform Keycloak of a CloudMap service discovery mechanism.
   */
  useCloudMapService(serviceDiscovery: cloudmap.IService) {
    this.cloudMapService = serviceDiscovery;
  }

  /**
   * @inheritDoc
   */
  extend(taskDefinition: ecs.TaskDefinition): void {
    const keycloakSecrets: Record<string, ecs.Secret> = {};

    const databaseNameForVendor = this.databaseVendor != KeycloakDatabaseVendor.H2 ? this.databaseName : '';

    if (this.databaseCredentials) {
      keycloakSecrets.DB_ADDR = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'host');
      keycloakSecrets.DB_PORT = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'port');
      keycloakSecrets.DB_USER = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'username');
      keycloakSecrets.DB_PASSWORD = ecs.Secret.fromSecretsManager(this.databaseCredentials, 'password');
    }

    const keycloak = taskDefinition.addContainer(this.containerName, {
      image: ecs.ContainerImage.fromRegistry('jboss/keycloak'),
      environment: {
        KEYCLOAK_USER: this.defaultAdminUser,
        KEYCLOAK_PASSWORD: this.defaultAdminPassword,
        DB_VENDOR: this.databaseVendor,
        DB_NAME: databaseNameForVendor,
        JGROUPS_DISCOVERY_PROTOCOL: cdk.Lazy.string({
          produce: () => this._getJGroupsDiscoveryProtocol(),
        }),
        JGROUPS_DISCOVERY_PROPERTIES: cdk.Lazy.string({
          produce: () => this._getJGroupsDiscoveryProperties(),
        }),
        CACHE_OWNERS_COUNT: this.cacheOwnersCount.toString(),
        CACHE_OWNERS_AUTH_SESSIONS_COUNT: this.cacheOwnersAuthSessionsCount.toString(),
      },
      secrets: keycloakSecrets,
      logging: ecs.LogDriver.awsLogs({
        streamPrefix: '/cdk-ecs-keycloak',
        logRetention: logs.RetentionDays.ONE_MONTH,
      }),
    });

    keycloak.addPortMappings({ containerPort: 8080 });
    keycloak.addPortMappings({ containerPort: 7600 });
  }

  /**
   * @internal
   */
  public _getJGroupsDiscoveryProtocol() {
    if (!this.cloudMapService) {
      return 'JDBC_PING';
    } else {
      return 'dns.DNS_PING';
    }
  }

  /**
   * @internal
   */
  public _getJGroupsDiscoveryProperties() {
    if (!this.cloudMapService) {
      return '';
    }

    return cdk.Fn.sub('dns_query=${ServiceName}.${ServiceNamespace},dns_record_type=${QueryType}', {
      ServiceName: this.cloudMapService.serviceName,
      ServiceNamespace: this.cloudMapService.namespace.namespaceName,
      QueryType: mapDnsRecordTypeToJGroup(this.cloudMapService.dnsRecordType),
    });
  }
}

export function mapDnsRecordTypeToJGroup(dnsRecordType: cloudmap.DnsRecordType): string {
  switch (dnsRecordType) {
    case cloudmap.DnsRecordType.A: return 'A';
    case cloudmap.DnsRecordType.SRV: return 'SRV';
    default:
      throw new Error(`Unsupported service discovery record type: ${dnsRecordType}`);
  }
}