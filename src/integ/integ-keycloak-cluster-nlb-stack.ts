import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as keycloak from '..';

export class IntegKeycloakClusterNlbStack extends cdk.Stack {
  constructor(scope: Construct) {
    super(scope, 'integ-keycloak-cluster-nlb');

    new keycloak.KeycloakCluster(this, 'Keycloak', {
      // Publish the container's HTTP web port in a NLB on port 8080
      httpPortPublisher: keycloak.PortPublisher.nlb({
        port: 8080,
      }),
      // Publish the container's HTTPS port in an NLB on port 8443
      httpsPortPublisher: keycloak.PortPublisher.nlb({
        port: 8443,
        healthCheck: false,
      }),
      // Publish the Wildfly Admin Console on port 9990 (not recommended in
      // production)
      adminConsolePortPublisher: keycloak.PortPublisher.nlb({
        port: 9990,
        healthCheck: false,
      }),
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterNlbStack(app);