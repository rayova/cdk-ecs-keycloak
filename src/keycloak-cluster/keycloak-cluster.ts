import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';
import { KeycloakContainerExtensionProps } from '../keycloak-container-extension';
import { KeycloakFargateTaskDefinition } from '../keycloak-task-definition';
import { CloudMapNamespaceProvider, ICloudMapNamespaceInfoProvider } from './cloudmap-namespace-provider';
import { ClusterProvider, IClusterInfoProvider } from './cluster-provider';
import { DatabaseProvider, IDatabaseInfoProvider } from './database-provider';
import { IListenerInfoProvider, ListenerProvider } from './listener-provider';
import { IVpcInfoProvider, VpcProvider } from './vpc-provider';

/**
 * Props for `KeycloakCluster`
 */
export interface KeycloakClusterProps {
  /**
   * VPC to use.
   * @default - creates one
   */
  readonly vpcProvider?: IVpcInfoProvider;

  /**
   * Where to place the instances within the VPC.
   * Note: Useful when the VPC has no private subnets.
   */
  readonly vpcTaskSubnets?: ec2.SubnetSelection;

  /**
   * Assign public IPs to the Fargate tasks.
   * Note: Useful if you don't have a NAT gateway and only public subnets.
   * @default false
   */
  readonly vpcTaskAssignPublicIp?: boolean;

  /**
   * Enable/disable the deployment circuit breaker
   * @default true
   */
  readonly circuitBreaker?: boolean;

  /**
   * CloudMap namespace to use for service discovery.
   * @default - creates one named 'keycloak-service-discovery'
   */
  readonly cloudMapNamespaceProvider?: ICloudMapNamespaceInfoProvider;

  /**
   * Provide an ECS cluster
   * @default - a cluster is automatically created.
   */
  readonly ecsClusterProvider?: IClusterInfoProvider;

  /**
   * Add the service to an existing load balancer's listener.
   * @default - a new load balancer is automatically created.
   */
  readonly listenerProvider?: IListenerInfoProvider;

  /**
   * Database server.
   * @default - creates a new one
   */
  readonly databaseProvider?: IDatabaseInfoProvider;

  /**
   * Keycloak configuration.
   */
  readonly keycloak?: KeycloakContainerExtensionProps;

  /**
   * How many keycloak cluster members to spin up.
   */
  readonly desiredCount?: number;

  /**
   * Initial grace period for Keycloak to spin up.
   * @default 10 minutes
   */
  readonly healthCheckGracePeriod?: cdk.Duration;

  /**
   * Fargate task cpu spec
   * @default 1024
   */
  readonly cpu?: number;

  /**
   * Fargate task memory spec
   * @default 2048
   */
  readonly memoryLimitMiB?: number;

  /**
   * The minimum percentage of healthy tasks during deployments.
   */
  readonly minHealthyPercent?: number;

  /**
   * The maximum percentage of healthy tasks during deployments.
   */
  readonly maxHealthyPercent?: number;
}

/**
 * A complete Keycloak cluster in a box.
 */
export class KeycloakCluster extends cdk.Construct {
  /**
   * The ECS service controlling the cluster tasks.
   */
  public readonly service: ecs.BaseService;

  /**
   * The Target Group that the service registers with.
   */
  public readonly targetGroup: elbv2.ApplicationTargetGroup;

  constructor(scope: cdk.Construct, id: string, props?: KeycloakClusterProps) {
    super(scope, id);

    // Defaults
    const cpu = props?.cpu ?? 1024;
    const memoryLimitMiB = props?.memoryLimitMiB ?? 2048;
    const healthCheckGracePeriod = props?.healthCheckGracePeriod ?? cdk.Duration.minutes(10);

    // Let the user provide
    const vpcInfoProvider = props?.vpcProvider ?? VpcProvider.ingressAndPrivateVpc();
    const { vpc } = vpcInfoProvider.bind(this);

    const databaseInfoProvider = props?.databaseProvider ?? DatabaseProvider.serverlessAuroraCluster();
    const databaseInfo = databaseInfoProvider.bind(this, vpc);

    const clusterInfoProvider = props?.ecsClusterProvider ?? ClusterProvider.cluster();
    const { cluster } = clusterInfoProvider.bind(this, vpc);

    const iCloudMapNamespaceInfoProvider = props?.cloudMapNamespaceProvider ?? CloudMapNamespaceProvider.privateDns();
    const { cloudMapNamespace } = iCloudMapNamespaceInfoProvider.bind(this, vpc);

    const listenerProvider = props?.listenerProvider ?? ListenerProvider.http();
    const listenerInfo = listenerProvider.bind(this, vpc);

    // Create a keycloak task definition. The task will create a database for
    // you if the database doesn't already exist.
    const keycloakTaskDefinition = new KeycloakFargateTaskDefinition(this, 'TaskDefinition', {
      // Pick a size for your Keycloak tasks.
      cpu: cpu,
      memoryLimitMiB: memoryLimitMiB,
      // Provide your keycloak configuration
      keycloak: {
        ...props?.keycloak,
        databaseCredentials: databaseInfo.credentials,
        databaseVendor: databaseInfo.vendor,
      },
    });

    // Create the keycloak service
    const circuitBreaker = !props?.circuitBreaker ? { rollback: true } : undefined;

    this.service = new ecs.FargateService(this, 'Service', {
      cluster: cluster,
      taskDefinition: keycloakTaskDefinition,
      healthCheckGracePeriod: healthCheckGracePeriod,
      circuitBreaker: circuitBreaker,
      vpcSubnets: props?.vpcTaskSubnets,
      desiredCount: props?.desiredCount,
      assignPublicIp: props?.vpcTaskAssignPublicIp,
      minHealthyPercent: props?.minHealthyPercent,
      maxHealthyPercent: props?.maxHealthyPercent,
      cloudMapOptions: {
        cloudMapNamespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
      },
    });

    this.targetGroup = listenerInfo.listener.addTargets('Keycloak', {
      targets: [this.service],
      slowStart: cdk.Duration.seconds(60),
      port: 8080,
      protocol: elbv2.ApplicationProtocol.HTTP,
      conditions: listenerInfo.conditions,
      priority: listenerInfo.priority,
    });

    if (databaseInfo.connectable) {
      // Allow keycloak to connect to the database.
      databaseInfo.connectable.connections.allowDefaultPortFrom(this.service);
    }

    // Inform keycloak to use cloudmap service discovery
    keycloakTaskDefinition.useCloudMapService(this.service.cloudMapService!);
    // Configure the health check for the given target group
    keycloakTaskDefinition.configureHealthCheck(this.targetGroup);

    // Allow keycloak to connect to cluster members
    this.service.connections.allowInternally(ec2.Port.allTraffic());
  }
}