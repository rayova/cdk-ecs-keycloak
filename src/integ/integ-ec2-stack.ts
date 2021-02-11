import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as ecs_patterns from '@aws-cdk/aws-ecs-patterns';
import * as iam from '@aws-cdk/aws-iam';
import * as rds from '@aws-cdk/aws-rds';
import * as discovery from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';

import { KeycloakDatabaseVendor, KeycloakEc2TaskDefinition } from '../index';

export interface IntegEc2StackProps {
  databaseInstanceEngine: rds.IInstanceEngine;
}

/**
 * Integration test. This lives in the src directory so we can run it.
 * @internal
 */
export class IntegEc2Stack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props: IntegEc2StackProps) {
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

    const capacity = cluster.addCapacity('capacity', {
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.SMALL),
      desiredCapacity: 4,
    });
    capacity.addUserData(
      'yum install -y https://s3.region.amazonaws.com/amazon-ssm-region/latest/linux_arm64/amazon-ssm-agent.rpm',
      'systemctl enable amazon-ssm-agent',
      'systemctl start amazon-ssm-agent',
    );
    capacity.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));
    capacity.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'));

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

    const taskDefinition = new KeycloakEc2TaskDefinition(this, 'TaskDefinition', {
      networkMode: ecs.NetworkMode.AWS_VPC,
      keycloak: {
        databaseCredentials: db.secret,
        databaseVendor: KeycloakDatabaseVendor.MYSQL,
        cacheOwnersCount: 2,
      },
    });

    const pattern = new ecs_patterns.ApplicationLoadBalancedEc2Service(this, 'Service', {
      cluster: cluster,
      healthCheckGracePeriod: cdk.Duration.minutes(10),
      minHealthyPercent: 100,
      maxHealthyPercent: 200,
      taskDefinition: taskDefinition,
      desiredCount: 4,
    });

    // Tasks can connect to themselves for cache access.
    pattern.service.connections.allowFrom(pattern.service, ec2.Port.allTraffic());

    // Enable CloudMap service discovery and inform Keycloak about its mechanism.
    taskDefinition.keycloakContainerExtension.useCloudMapService(
      pattern.service.enableCloudMap({
        name: 'foobar',
        dnsRecordType: discovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
      }));

    const cfnService = pattern.service.node.findChild('Service') as ecs.CfnService;
    cfnService.serviceRegistries = [
      {
        containerName: taskDefinition.keycloakContainerExtension.containerName,
        containerPort: 55200,
        registryArn: pattern.service.cloudMapService?.serviceArn,
      },
    ];

    // Allow the service to connect to the database
    db.connections.allowDefaultPortFrom(pattern.service);
  }
}

const app = new cdk.App();
new IntegEc2Stack(app, 'integ-ec2-stack', {
  databaseInstanceEngine: rds.DatabaseInstanceEngine.mysql({ version: rds.MysqlEngineVersion.VER_8_0 }),
});
