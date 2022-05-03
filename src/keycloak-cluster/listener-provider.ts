import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import {
  AddTargetPortPublisher,
  HttpAlbPortPublisher,
  HttpsAlbPortPublisher,
  IPortPublisher,
  NlbPortPublisher,
  NonePortPublisher,
} from './port-publisher';

/**
 * Provides ListenerInfo once the VPC is available.
 * @deprecated use `IPortPublisher` instead
 */
export interface IListenerInfoProvider extends IPortPublisher {
}

/**
 * Convenience interface for providing ListenerInfo to the cluster.
 * @deprecated use `PortPublisher` interfaces instead
 */
export abstract class ListenerProvider {
  /**
   * Not added to a load balancer.
   */
  static none(): IListenerInfoProvider {
    return new NoneListenerProvider();
  };

  /**
   * Add to an existing load balancer.
   */
  static fromListenerInfo(listenerInfo: ListenerInfo): IListenerInfoProvider {
    return new FromListenerInfoInfoProvider(listenerInfo);
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
   * @deprecated Use `PortPublisher.nlb()` instead
   */
  static nlb(props: NlbListenerProviderProps): IListenerInfoProvider {
    return new NlbListenerProvider(props);
  }
}

/**
 * Information about how to register with a load balancer.
 * @deprecated use IPortPublisher interfaces instead
 */
export interface ListenerInfo {
  readonly listener: elbv2.IApplicationListener;
  readonly conditions?: elbv2.ListenerCondition[];
  readonly priority?: number;
}

/**
 * @internal
 * @deprecated
 */
class FromListenerInfoInfoProvider extends AddTargetPortPublisher implements IListenerInfoProvider {
  constructor(listenerInfo: ListenerInfo) {
    super(listenerInfo);
  }
}

/**
 * Creates a load balancer and an HTTP load balancer.
 * @deprecated use IPortPublisher interfaces instead
 */
export class HttpListenerProvider extends HttpAlbPortPublisher implements IListenerInfoProvider {
}

/**
 * Properties for a new HTTPS-listening load balancer.
 * @deprecated use IPortPublisher interfaces instead
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
 * @deprecated use IPortPublisher interfaces instead
 */
export class HttpsListenerProvider extends HttpsAlbPortPublisher implements IListenerInfoProvider {
  constructor(props: HttpsListenerProviderProps) {
    super(props);
  }
}

/**
 * Information about a network load balancer to create.
 * @deprecated use IPortPublisher interfaces instead
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
 * @deprecated use IPortPublisher interfaces instead
 */
export class NlbListenerProvider extends NlbPortPublisher implements IListenerInfoProvider {
  constructor(props: NlbListenerProviderProps) {
    super(props);
  }
}

/**
 * @internal
 * @deprecated
 */
export class NoneListenerProvider extends NonePortPublisher implements IListenerInfoProvider {
}