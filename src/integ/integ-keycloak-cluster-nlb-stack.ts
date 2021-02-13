import * as cdk from '@aws-cdk/core';
import * as keycloak from '..';

export class IntegKeycloakClusterNlbStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);
    new keycloak.KeycloakCluster(this, 'Keycloak', {
      listenerProvider: keycloak.ListenerProvider.nlb({
        port: 8080,
      }),
      httpsListenerProvider: keycloak.ListenerProvider.nlb({
        port: 8443,
        healthCheck: false,
      }),
      adminConsoleListenerProvider: keycloak.ListenerProvider.nlb({
        port: 9990,
        healthCheck: false,
      }),
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterNlbStack(app, 'integ-lit-nlb');