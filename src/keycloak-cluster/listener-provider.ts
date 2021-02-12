import * as acm from '@aws-cdk/aws-certificatemanager';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';

/**
 * Provides ListenerInfo once the VPC is available.
 */
export interface IListenerInfoProvider {
  /**
   * Binds resources to the parent scope and provides ListenerInfo once the
   * VPC is available.
   */
  bind(scope: cdk.Construct, vpc: ec2.IVpc): ListenerInfo;
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
   * Use an already-existing listener
   */
  static fromListenerInfo(listenerInfo: ListenerInfo): IListenerInfoProvider {
    return {
      bind: () => listenerInfo,
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
}

/**
 * Creates a load balancer and an HTTP load balancer.
 */
export class HttpListenerProvider implements IListenerInfoProvider {
  public bind(scope: cdk.Construct, vpc: ec2.IVpc): ListenerInfo {
    const loadBalancer = new elbv2.ApplicationLoadBalancer(scope, 'LoadBalancer', {
      vpc: vpc,
      internetFacing: true,
    });

    const listener = loadBalancer.addListener('HTTP', {
      protocol: elbv2.ApplicationProtocol.HTTP,
    });

    new cdk.CfnOutput(scope, 'LoadBalancerUrl', {
      value: cdk.Fn.sub('http://${HostName}/', {
        HostName: loadBalancer.loadBalancerDnsName,
      }),
    });

    return {
      listener,
    };
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

  bind(scope: cdk.Construct, vpc: ec2.IVpc): ListenerInfo {
    // Create a load balancer.
    const loadBalancer = new elbv2.ApplicationLoadBalancer(scope, 'LoadBalancer', {
      vpc: vpc,
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

    return {
      listener,
    };
  }
}