import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';
import { KeycloakDatabaseVendor } from '../keycloak-container-extension';

export interface IDatabaseInfoProvider {
  bind(scope: cdk.Construct, vpc: ec2.IVpc): DatabaseInfo;
}

export interface DatabaseInfo {
  readonly credentials: secretsmanager.ISecret;
  readonly vendor: KeycloakDatabaseVendor;
  readonly connectable?: ec2.IConnectable;
}

export abstract class DatabaseProvider {
  static serverlessAuroraCluster(props?: ServerlessAuroraDatabaseProviderProps): IDatabaseInfoProvider {
    return new BasicServerlessAuroraDatabaseProvider(props);
  }

  static fromDatabaseInfo(props: DatabaseInfo): IDatabaseInfoProvider {
    return {
      bind: () => props,
    };
  }
}

export interface ServerlessAuroraDatabaseProviderProps {
  readonly engine?: rds.IClusterEngine;
  readonly scaling?: rds.ServerlessScalingOptions;
  readonly subnets?: ec2.SubnetSelection;
}

/** @internal */
export class BasicServerlessAuroraDatabaseProvider implements IDatabaseInfoProvider {
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

  bind(scope: cdk.Construct, vpc: ec2.IVpc): DatabaseInfo {
    const db = new rds.ServerlessCluster(scope, 'Database', {
      engine: this.engine,
      vpc: vpc,
      scaling: this.scaling,
      vpcSubnets: this.vpcSubnets,
    });

    return {
      vendor: KeycloakDatabaseVendor.MYSQL,
      credentials: db.secret!,
      connectable: db,
    };
  }
}
