import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as keycloak from '../index';

export class IntegKeycloakClusterSimplestStack extends cdk.Stack {
  constructor(scope: Construct) {
    super(scope, 'integ-keycloak-cluster-simplest');
    new keycloak.KeycloakCluster(this, 'Keycloak');
  }
}

const app = new cdk.App();
new IntegKeycloakClusterSimplestStack(app);