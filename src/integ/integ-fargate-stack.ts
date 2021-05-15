import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as ecs from '@aws-cdk/aws-ecs';
import * as rds from '@aws-cdk/aws-rds';
import * as discovery from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';

import { KeycloakDatabaseVendor, KeycloakFargateTaskDefinition } from '../index';

export interface IntegFargateStackPops {
  databaseInstanceEngine: rds.IInstanceEngine;
}

/**
 * Integration test. This lives in the src directory so we can run it.
 * @internal
 */
export class IntegFargateStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: IntegFargateStackPops) {
    super(scope, id);

    const databaseEngine = props.databaseInstanceEngine;

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
        name: this.stackName,
        type: discovery.NamespaceType.DNS_PRIVATE,
        vpc: vpc,
      },
    });

    // For messing around, I'm using fargate spot.
    const cfnCluster = cluster.node.defaultChild as any as ecs.CfnCluster;
    cfnCluster.capacityProviders = ['FARGATE', 'FARGATE_SPOT'];
    cfnCluster.defaultCapacityProviderStrategy = [
      {
        capacityProvider: 'FARGATE_SPOT',
        weight: 100,
      },
      {
        capacityProvider: 'FARGATE',
        weight: 1,
      },
    ];

    const db = new rds.DatabaseInstance(this, 'DB', {
      engine: databaseEngine,
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

    const taskDefinition = new KeycloakFargateTaskDefinition(this, 'TaskDefinition', {
      // Minimum
      cpu: 512,
      memoryLimitMiB: 1024,
      keycloak: {
        databaseCredentials: db.secret,
        databaseVendor: KeycloakDatabaseVendor.MYSQL,
        cacheOwnersCount: 3,
      },
    });

    const pattern = new ecs_patterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster: cluster,
      assignPublicIp: true,
      // This can take a while, while the cluster synchronizes.
      healthCheckGracePeriod: cdk.Duration.minutes(10),
      minHealthyPercent: 100,
      maxHealthyPercent: 300,
      taskDefinition: taskDefinition,
      desiredCount: 2,
      taskSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
    });

    taskDefinition.configureHealthCheck(pattern.targetGroup);
    pattern.targetGroup.setAttribute('deregistration_delay.timeout_seconds', '5');

    // Tasks can connect to themselves for cache access.
    pattern.service.connections.allowFrom(pattern.service, ec2.Port.allTraffic());

    // Enable CloudMap service discovery and inform Keycloak about its mechanism.
    taskDefinition.keycloakContainerExtension.useCloudMapService(
      pattern.service.enableCloudMap({
        dnsRecordType: discovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
      }));

    // Allow the service to connect to the database
    db.connections.allowDefaultPortFrom(pattern.service);

    const cfnService = pattern.service.node.findChild('Service') as ecs.CfnService;
    cfnService.launchType = undefined;
    cfnService.capacityProviderStrategy = cfnCluster.defaultCapacityProviderStrategy;
  }
}

const app = new cdk.App();
new IntegFargateStack(app, 'integ-fargate-stack', {
  databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
});
