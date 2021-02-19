import * as acm from '@aws-cdk/aws-certificatemanager';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';

/**
 * @internal
 */
export interface PublishContainerPortProps {
  readonly vpc: ec2.IVpc;
  readonly service: ecs.BaseService;
  readonly containerName: string;
  readonly containerPort: number;
  readonly containerPortProtocol: elbv2.Protocol;
  readonly slowStart?: cdk.Duration;
  readonly deregistrationDelay?: cdk.Duration;
  readonly healthCheck?: elbv2.HealthCheck;
}

/**
 * Publishes container ports.
 */
export interface IPortPublisher {
  /**
   * Binds resources to the parent scope and provides ListenerInfo once the
   * VPC is available.
   * @internal
   */
  _publishContainerPort(scope: cdk.Construct, props: PublishContainerPortProps): void;
}

/**
 * Convenience interface for creating port publishers.
 */
export abstract class PortPublisher {
  /**
   * Not added to a load balancer.
   */
  static none(): IPortPublisher {
    return new NonePortPublisher();
  };

  /**
   * Add to an existing load balancer.
   */
  static addTarget(props: AddTargetPortPublisherProps): IPortPublisher {
    return new AddTargetPortPublisher(props);
  }

  /**
   * Create a load balancer that listens for HTTP
   */
  static httpAlb(props?: HttpAlbPortPublisherProps): IPortPublisher {
    return new HttpAlbPortPublisher(props);
  }

  /**
   * Create a load balancer that listens for HTTPS with your certificates.
   */
  static httpsAlb(props: HttpsAlbPortPublisherProps): IPortPublisher {
    return new HttpsAlbPortPublisher(props);
  }

  /**
   * Create a network load balancer.
   */
  static nlb(props: NlbPortPublisherProps): IPortPublisher {
    return new NlbPortPublisher(props);
  }
}

/**
 * Information about how to register with a load balancer.
 */
export interface AddTargetPortPublisherProps {
  readonly listener: elbv2.IApplicationListener;
  readonly conditions?: elbv2.ListenerCondition[];
  readonly priority?: number;
}

/**
 * Publishes a container port common `listener.addTargets` props.
 */
export class AddTargetPortPublisher implements IPortPublisher {
  constructor(private readonly listenerInfo: AddTargetPortPublisherProps) {
  }

  /**
   * @internal
   */
  _publishContainerPort(_scope: cdk.Construct, props: PublishContainerPortProps): void {
    const listenerInfo = this.listenerInfo;

    const targets = [props.service.loadBalancerTarget({
      containerName: props.containerName,
      containerPort: props.containerPort,
    })];

    const targetGroup = new elbv2.ApplicationTargetGroup(_scope, 'KeycloakGroup', {
      vpc: props.vpc,
      targets: targets,
      protocol: mapElbv2ProtocolToALBProtocol(props.containerPortProtocol),
    });

    listenerInfo.listener.addTargetGroups('Keycloak', {
      targetGroups: [targetGroup],
      conditions: listenerInfo.conditions,
      priority: listenerInfo.priority,
    });
  }
}

/**
 * Properties for an ALB port publisher.
 */
export interface AlbPortPublisherProps {
  /**
   * Scope ID of the load balancer.
   * @default 'LoadBalancer'
   */
  readonly id?: string;

  /**
   * Enable health checking on this endpoint.
   * @default true
   */
  readonly healthCheck?: boolean;
}

/**
 * Properties for an HTTP ALB port publisher.
 */
export interface HttpAlbPortPublisherProps extends AlbPortPublisherProps {
}

/**
 * Creates a load balancer and an HTTP load balancer.
 */
export class HttpAlbPortPublisher implements IPortPublisher {
  private readonly id: string;
  private readonly healthCheck: boolean;

  constructor(props?: HttpAlbPortPublisherProps) {
    this.id = props?.id ?? 'LoadBalancer';
    this.healthCheck = props?.healthCheck ?? true;
  }

