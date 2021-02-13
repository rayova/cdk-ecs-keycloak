import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';
import * as keycloak from '..';

export class IntegKeycloakClusterBYOLStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, 'integ-lit-byol');

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
new IntegKeycloakClusterBYOLStack(app);

