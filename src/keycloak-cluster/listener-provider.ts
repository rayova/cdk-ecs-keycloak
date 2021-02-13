import * as acm from '@aws-cdk/aws-certificatemanager';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';

/**
 * Provides ListenerInfo once the VPC is available.
 */
export interface IListenerInfoProvider {
  /**
   * Binds resources to the parent scope and provides ListenerInfo once the
   * VPC is available.
   * @internal
   */
  _addTargets(scope: cdk.Construct, props: ListenerInfoProviderBindingProps): void;
}

/**
 * @internal
 */
export interface ListenerInfoProviderBindingProps {
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
 * Information about how to register with a load balancer.
 */
export interface ListenerInfo {
  readonly listener: elbv2.IApplicationListener;
  readonly conditions?: elbv2.ListenerCondition[];
  readonly priority?: number;
}

/**
 * Convenience interface for providing ListenerInfo to the cluster.
 */
export abstract class ListenerProvider {
  /**
   * Not added to a load balancer.
   */
  static none(): IListenerInfoProvider {
    return {
      _addTargets: () => undefined,
    };
  };

  /**
   * Add to an existing load balancer.
   */
  static fromListenerInfo(listenerInfo: ListenerInfo): IListenerInfoProvider {
    return {
      _addTargets: (_scope, props) => {
        return listenerInfo.listener.addTargets('Keycloak', {
          // Target
          targets: [props.service.loadBalancerTarget({
            containerName: props.containerName,
            containerPort: props.containerPort,
          })],
          protocol: mapElbv2ProtocolToALBProtocol(props.containerPortProtocol),
          conditions: listenerInfo.conditions,
          priority: listenerInfo.priority ?? 1000,
        });
      },
    };
  }

  /**
   * Create a load balancer that listens for HTTP
   */
  static http(): IListenerInfoProvider {
    return new HttpListenerProvider();
  }

  /**
   * Create a load balancer that listens for HTTPS with your certificates.
   */
  static https(props: HttpsListenerProviderProps): IListenerInfoProvider {
    return new HttpsListenerProvider(props);
  }

  /**
   * Create a network load balancer.
   */
  static nlb(props: NlbListenerProviderProps): IListenerInfoProvider {
    return new NlbListenerProvider(props);
  }
}

/**
 * Creates a load balancer and an HTTP load balancer.
 */
export class HttpListenerProvider implements IListenerInfoProvider {
  /**
   * @internal
   */
  public _addTargets(scope: cdk.Construct, props: ListenerInfoProviderBindingProps) {
    const loadBalancer = new elbv2.ApplicationLoadBalancer(scope, 'LoadBalancer', {
      vpc: props.vpc,
      internetFacing: true,
    });

    new cdk.CfnOutput(scope, 'LoadBalancerUrl', {
      value: cdk.Fn.sub('http://${HostName}/', {
        HostName: loadBalancer.loadBalancerDnsName,
      }),
    });

    const listener = loadBalancer.addListener('HTTP', {
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    return listener.addTargets('Keycloak', {
      targets: [props.service.loadBalancerTarget({
        containerName: props.containerName,
        containerPort: props.containerPort,
      })],
      protocol: mapElbv2ProtocolToALBProtocol(props.containerPortProtocol),
      slowStart: props.slowStart,
      deregistrationDelay: props.deregistrationDelay,
      healthCheck: props.healthCheck,
    });
  }
}

/**
 * Properties for a new HTTPS-listening load balancer.
 */
export interface HttpsListenerProviderProps {
  /**
   * Certificates to use for the ALB listener.
   */
  readonly certificates: acm.ICertificate[];
}

/**
 * Creates an application load balancer and an HTTPS listener with the given
 * ACM certificates.
 */
export class HttpsListenerProvider implements IListenerInfoProvider {
  private readonly certificates: acm.ICertificate[];

  constructor(props: HttpsListenerProviderProps) {
    this.certificates = props.certificates;
  }

  /**
   * @internal
   */
  _addTargets(scope: cdk.Construct, props: ListenerInfoProviderBindingProps) {
    // Create a load balancer.
    const loadBalancer = new elbv2.ApplicationLoadBalancer(scope, 'LoadBalancer', {
      vpc: props.vpc,
      internetFacing: true,
    });

    new cdk.CfnOutput(scope, 'LoadBalancerUrl', {
      value: cdk.Fn.sub('https://${HostName}/', {
        HostName: loadBalancer.loadBalancerDnsName,
      }),
    });

    if (this.certificates.length === 0) {
      throw new Error('Please provide one or more certificates to the load balancer');
    }

    const listener = loadBalancer.addListener('HTTPS', {
      certificates: this.certificates,
      protocol: elbv2.ApplicationProtocol.HTTPS,
    });

    return listener.addTargets('Keycloak', {
      targets: [props.service.loadBalancerTarget({
        containerName: props.containerName,
        containerPort: props.containerPort,
      })],
      protocol: mapElbv2ProtocolToALBProtocol(props.containerPortProtocol),
      slowStart: props.slowStart,
      deregistrationDelay: props.deregistrationDelay,
      healthCheck: props.healthCheck,
    });
  }
}

/**
 * Information about a network load balancer to create.
 */
export interface NlbListenerProviderProps {
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
 * Creates a network load balancer listener.
 */
export class NlbListenerProvider implements IListenerInfoProvider {
  private readonly id: string;
  private readonly port: number;
  private readonly healthCheck: boolean;

  constructor(props: NlbListenerProviderProps) {
    this.id = props.id ?? 'LoadBalancer';
    this.port = props.port;
    this.healthCheck = props.healthCheck ?? true;
  }

  /**
   * @internal
   */
  _addTargets(scope: cdk.Construct, props: ListenerInfoProviderBindingProps) {
    // Create or re-use a network load balancer in the scope.
    const loadBalancer: elbv2.NetworkLoadBalancer = scope.node.tryFindChild(this.id) as any ??
      new elbv2.NetworkLoadBalancer(scope, this.id, {
        vpc: props.vpc,
        internetFacing: true,
      });

    const listener = loadBalancer.addListener(`Port${props.containerPort}`, {
      port: this.port,
    });

    new cdk.CfnOutput(loadBalancer, `EndpointPort${props.containerPort}`, {
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
