import * as cdk from '@aws-cdk/core';
import * as keycloak from '../index';

export class IntegKeycloakClusterSpotStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, 'integ-keycloak-cluster-spot');
    new keycloak.KeycloakCluster(this, 'Keycloak', {
      ecsClusterProvider: keycloak.ClusterProvider.fargateSpotCluster(),
      capacityProviderStrategy: [
        {
          capacityProvider: 'FARGATE_SPOT',
          weight: 100,
        },
        {
          capacityProvider: 'FARGATE',
          weight: 1,
        },
      ],
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterSpotStack(app);