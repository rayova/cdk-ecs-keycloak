import * as cdk from '@aws-cdk/core';
import * as keycloak from '../index';

export class IntegKeycloakClusterSimplestStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, 'integ-keycloak-cluster-simplest');
    new keycloak.KeycloakCluster(this, 'Keycloak');
  }
}

const app = new cdk.App();
new IntegKeycloakClusterSimplestStack(app);