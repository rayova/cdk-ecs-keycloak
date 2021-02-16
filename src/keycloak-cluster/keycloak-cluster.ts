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
import { IPortPublisher, PortPublisher } from './port-publisher';
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
   * Database server.
   * @default - creates a new one
   */
  readonly databaseProvider?: IDatabaseInfoProvider;

  /**
   * Provide an ECS cluster
   * @default - a cluster is automatically created.
   */
  readonly ecsClusterProvider?: IClusterInfoProvider;

  /**
   * Publish the service's HTTP port.
   * @default - a new load balancer is automatically created unless `httpsPort` is given.
   */
  readonly httpPortPublisher?: IPortPublisher;

  /**
   * Publish the service's HTTPS port. When provided, the http port is no
   * longer exposed by default
   * @default - not published
   */
  readonly httpsPortPublisher?: IPortPublisher;

  /**
   * Add the service's WildFly admin console port to a load balancer. You will
   * probably need to use your own Dockerfile to add access to this console.
   * @default - not exposed
   */
  readonly adminConsolePortPublisher?: IPortPublisher;

  /**
   * Add the service's http port to a load balancer
   * @default - a new load balancer is automatically created unless `httpsListenerProvider` is given.
   * @deprecated use `httpPortPublisher` instead
   */
  readonly listenerProvider?: IListenerInfoProvider;

  /**
   * Add the service's https port to a load balancer. When provided, the
   * http port is no longer exposed by an http load balancer by default.
   * @default - not exposed
   * @deprecated - use `httpsPortPublisher` instead
   */
  readonly httpsListenerProvider?: IListenerInfoProvider;

  /**
   * Add the service's WildFly admin console port to a load balancer. You will
   * probably need to use your own Dockerfile to add access to this console.
   * @default - not exposed
   * @deprecated use `adminConsolePortPublisher` instead
   */
  readonly adminConsoleListenerProvider?: IListenerInfoProvider;

  /**
   * Keycloak configuration options.
   */
  readonly keycloak?: KeycloakContainerExtensionProps;

  /**
   * How many keycloak cluster members to spin up.
   * @default 1
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

  /**
   * Add capacity provider strategy by CDK escape hatch.
   * @experimental This may be removed or changed without warning
   */
  readonly capacityProviderStrategy?: ecs.CfnCluster.CapacityProviderStrategyItemProperty[];
}

/**
 * A complete Keycloak cluster in a box.
 */
export class KeycloakCluster extends cdk.Construct {
  /**
   * The ECS service controlling the cluster tasks.
   */
  public readonly service: ecs.BaseService;

  /** @internal */
  public readonly _httpPortPublisher: IPortPublisher;
  /** @internal */
  public readonly _httpsPortPublisher: IPortPublisher;
  /** @internal */
  public readonly _adminConsolePortPublisher: IPortPublisher;

