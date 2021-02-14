import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as cdk from '@aws-cdk/core';

/**
 * Provides ClusterInfo after the VPC is available.
 */
export interface IClusterInfoProvider {
  /**
   * Bind any new resources to the parent scope with access to the vpc.
   * @internal
   */
  _provideClusterInfo(scope: cdk.Construct, props: ProvideClusterInfoProps): ClusterInfo;
}

/**
 * @internal
 */
export interface ProvideClusterInfoProps {
  readonly vpc: ec2.IVpc;
}

/**
 * Information about the ecs cluster.
 */
export interface ClusterInfo {
  /**
   * The ECS cluster for adding a service.
   */
  readonly cluster: ecs.ICluster;
}

/**
 * Convenience interface for providing ClusterInfo to the cluster construct.
 */
export abstract class ClusterProvider {
  /**
   * Create an ECS cluster.
   */
  static cluster(): IClusterInfoProvider {
    return new EcsClusterInfoProvider();
  }

  /**
   * Provide raw clusterInfo
   */
  static fromClusterInfo(clusterInfo: ClusterInfo): IClusterInfoProvider {
    return {
      _provideClusterInfo: () => clusterInfo,
    };
  }
}

/**
 * Provides a very basic ECS cluster in the given VPC.
 */
export class EcsClusterInfoProvider implements IClusterInfoProvider {
  /**
   * @internal
   */
  _provideClusterInfo(scope: cdk.Construct, props: ProvideClusterInfoProps): ClusterInfo {
    const cluster = new ecs.Cluster(scope, 'Cluster', {
      vpc: props.vpc,
    });

    return {
      cluster,
    };
  }
}