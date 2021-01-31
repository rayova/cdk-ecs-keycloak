import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as rds from '@aws-cdk/aws-rds';
import * as discovery from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';

import { EnsureMysqlDatabaseExtension } from './ensure-mysql-database-extension';
import { KeyCloakDatabaseVendor, KeyCloakContainerExtension } from './key-cloak-container-extension';

export class IntegFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string) {
    super(scope, id);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      subnetConfiguration: [
        {
          name: 'public',
          cidrMask: 22,
          subnetType: ec2.SubnetType.PUBLIC,
        },
      ],
    });

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc: vpc,
      defaultCloudMapNamespace: {
        name: 'integ-fargate-stack',
        type: discovery.NamespaceType.DNS_PRIVATE,
        vpc: vpc,
      },
    });

    const cfnCluster = cluster.node.defaultChild as any as ecs.CfnCluster;
    cfnCluster.capacityProviders = ['FARGATE', 'FARGATE_SPOT'];
    cfnCluster.defaultCapacityProviderStrategy = [
      {
        capacityProvider: 'FARGATE_SPOT',
        weight: 1,
      },
      {
        capacityProvider: 'FARGATE',
        weight: 10,
      },
    ];

    const db = new rds.DatabaseInstance(this, 'DB', {
      engine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.BURSTABLE2, ec2.InstanceSize.MICRO),
      publiclyAccessible: true,
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    if (!db.secret) {
      throw new Error('RDS did not provide a secret');
    }

    new cdk.CfnOutput(this, 'RdsEndpoint', {
      value: db.dbInstanceEndpointAddress,
    });
    new cdk.CfnOutput(this, 'RdsSecret', {
      value: db.secret.secretName,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, id, {
      // Minimum
      cpu: 512,
      memoryLimitMiB: 1024,
    });

    // Add the keycloak container
    const keyCloakWorkloadExtension = new KeyCloakContainerExtension({
      databaseCredentials: db.secret,
      databaseVendor: KeyCloakDatabaseVendor.MYSQL,
    });
    taskDefinition.addExtension(keyCloakWorkloadExtension);
    taskDefinition.addExtension(new EnsureMysqlDatabaseExtension({
      databaseCredentials: db.secret,
      databaseName: keyCloakWorkloadExtension.databaseName,
    }));

    const pattern = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster: cluster,
      assignPublicIp: true,
      healthCheckGracePeriod: cdk.Duration.minutes(5),
      taskDefinition: taskDefinition,
      platformVersion: ecs.FargatePlatformVersion.VERSION1_4,
      desiredCount: 10,
      taskSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      cloudMapOptions: {
        dnsTtl: cdk.Duration.seconds(10),
        dnsRecordType: discovery.DnsRecordType.A,
      },
    });

    // Tasks can connect to themselves for cache access.
    pattern.service.connections.allowFrom(pattern.service, ec2.Port.allTraffic());
    // pattern.service.connections.allowFrom(ec2.Peer.anyIpv4(), ec2.Port.allTraffic());
    keyCloakWorkloadExtension.useService(pattern.service);

    db.connections.allowDefaultPortFrom(pattern.service);

    const cfnService = pattern.service.node.findChild('Service') as ecs.CfnService;
    cfnService.launchType = undefined;
    cfnService.capacityProviderStrategy = cfnCluster.defaultCapacityProviderStrategy;
  }
}

// yarn cdk --app 'ts-node -P tsconfig.jest.json src/integ-fargate-stack' deploy
const app = new cdk.App();
new IntegFargateStack(app, 'integ-fargate');
