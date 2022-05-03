import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cdk from 'aws-cdk-lib/core';
import { Construct } from 'constructs';
import * as keycloak from '../index';

export class IntegKeycloakClusterDbInstanceStack extends cdk.Stack {
  constructor(scope: Construct) {
    super(scope, 'integ-keycloak-cluster-db-instance');

    new keycloak.KeycloakCluster(this, 'Keycloak', {
      databaseProvider: keycloak.DatabaseProvider.databaseInstance({
        engine: rds.DatabaseInstanceEngine.mysql({
          version: rds.MysqlEngineVersion.VER_5_7,
        }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      }),
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterDbInstanceStack(app);