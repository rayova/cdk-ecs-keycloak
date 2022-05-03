import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import * as keycloak from '../index';

export class IntegKeycloakAutoScalingHttpsStack extends cdk.Stack {
  constructor(scope: Construct) {
    super(scope, 'integ-keycloak-cluster-autoscaling-https');

    const certificateArn = scope.node.tryGetContext('CERTIFICATE_ARN') ?? 'PRETEND';
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);

    // Create a Keycloak cluster on Fargate
    const keycloakCluster = new keycloak.KeycloakCluster(this, 'Keycloak', {
      // Fargate task sizes
      cpu: 512,
      memoryLimitMiB: 1024,
      // Service options
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      keycloak: {
        // Set distributed inficaches owners to two
        cacheOwnersCount: 2,
      },
      // Use an HTTPS load balancer with internal HTTPS from the load balancer to Keycloak.
      httpsPortPublisher: keycloak.PortPublisher.httpsAlb({
        certificates: [certificate],
        // Redirect HTTP traffic to HTTPS
        upgradeHttp: true,
      }),
    });

    // Auto-scale the service
    const autoScaling = keycloakCluster.service.autoScaleTaskCount({
      maxCapacity: 5,
      minCapacity: 3,
    });

    autoScaling.scaleOnCpuUtilization('Target40', {
      targetUtilizationPercent: 40,
      scaleInCooldown: cdk.Duration.minutes(30),
      scaleOutCooldown: cdk.Duration.minutes(10),
    });
  }
}

const app = new cdk.App();
new IntegKeycloakAutoScalingHttpsStack(app);
