import * as ec2 from '@aws-cdk/aws-ec2';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import * as keycloak from '../index';

export class IntegKeycloakClusterPostgresStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, 'integ-keycloak-cluster-postgres');

    new keycloak.KeycloakCluster(this, 'Keycloak', {
      databaseProvider: keycloak.DatabaseProvider.databaseInstance({
        engine: rds.DatabaseInstanceEngine.postgres({
          version: rds.PostgresEngineVersion.VER_11_9,
        }),
        instanceType: ec2.InstanceType.of(ec2.InstanceClass.T2, ec2.InstanceSize.MICRO),
      }),
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterPostgresStack(app);