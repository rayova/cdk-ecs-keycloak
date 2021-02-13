import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as logs from '@aws-cdk/aws-logs';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cloudmap from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';

/**
 * The database vendor.
 */
export enum KeycloakDatabaseVendor {
  /** H2 In-memory Database (Warning: data deleted when task restarts.) */
  H2 = 'h2',
  /** MySQL */
  MYSQL = 'mysql',
  /** MariaDB */
  MARIADB = 'mariadb',
  /** MSSQL (not yet supported, please submit a PR) */
  MSSQL = 'mssql',
  /** Oracle database (not yet supported, please submit a PR) */
  ORACLE = 'oracle',
  /** Postgres (not yet supported, please submit a PR) */
  POSTGRES = 'postgres',
}

/**
 * Configuration for the Keycloak container.
 */
export interface KeycloakContainerExtensionProps {
  /**
   * Keycloak container image to use.
   * @default - use jboss/keycloak from docker hub.
   */
  readonly image?: ecs.ContainerImage;

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

  /**
   * Memory limit of the keycloak task.
   * @default 1024
   */
  readonly memoryLimitMiB?: number;

  /**
   * Memory reservation size for the keycloak task.
   * @default - 80% of memoryLimitMiB
   */
  readonly memoryReservationMiB?: number;

  /**
   * Log driver for the task.
   * @default - cloudwatch with one month retention
   */
  readonly logging?: ecs.LogDriver;
}

