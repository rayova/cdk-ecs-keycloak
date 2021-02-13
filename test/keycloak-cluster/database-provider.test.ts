import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as secretsmanager from '@aws-cdk/aws-secretsmanager';
import * as cdk from '@aws-cdk/core';
import { DatabaseProvider, KeycloakDatabaseVendor, mapEngineToKeycloakVendor } from '../../src';

describe('database info', () => {
  describe('maps database engines to KeycloakDatabaseVendor', () => {
    test.each([
      [rds.DatabaseClusterEngine.AURORA_MYSQL, KeycloakDatabaseVendor.MYSQL],
      [rds.DatabaseClusterEngine.AURORA_POSTGRESQL, KeycloakDatabaseVendor.POSTGRES],
      [rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }), KeycloakDatabaseVendor.MYSQL],
      [rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_5_7 }), KeycloakDatabaseVendor.MYSQL],
      [rds.DatabaseInstanceEngine.postgres({ version: rds.PostgresEngineVersion.VER_9_5 }), KeycloakDatabaseVendor.POSTGRES],
    ])('%s => %s', (from, to) => {
      expect(mapEngineToKeycloakVendor(from)).toEqual(to);
    });

    test('throws on unrecognized engine', () => {
      expect(() => mapEngineToKeycloakVendor({
        engineType: 'UNKNOWN',
        engineFamily: 'UNKNOWN',
      }));
    });
  });

  describe('serverless cluster provider', () => {
    test('creates a cluster in a private subnet', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE,
            cidrMask: 21,
          },
        ],
      });

      const provider = DatabaseProvider.serverlessAuroraCluster();
      const databaseInfo = provider._bind(stack, vpc);

      expect(stack.node.findChild('Database') instanceof rds.ServerlessCluster).toBeTruthy();
      expect(databaseInfo.vendor).toEqual(KeycloakDatabaseVendor.MYSQL);
      expect(databaseInfo.credentials).toBeTruthy();
      expect(databaseInfo.connectable).toBeTruthy();
    });

    test('creates a cluster with scaling information', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE,
            cidrMask: 21,
          },
        ],
      });

      const provider = DatabaseProvider.serverlessAuroraCluster({
        scaling: {
          // Never pause
          autoPause: cdk.Duration.seconds(0),
          minCapacity: rds.AuroraCapacityUnit.ACU_128,
          maxCapacity: rds.AuroraCapacityUnit.ACU_384,
        },
      });

      provider._bind(stack, vpc);

      const serverlessCluster = stack.node.findChild('Database') as rds.ServerlessCluster;
      const cfnDatabaseCluster = serverlessCluster.node.defaultChild as rds.CfnDBCluster;
      const scalingConfiguration = cfnDatabaseCluster.scalingConfiguration as any;

      expect(scalingConfiguration.autoPause).toEqual(false);
      expect(scalingConfiguration.minCapacity).toEqual(128);
      expect(scalingConfiguration.maxCapacity).toEqual(384);
    });

    test('creates a cluster in a public subnet', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
        ],
      });

      const provider = DatabaseProvider.serverlessAuroraCluster({
        subnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      });
      provider._bind(stack, vpc);

      expect(stack.node.findChild('Database') instanceof rds.ServerlessCluster).toBeTruthy();
    });

    test('creates a postgres cluster', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE,
            cidrMask: 21,
          },
        ],
      });

      const provider = DatabaseProvider.serverlessAuroraCluster({
        engine: rds.DatabaseClusterEngine.auroraPostgres({
          version: rds.AuroraPostgresEngineVersion.VER_9_6_8,
        }),
      });
      const databaseInfo = provider._bind(stack, vpc);

      expect(stack.node.findChild('Database') instanceof rds.ServerlessCluster).toBeTruthy();
      expect(databaseInfo.vendor).toEqual(KeycloakDatabaseVendor.POSTGRES);
      expect(databaseInfo.connectable).toBeTruthy();
    });
  });

  describe('instance provider', () => {
    test('creates an instance in a private subnet', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE,
            cidrMask: 21,
          },
        ],
      });

      const provider = DatabaseProvider.databaseInstance();
      const databaseInfo = provider._bind(stack, vpc);

      expect(stack.node.findChild('Database') instanceof rds.DatabaseInstance).toBeTruthy();
      expect(databaseInfo.vendor).toEqual(KeycloakDatabaseVendor.MYSQL);
      expect(databaseInfo.credentials).toBeTruthy();
      expect(databaseInfo.connectable).toBeTruthy();
    });

    test('creates an instance in a public subnet', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
        ],
      });

      const provider = DatabaseProvider.databaseInstance({
        subnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      });
      provider._bind(stack, vpc);

      expect(stack.node.findChild('Database') instanceof rds.DatabaseInstance).toBeTruthy();
    });

    test('throws on an unrecognized engine', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
        ],
      });

      const provider = DatabaseProvider.databaseInstance({
        engine: rds.DatabaseInstanceEngine.oracleEe({
          version: rds.OracleEngineVersion.VER_12_1,
        }),
        subnets: {
          subnetType: ec2.SubnetType.PUBLIC,
        },
      });
      expect(() => provider._bind(stack, vpc)).toThrow(/unknown engine/i);
    });
  });

  describe('databaseinfo provider', () => {
    test('allows the user to provide their own database info', () => {
      const stack = new cdk.Stack();
      const vpc = new ec2.Vpc(stack, 'Vpc', {
        subnetConfiguration: [
          {
            name: 'ingress',
            subnetType: ec2.SubnetType.PUBLIC,
            cidrMask: 24,
          },
          {
            name: 'private',
            subnetType: ec2.SubnetType.PRIVATE,
            cidrMask: 21,
          },
        ],
      });

      const databaseInstance = new rds.DatabaseInstance(stack, 'Database', {
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_5_6,
        }),
        vpc,
      });

      // Pretend credentials for a secondary account
      const secondaryUserSecret = new secretsmanager.Secret(stack, 'SecondaryUser');

      const provider = DatabaseProvider.fromDatabaseInfo({
        connectable: databaseInstance,
        credentials: secondaryUserSecret,
        vendor: KeycloakDatabaseVendor.MYSQL,
      });

      const databaseInfo = provider._bind(stack, vpc);

      expect(databaseInfo.connectable).toEqual(databaseInstance);
      expect(databaseInfo.vendor).toEqual(KeycloakDatabaseVendor.MYSQL);
      expect(databaseInfo.credentials).toEqual(secondaryUserSecret);
      expect(databaseInfo.connectable).toBeTruthy();
    });
  });
});
