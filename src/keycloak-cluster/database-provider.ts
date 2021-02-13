import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';
import { KeycloakDatabaseVendor } from '../keycloak-container-extension';

/**
 * Provides DatabaseInfo after the VPC is available.
 */
export interface IDatabaseInfoProvider {
  /**
   * Bind any new resources to the parent scope with access to the vpc.
   * @internal
   */
  _bind(scope: cdk.Construct, vpc: ec2.IVpc): DatabaseInfo;
}

/**
 * Information about needed to connect to the database.
 */
export interface DatabaseInfo {
  /**
   * Database credentials in standard RDS json format.
   */
  readonly credentials: secretsmanager.ISecret;

  /**
   * Database vendor
   */
  readonly vendor: KeycloakDatabaseVendor;

  /**
   * A connectable so that the cluster can allow itself to connect to the database.
   */
  readonly connectable?: ec2.IConnectable;
}

/**
 * Convenience interface for providing DatabaseInfo to the cluster.
 */
export abstract class DatabaseProvider {
  /**
   * Provide a new database instance.
   */
  static databaseInstance(props?: DatabaseInstanceProviderProps) {
    return new DatabaseInstanceProvider(props);
  }

  /**
   * Provide a new serverless aurora cluster.
   */
  static serverlessAuroraCluster(props?: ServerlessAuroraDatabaseProviderProps): IDatabaseInfoProvider {
    return new ServerlessAuroraDatabaseProvider(props);
  }

  /**
   * Provide raw DatabaseInfo
   */
  static fromDatabaseInfo(props: DatabaseInfo): IDatabaseInfoProvider {
    return {
      _bind: () => props,
    };
  }
}

/**
 * Basic props for creating a database instance.
 */
export interface DatabaseInstanceProviderProps {
  /**
   * Instance database engine.
   * @default - mysql 8.0
   */
  readonly engine?: rds.IInstanceEngine;

  /**
   * Instance type.
   * @default - t2.micro
   */
  readonly instanceType?: ec2.InstanceType;

  /**
   * Select subnets to register the database instance in.
   */
  readonly subnets?: ec2.SubnetSelection;
}

/**
 * Provides a very basic RDS database instance.
 */
export class DatabaseInstanceProvider implements IDatabaseInfoProvider {
  private readonly engine: rds.IInstanceEngine;
  private readonly instanceType: ec2.InstanceType;
  private readonly subnets?: ec2.SubnetSelection;

  constructor(props?: DatabaseInstanceProviderProps) {
    this.engine = props?.engine ??
      rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0,
      });

    this.instanceType = props?.instanceType ??
      ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO);

    this.subnets = props?.subnets;
  }

  /**
   * @internal
   */
  _bind(scope: cdk.Construct, vpc: ec2.IVpc): DatabaseInfo {
    const db = new rds.DatabaseInstance(scope, 'Database', {
      engine: this.engine,
      instanceType: this.instanceType,
      vpcSubnets: this.subnets,
      vpc,
    });

    return {
      credentials: db.secret!,
      vendor: mapEngineToKeycloakVendor(this.engine),
      connectable: db,
    };
  }
}

/**
 * Basic props for creating a serverless Aurora database cluster.
 */
export interface ServerlessAuroraDatabaseProviderProps {
  /**
   * Cluster engine.
   * @default rds.DatabaseClusterEngine.AURORA_MYSQL
   */
  readonly engine?: rds.IClusterEngine;

  /**
   * Scaling options.
   * @default - 5 minute auto pause, min and max capacity of 1 acu.
   */
  readonly scaling?: rds.ServerlessScalingOptions;

  /**
   * Select subnets to register the database cluster in.
   */
  readonly subnets?: ec2.SubnetSelection;
}

/**
 * Provides a serverless Aurora database cluster.
 */
export class ServerlessAuroraDatabaseProvider implements IDatabaseInfoProvider {
  private readonly engine: rds.IClusterEngine;
  private readonly scaling?: rds.ServerlessScalingOptions;
  private readonly vpcSubnets?: ec2.SubnetSelection;

  constructor(props?: ServerlessAuroraDatabaseProviderProps) {
    this.engine = props?.engine ?? rds.DatabaseClusterEngine.AURORA_MYSQL;
    this.scaling = props?.scaling ?? {
      autoPause: cdk.Duration.minutes(5),
      minCapacity: rds.AuroraCapacityUnit.ACU_1,
      maxCapacity: rds.AuroraCapacityUnit.ACU_1,
    };
    this.vpcSubnets = props?.subnets;
  }

  /**
   * @internal
   */
  _bind(scope: cdk.Construct, vpc: ec2.IVpc): DatabaseInfo {
    const db = new rds.ServerlessCluster(scope, 'Database', {
      engine: this.engine,
      vpc: vpc,
      scaling: this.scaling,
      vpcSubnets: this.vpcSubnets,
    });

    return {
      vendor: mapEngineToKeycloakVendor(this.engine),
      credentials: db.secret!,
      connectable: db,
    };
  }
}

/**
 * @internal
 */
export function mapEngineToKeycloakVendor(engine: rds.IEngine) {
  switch (engine.engineFamily) {
    case 'MYSQL':
      return KeycloakDatabaseVendor.MYSQL;
    case 'POSTGRESQL':
      return KeycloakDatabaseVendor.POSTGRES;
    default:
      throw new Error(`Unknown engine family: ${engine.engineFamily}`);
  }
}