import * as cdk from '@aws-cdk/core';
import * as keycloak from '..';

export class IntegKeycloakClusterNlbStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, 'integ-keycloak-cluster-nlb');

    new keycloak.KeycloakCluster(this, 'Keycloak', {
      httpPortPublisher: keycloak.PortPublisher.nlb({
        port: 8080,
      }),
      httpsPortPublisher: keycloak.PortPublisher.nlb({
        port: 8443,
        healthCheck: false,
      }),
      adminConsolePortPublisher: keycloak.PortPublisher.nlb({
        port: 9990,
        healthCheck: false,
      }),
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterNlbStack(app);