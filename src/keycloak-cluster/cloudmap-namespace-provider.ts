import * as ec2 from '@aws-cdk/aws-ec2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';

/**
 * Provides CloudMapNamespaceInfo once the VPC is available.
 */
export interface ICloudMapNamespaceInfoProvider {
  /**
   * Binds resources to the parent scope with the VPC and provides
   * CloudMapNamespaceInfo
   * @internal
   */
  _provideCloudMapNamespaceInfo(scope: cdk.Construct, props: ProvideCloudMapNamespaceInfoProps): CloudMapNamespaceInfo;
}

/**
 * @internal
 */
export interface ProvideCloudMapNamespaceInfoProps {
  readonly vpc: ec2.IVpc;
}

/**
 * Information about the CloudMap namespace for service discovery.
 * @internal
 */
export interface CloudMapNamespaceInfo {
  /**
   * The CloudMap namespace to use for service discovery.
   */
  readonly cloudMapNamespace: servicediscovery.INamespace;
}

/**
 * Props for creating a private Dns Namespace.
 */
export interface PrivateDnsNamespaceProviderProps {
  /**
   * The globally unique name for the namespace.
   * @default 'keycloak-service-discovery'
   */
  readonly name?: string;
}

/**
 * A convenience interface for creating a CloudMap namespace.
 */
export abstract class CloudMapNamespaceProvider {
  /**
   * Create a CloudMap namespaces from a private dns zone.
   */
  static privateDns(props?: PrivateDnsNamespaceProviderProps): ICloudMapNamespaceInfoProvider {
    return {
      _provideCloudMapNamespaceInfo(scope: cdk.Construct, provideInfoProps: ProvideCloudMapNamespaceInfoProps): CloudMapNamespaceInfo {
        return {
          cloudMapNamespace: new servicediscovery.PrivateDnsNamespace(scope, 'ServiceDiscoveryNS', {
            name: props?.name ?? 'keycloak-service-discovery',
            vpc: provideInfoProps.vpc,
          }),
        };
      },
    };
  }
}