import * as ec2 from '@aws-cdk/aws-ec2';
import * as servicediscovery from '@aws-cdk/aws-servicediscovery';
import * as cdk from '@aws-cdk/core';

export interface ICloudMapNamespaceInfoProvider {
  bind(scope: cdk.Construct, vpc: ec2.IVpc): CloudMapNamespaceInfo;
}

export interface CloudMapNamespaceInfo {
  readonly cloudMapNamespace: servicediscovery.INamespace;
}

export interface PrivateDnsNamespaceProviderProps {
  readonly name?: string;
}

export abstract class CloudMapNamespaceProvider {
  static privateDns(props?: PrivateDnsNamespaceProviderProps): ICloudMapNamespaceInfoProvider {
    return {
      bind(scope: cdk.Construct, vpc: ec2.IVpc): CloudMapNamespaceInfo {
        return {
          cloudMapNamespace: new servicediscovery.PrivateDnsNamespace(scope, 'ServiceDiscoveryNS', {
            name: props?.name ?? 'keycloak-service-discovery',
            vpc: vpc,
          }),
        };
      },
    };
  }
}