  constructor(scope: cdk.Construct, id: string, props?: KeycloakClusterProps) {
    super(scope, id);

    // Defaults
    const cpu = props?.cpu ?? 1024;
    const memoryLimitMiB = props?.memoryLimitMiB ?? 2048;

    // Let the user provide a vpc, database, cluster, and/or cloudmap namespace
    const vpcInfoProvider = props?.vpcProvider ?? VpcProvider.ingressAndPrivateVpc();
    const vpcInfo = vpcInfoProvider._provideVpcInfo(this);

    const databaseInfoProvider = props?.databaseProvider ?? DatabaseProvider.serverlessAuroraCluster();
    const databaseInfo = databaseInfoProvider._provideDatabaseInfo(this, vpcInfo);

    const clusterInfoProvider = props?.ecsClusterProvider ?? ClusterProvider.cluster();
    const clusterInfo = clusterInfoProvider._provideClusterInfo(this, vpcInfo);

    const cloudMapNamespaceProvider = props?.cloudMapNamespaceProvider ?? CloudMapNamespaceProvider.privateDns();
    const cloudMapNamespaceInfo = cloudMapNamespaceProvider._provideCloudMapNamespaceInfo(this, vpcInfo);

    // Backwards compat.
    const isListenerProvider = props?.listenerProvider || props?.httpsListenerProvider || props?.adminConsoleListenerProvider;
    const isPortPublisher = props?.httpPortPublisher || props?.httpsPortPublisher || props?.adminConsolePortPublisher;

    if (isListenerProvider && isPortPublisher) {
      throw new Error('Cannot use both PortPublisher and ListenerProvider properties at the same time');
    }

    if (!isListenerProvider) {
      // Publish the http port to an HTTP load balancer by default unless
      // https is specified.
      this._httpPortPublisher = props?.httpPortPublisher ??
        (props?.httpsPortPublisher
          ? PortPublisher.none()
          : PortPublisher.httpAlb());

      // Don't publish internal HTTPS by default
      this._httpsPortPublisher = props?.httpsPortPublisher ?? PortPublisher.none();
      // Don't publish the admin console by default.
      this._adminConsolePortPublisher = props?.adminConsolePortPublisher ?? PortPublisher.none();
    } else {
      // Publish the http port to an HTTP load balancer by default unless https port is published.
      this._httpPortPublisher = props?.listenerProvider ??
        (props?.httpsListenerProvider
          ? ListenerProvider.none()
          : ListenerProvider.http());
      // Don't publish internal HTTPS by default
      this._httpsPortPublisher = props?.httpsListenerProvider ?? ListenerProvider.none();
      // Don't publish the admin console by default
      this._adminConsolePortPublisher = props?.adminConsoleListenerProvider ?? ListenerProvider.none();
    }

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

    // Enable the ecs deployment circuit breaker by default
    const circuitBreaker = !props?.circuitBreaker ? { rollback: true } : undefined;

    const defaultHealthCheckGracePeriod = keycloakTaskDefinition.keycloakContainerExtension.infinicacheClustering
      // When infinicache clustering is enabled, we need a longer default health check grace period.
      ? cdk.Duration.minutes(10)
      // Without infinicache clustering, keycloak comes online quicker.
      : cdk.Duration.minutes(2);

    const healthCheckGracePeriod = props?.healthCheckGracePeriod ?? defaultHealthCheckGracePeriod;

    // Create the keycloak service
    this.service = new ecs.FargateService(this, 'Service', {
      cluster: clusterInfo.cluster,
      taskDefinition: keycloakTaskDefinition,
      healthCheckGracePeriod: healthCheckGracePeriod,
      circuitBreaker: circuitBreaker,
      vpcSubnets: props?.vpcTaskSubnets,
      desiredCount: props?.desiredCount,
      assignPublicIp: props?.vpcTaskAssignPublicIp,
      minHealthyPercent: props?.minHealthyPercent,
      maxHealthyPercent: props?.maxHealthyPercent,
      cloudMapOptions: {
        cloudMapNamespace: cloudMapNamespaceInfo.cloudMapNamespace,
        dnsRecordType: servicediscovery.DnsRecordType.A,
        dnsTtl: cdk.Duration.seconds(10),
      },
    });

    // Patch in the capacity provider strategy by using an escape hatch.
    if (props?.capacityProviderStrategy && props?.capacityProviderStrategy.length > 0) {
      const cfnService = this.service.node.findChild('Service') as ecs.CfnService;
      cfnService.launchType = undefined;
      cfnService.capacityProviderStrategy = props.capacityProviderStrategy;
    }

    if (databaseInfo.connectable) {
      // Allow keycloak to connect to the database.
      databaseInfo.connectable.connections.allowDefaultPortFrom(this.service);
    }

    // Inform keycloak to use cloudmap service discovery
    keycloakTaskDefinition.useCloudMapService(this.service.cloudMapService!);

    // Allow keycloak to connect to cluster members
    this.service.connections.allowInternally(ec2.Port.allTraffic());

    const commonAddTargetProps = {
      vpc: vpcInfo.vpc,
      service: this.service,
      containerName: keycloakTaskDefinition.keycloakContainerExtension.containerName,
      slowStart: cdk.Duration.seconds(60),
      deregistrationDelay: cdk.Duration.seconds(5),
      healthCheck: {
        path: '/auth/realms/master',
        enabled: true,
      },
    };

    // Add the service's web port to load balancers.
    this._httpPortPublisher._publishContainerPort(this, {
      ...commonAddTargetProps,
      containerPort: keycloakTaskDefinition.keycloakContainerExtension.webPort,
      containerPortProtocol: elbv2.Protocol.HTTP,
    });

    // Add the server's https web port to load balancers.
    this._httpsPortPublisher._publishContainerPort(this, {
      ...commonAddTargetProps,
      containerPort: keycloakTaskDefinition.keycloakContainerExtension.httpsWebPort,
      containerPortProtocol: elbv2.Protocol.HTTPS,
    });

    // Add the server's admin port to load balancers.
    this._adminConsolePortPublisher._publishContainerPort(this, {
      ...commonAddTargetProps,
      containerPort: keycloakTaskDefinition.keycloakContainerExtension.adminConsolePort,
      containerPortProtocol: elbv2.Protocol.HTTP,
    });
  }
}