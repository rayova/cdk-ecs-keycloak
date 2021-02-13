import * as acm from '@aws-cdk/aws-certificatemanager';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';
import * as keycloak from '..';

export class IntegLitSimplestStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);
    new keycloak.KeycloakCluster(this, 'Keycloak');
  }
}

export class IntegLitBiggerStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    const certificateArn = this.node.tryGetContext('CERTICATE_ARN') ?? 'provide this context on the cli';
    const certificate = acm.Certificate.fromCertificateArn(this, 'Certificate', certificateArn);

    // Create a Keycloak cluster on Fargate
    const keycloakCluster = new keycloak.KeycloakCluster(this, 'Keycloak', {
      // Fargate task sizes
      cpu: 512,
      memoryLimitMiB: 1024,
      // Service options
      minHealthyPercent: 50,
      maxHealthyPercent: 200,
      // Configure some keycloak-specific settings.
      keycloak: {
        cacheOwnersCount: 2,
      },
      listenerProvider: keycloak.ListenerProvider.https({
        certificates: [certificate],
      }),
    });

    // Auto-scale the service
    const autoScaling = keycloakCluster.service.autoScaleTaskCount({
      maxCapacity: 5,
      minCapacity: 3,
    });

    autoScaling.scaleOnCpuUtilization('Target40', {
      targetUtilizationPercent: 40,
      scaleInCooldown: cdk.Duration.minutes(10),
      scaleOutCooldown: cdk.Duration.minutes(30),
    });
  }
}

export class IntegLitByolStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      subnetConfiguration: [
        {
          name: 'ingress',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 24,
        },
        {
          name: 'private',
          subnetType: ec2.SubnetType.PRIVATE,
          cidrMask: 21,
        },
      ],
    });

    const loadBalancer = new elbv2.ApplicationLoadBalancer(this, 'Alb', {
      vpc,
      internetFacing: true,
    });

    new cdk.CfnOutput(this, 'AlbAddress', {
      value: cdk.Fn.sub('http://${Name}', {
        Name: loadBalancer.loadBalancerDnsName,
      }),
    });

    const listener = loadBalancer.addListener('http', {
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.fixedResponse(404, {
        contentType: 'text/plain',
        messageBody: 'Nothing here',
      }),
    });

    new keycloak.KeycloakCluster(this, 'Keycloak', {
      // Provide an existing VPC so the cluster and database can opt to reuse it.
      vpcProvider: keycloak.VpcProvider.fromExistingVpc(vpc),
      // Re-use the existing listener
      listenerProvider: keycloak.ListenerProvider.fromListenerInfo({
        listener,
        conditions: [elbv2.ListenerCondition.hostHeaders(['id.example.com'])],
        priority: 1000,
      }),
    });
  }
}

const app = new cdk.App();
new IntegLitSimplestStack(app, 'integ-lit-simplest');
new IntegLitBiggerStack(app, 'integ-lit-bigger');
new IntegLitByolStack(app, 'integ-lit-byol');