  /**
   * @internal
   */
  public _publishContainerPort(scope: cdk.Construct, props: PublishContainerPortProps) {
    // Create or re-use an application load balancer in the scope.
    const loadBalancer = new elbv2.ApplicationLoadBalancer(scope, this.id, {
      vpc: props.vpc,
      internetFacing: true,
    });

    const listener = loadBalancer.addListener('HTTP', {
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    new cdk.CfnOutput(listener, 'Url', {
      value: cdk.Fn.sub('http://${HostName}/', {
        HostName: loadBalancer.loadBalancerDnsName,
      }),
    });

    const healthCheck = this.healthCheck
      ? props.healthCheck
      : undefined;

    return listener.addTargets('Keycloak', {
      targets: [props.service.loadBalancerTarget({
        containerName: props.containerName,
        containerPort: props.containerPort,
      })],
      protocol: mapElbv2ProtocolToALBProtocol(props.containerPortProtocol),
      slowStart: props.slowStart,
      deregistrationDelay: props.deregistrationDelay,
      healthCheck: healthCheck,
      // Keycloak recommends session stickiness to reduce remote distributed cache
      // access across cluster nodes.
      // https://www.keycloak.org/docs/latest/server_installation/#sticky-sessions
      stickinessCookieDuration: cdk.Duration.days(1),
    });
  }
}

/**
 * Properties for a new HTTPS-listening load balancer.
 */
export interface HttpsAlbPortPublisherProps extends AlbPortPublisherProps {
  /**
   * Certificates to use for the ALB listener.
   */
  readonly certificates: acm.ICertificate[];

  /**
   * Upgrade HTTP connection to HTTPS
   * @default false
   */
  readonly upgradeHttp?: boolean;

  /**
   * A host name to redirect to when upgrading to HTTPS
   * @default - same as the request
   */
  readonly upgradeHttpHost?: string;
}

/**
 * Creates an application load balancer and an HTTPS listener with the given
 * ACM certificates.
 */
export class HttpsAlbPortPublisher implements IPortPublisher {
  private readonly id: string;
  private readonly healthCheck: boolean;

  constructor(private readonly props: HttpsAlbPortPublisherProps) {
    this.id = props.id ?? 'LoadBalancer';
    this.healthCheck = props.healthCheck ?? true;
  }

  /**
   * @internal
   */
  _publishContainerPort(scope: cdk.Construct, props: PublishContainerPortProps) {
    // Create or re-use an application load balancer in the scope.
    const loadBalancer: elbv2.ApplicationLoadBalancer = scope.node.tryFindChild(this.id) as any ??
      new elbv2.ApplicationLoadBalancer(scope, this.id, {
        vpc: props.vpc,
        internetFacing: true,
      });

    if (this.props.certificates.length === 0) {
      throw new Error('Please provide one or more certificates to the load balancer');
    }

    if (this.props.upgradeHttp) {
      // Upgrade HTTP connections to HTTPS
      loadBalancer.addListener('HTTP', {
        protocol: elbv2.ApplicationProtocol.HTTP,
        defaultAction: elbv2.ListenerAction.redirect({
          protocol: 'HTTPS',
          port: '443',
          host: this.props.upgradeHttpHost,
        }),
      });
    }

    const listener = loadBalancer.addListener('HTTPS', {
      certificates: this.props.certificates,
      protocol: elbv2.ApplicationProtocol.HTTPS,
    });

    new cdk.CfnOutput(listener, 'Url', {
      value: cdk.Fn.sub('https://${HostName}/', {
        HostName: loadBalancer.loadBalancerDnsName,
      }),
    });

    const healthCheck = this.healthCheck
      ? props.healthCheck
      : undefined;

    return listener.addTargets('Keycloak', {
      targets: [props.service.loadBalancerTarget({
        containerName: props.containerName,
        containerPort: props.containerPort,
      })],
      protocol: mapElbv2ProtocolToALBProtocol(props.containerPortProtocol),
      slowStart: props.slowStart,
      deregistrationDelay: props.deregistrationDelay,
      healthCheck: healthCheck,
      // Keycloak recommends session stickiness to reduce remote distributed cache
      // access across cluster nodes.
      // https://www.keycloak.org/docs/latest/server_installation/#sticky-sessions
      stickinessCookieDuration: cdk.Duration.days(1),
    });
  }
}

/**
 * Information about a network load balancer to create.
 */
export interface NlbPortPublisherProps {
  /**
   * Scope ID of the load balancer.
   * @default 'LoadBalancer'
   */
  readonly id?: string;

  /**
   * Port to listen on.
   */
  readonly port: number;

  /**
   * Enable health checking on this endpoint.
   * @default true
   */
  readonly healthCheck?: boolean;
}

/**
 * Publishes a port via a Network Load Balancer
 */
export class NlbPortPublisher implements IPortPublisher {
  private readonly id: string;
  private readonly port: number;
  private readonly healthCheck: boolean;

  constructor(props: NlbPortPublisherProps) {
    this.id = props.id ?? 'LoadBalancer';
    this.port = props.port;
    this.healthCheck = props.healthCheck ?? true;
  }

  /**
   * @internal
   */
  _publishContainerPort(scope: cdk.Construct, props: PublishContainerPortProps) {
    // Create or re-use a network load balancer in the scope.
    const loadBalancer: elbv2.NetworkLoadBalancer = scope.node.tryFindChild(this.id) as any ??
      new elbv2.NetworkLoadBalancer(scope, this.id, {
        vpc: props.vpc,
        internetFacing: true,
      });

    const listener = loadBalancer.addListener(`Port${this.port}`, {
      port: this.port,
    });

    new cdk.CfnOutput(listener, 'Endpoint', {
      value: cdk.Fn.sub('${Host}:${Port}', {
        Host: loadBalancer.loadBalancerDnsName,
        Port: this.port.toString(),
      }),
    });

    // XXX: NLBs don't have security groups, so we allow traffic from any peer.
    props.service.connections.allowFrom(ec2.Peer.anyIpv4(), ec2.Port.tcp(props.containerPort));
    props.service.connections.allowFrom(ec2.Peer.anyIpv6(), ec2.Port.tcp(props.containerPort));

    listener.addTargets('Target', {
      // Listener's port.
      port: this.port,
      // Target
      targets: [props.service.loadBalancerTarget({
        containerName: props.containerName,
        containerPort: props.containerPort,
      })],
      protocol: mapElbv2ProtocolToNLBProtocol(props.containerPortProtocol),
      deregistrationDelay: props.deregistrationDelay,
      healthCheck: !this.healthCheck ? undefined : {
        ...props.healthCheck,
        // Check paths are not supported for NLB protcols we use, but we still
        // want the rest of the health check config from the cluster.
        path: undefined,
      },
    });
  }
}

function mapElbv2ProtocolToALBProtocol(protocol: elbv2.Protocol) {
  switch (protocol) {
    case elbv2.Protocol.HTTP:
      return elbv2.ApplicationProtocol.HTTP;
    case elbv2.Protocol.HTTPS:
      return elbv2.ApplicationProtocol.HTTPS;
    default:
      throw new Error(`${protocol} is not supported by ALB`);
  }
}

function mapElbv2ProtocolToNLBProtocol(protocol: elbv2.Protocol) {
  switch (protocol) {
    case elbv2.Protocol.HTTPS:
    case elbv2.Protocol.HTTP:
    case elbv2.Protocol.TCP:
      return elbv2.Protocol.TCP;
    default:
      throw new Error(`${protocol} not supported by NLB`);
  }
}

/**
 * @internal
 */
export class NonePortPublisher implements IPortPublisher {
  /**
   * @internal
   */
  _publishContainerPort(_scope: cdk.Construct, _props: PublishContainerPortProps) {
    // Do nothing.
  }
}