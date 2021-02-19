import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as rds from '@aws-cdk/aws-rds';
import * as cdk from '@aws-cdk/core';
import * as keycloak from '..';

export class IntegKeycloakClusterBYOStack extends cdk.Stack {
  constructor(scope: cdk.Construct) {
    super(scope, 'integ-keycloak-cluster-byo');

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
    const rdsDb = new rds.ServerlessCluster(this, 'DB', {
      vpc,
      engine: rds.DatabaseClusterEngine.auroraMysql({
        version: rds.AuroraMysqlEngineVersion.VER_5_7_12,
      }),
      scaling: {
        autoPause: cdk.Duration.minutes(5),
        minCapacity: rds.AuroraCapacityUnit.ACU_1,
        maxCapacity: rds.AuroraCapacityUnit.ACU_1,
      },
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
      // Provide an existing VPC so the cluster and database can opt to reuse it
      vpcProvider: keycloak.VpcProvider.fromVpc(vpc),
      // Bring your own database
      databaseProvider: keycloak.DatabaseProvider.fromDatabaseInfo({
        // Provide an RDS-compatible secret with credentials and connection
        // info (required)
        credentials: rdsDb.secret!,
        // Inform Keycloak of the database vendor (required)
        vendor: keycloak.KeycloakDatabaseVendor.MYSQL,
        // Add an ingress rule to the database security group (optional as long
        // as the Keycloak tasks can connect to the database)
        connectable: rdsDb,
      }),
      // Bring your own load balancer
      httpPortPublisher: keycloak.PortPublisher.addTarget({
        // Your load balancer listener
        listener,
        // Only publish certain paths
        conditions: [elbv2.ListenerCondition.pathPatterns([
          '/auth/*',
        ])],
        // Set your listener rule priority
        priority: 1000,
      }),
    });
  }
}

const app = new cdk.App();
new IntegKeycloakClusterBYOStack(app);