/**
 * Adds a keycloak container to a task definition. To use ECS service discovery
 * to locate cluster members, you need to call `useCloudMapService` with the
 * CloudMap service so that we can configure the correct DNS query. Without
 * CloudMap service discovery, the Keycloak will use JDBC_PING.
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
   * Database vendor.
   */
  public readonly databaseVendor: KeycloakDatabaseVendor;

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

  /**
   * Web traffic port.
   */
  public readonly webPort: number = 8080;

  /**
   * Web traffic port with HTTPS
   */
  public readonly httpsWebPort: number = 8443;

  /**
   * Admin console port.
   */
  public readonly adminConsolePort: number = 9990;

  // Privates
  private readonly _memoryLimitMiB?: number;
  private readonly _memoryReservationMiB?: number;
  private readonly _logging: ecs.LogDriver;
  private readonly _databaseCredentials?: secretsmanager.ISecret;
  private readonly _image: ecs.ContainerImage;
  private _cloudMapService?: cloudmap.IService;

  constructor(props?: KeycloakContainerExtensionProps) {
    this.cacheOwnersCount = props?.cacheOwnersCount ?? 1;
    this.cacheOwnersAuthSessionsCount = props?.cacheOwnersAuthSessionsCount ?? this.cacheOwnersCount;
    this._image = props?.image ?? ecs.ContainerImage.fromRegistry('jboss/keycloak');

    this.containerName = props?.containerName ?? 'keycloak';
    this.databaseVendor = props?.databaseVendor ?? KeycloakDatabaseVendor.H2;
    this.databaseName = props?.databaseName ?? 'keycloak';
    this._databaseCredentials = props?.databaseCredentials;
    this.defaultAdminUser = props?.defaultAdminUser ?? 'admin';
    this.defaultAdminPassword = props?.defaultAdminPassword ?? 'admin';

    this._memoryLimitMiB = props?.memoryLimitMiB;
    this._memoryReservationMiB = props?.memoryReservationMiB;

    this._logging = props?.logging ?? ecs.LogDriver.awsLogs({
      streamPrefix: '/cdk-ecs-keycloak',
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    if (!isSupportedDatabaseVendor(this.databaseVendor)) {
      throw new Error(`The ${this.databaseVendor} is not yet tested and fully supported. Please submit a PR.`);
    }

    if (!this._databaseCredentials && this.databaseVendor !== KeycloakDatabaseVendor.H2) {
      throw new Error(`The ${this.databaseVendor} database vendor requires credentials`);
    }
  }

  /**
   * Inform Keycloak of a CloudMap service discovery mechanism.
   */
  useCloudMapService(serviceDiscovery: cloudmap.IService) {
    this._cloudMapService = serviceDiscovery;
  }

  /**
   * @inheritDoc
   */
  extend(taskDefinition: ecs.TaskDefinition): void {
    const keycloakSecrets: Record<string, ecs.Secret> = {};

    const databaseNameForVendor = this.databaseVendor != KeycloakDatabaseVendor.H2 ? this.databaseName : '';

    let keycloakMemoryLimit: number;
    if (this._memoryLimitMiB) {
      keycloakMemoryLimit = this._memoryLimitMiB;
    } else if (taskDefinition.isFargateCompatible && !this._memoryLimitMiB) {
      const cfnTaskDefinition = taskDefinition.node.defaultChild as ecs.CfnTaskDefinition;
      keycloakMemoryLimit = parseInt(cfnTaskDefinition.memory!);
    } else {
      keycloakMemoryLimit = 512;
    }

    // User-specified memory reservation, otherwise 80% of the memory limit.
    let keycloakMemoryReservation = this._memoryReservationMiB ?? Math.round(keycloakMemoryLimit * 0.8);

    if (this._databaseCredentials) {
      keycloakSecrets.DB_ADDR = ecs.Secret.fromSecretsManager(this._databaseCredentials, 'host');
      keycloakSecrets.DB_PORT = ecs.Secret.fromSecretsManager(this._databaseCredentials, 'port');
      keycloakSecrets.DB_USER = ecs.Secret.fromSecretsManager(this._databaseCredentials, 'username');
      keycloakSecrets.DB_PASSWORD = ecs.Secret.fromSecretsManager(this._databaseCredentials, 'password');
    }

    const keycloak = taskDefinition.addContainer(this.containerName, {
      image: this._image,
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
        JDBC_PARAMS: 'useSSL=false',
        JAVA_OPTS: '-Djboss.bind.address.management=0.0.0.0',
      },
      secrets: keycloakSecrets,
      logging: this._logging,
      memoryLimitMiB: keycloakMemoryLimit,
      memoryReservationMiB: keycloakMemoryReservation,
    });


    keycloak.addPortMappings({ containerPort: this.webPort }); // Web port
    keycloak.addPortMappings({ containerPort: this.httpsWebPort }); // HTTPS web port
    keycloak.addPortMappings({ containerPort: this.adminConsolePort }); // Admin console port
    keycloak.addPortMappings({ containerPort: 7600 }); // jgroups-tcp
    keycloak.addPortMappings({ containerPort: 57600 }); // jgroups-tcp-fd
    keycloak.addPortMappings({ containerPort: 55200, protocol: ecs.Protocol.UDP }); // jgroups-udp
    keycloak.addPortMappings({ containerPort: 54200, protocol: ecs.Protocol.UDP }); // jgroups-udp-fd
  }

  /**
   * @internal
   */
  public _getJGroupsDiscoveryProtocol() {
    if (!this._cloudMapService) {
      return 'JDBC_PING';
    } else {
      return 'dns.DNS_PING';
    }
  }

  /**
   * @internal
   */
  public _getJGroupsDiscoveryProperties() {
    if (!this._cloudMapService) {
      return '';
    }

    // Note: SRV-based discovery isn't enough to handle bridged-mode networking.
    // - Keycloak wants two ports for clustering in either stack mode
    // - CloudMap currently supports only one service registry per ecs service
    //
    // To the reader: Got any suggestions? Open a PR. I'd love to run this on
    // EC2 with bridged networking so that keycloak can be run in containers on
    // bursting instance types where vpc trunking is not available.
    return cdk.Fn.sub('dns_query=${ServiceName}.${ServiceNamespace},dns_record_type=${QueryType}', {
      ServiceName: this._cloudMapService.serviceName,
      ServiceNamespace: this._cloudMapService.namespace.namespaceName,
      QueryType: mapDnsRecordTypeToJGroup(this._cloudMapService.dnsRecordType),
    });
  }

  /**
   * Configure health checks on the target group.
   * @param targetGroup
   */
  public configureHealthCheck(targetGroup: elbv2.ApplicationTargetGroup) {
    targetGroup.configureHealthCheck({
      path: '/auth/realms/master',
      enabled: true,
    });
  }
}

/**
 * Checks if the given database vendor is supported by this construct.
 * @internal
 */
export function isSupportedDatabaseVendor(databaseVendor: KeycloakDatabaseVendor) {
  switch (databaseVendor) {
    case KeycloakDatabaseVendor.H2:
    case KeycloakDatabaseVendor.MARIADB:
    case KeycloakDatabaseVendor.MYSQL:
      return true;

    default:
      return false;
  }
}

/**
 * Maps a cloudmap dns record type to a name recognized by the Keycloak container.
 * @internal
 */
export function mapDnsRecordTypeToJGroup(dnsRecordType: cloudmap.DnsRecordType): string {
  switch (dnsRecordType) {
    case cloudmap.DnsRecordType.A: return 'A';
    case cloudmap.DnsRecordType.SRV: return 'SRV';
    default:
      throw new Error(`Unsupported service discovery record type: ${dnsRecordType}`);
  }
}