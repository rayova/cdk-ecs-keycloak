import * as path from 'path';
import * as ecs from '@aws-cdk/aws-ecs';
import * as cdk from '@aws-cdk/core';
import * as keycloak from '../index';

export class IntegKeycloakClusterCustomContainerStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, 'integ-keycloak-cluster-custom-container');

    const pathToDockerBuildContext = path.join(__dirname, 'custom-container');

    new keycloak.KeycloakCluster(this, 'Keycloak', {
      keycloak: {
        image: ecs.ContainerImage.fromAsset(pathToDockerBuildContext, {
          buildArgs: {
            FROM: 'jboss/keycloak:12.0.2',
          },
        }),
      },
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterCustomContainerStack(app);