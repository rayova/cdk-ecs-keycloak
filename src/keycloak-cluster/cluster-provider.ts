import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as cdk from '@aws-cdk/core';

export interface IClusterInfoProvider {
  bind(scope: cdk.Construct, vpc: ec2.IVpc): ClusterInfo;
}

export interface ClusterInfo {
  readonly cluster: ecs.ICluster;
}

export abstract class ClusterProvider {
  static cluster(): IClusterInfoProvider {
    return new EcsClusterInfoProvider();
  }
}

export class EcsClusterInfoProvider implements IClusterInfoProvider {
  bind(scope: cdk.Construct, vpc: ec2.IVpc): ClusterInfo {
    const cluster = new ecs.Cluster(scope, 'Cluster', {
      vpc,
    });

    return {
      cluster,
    };
  }
}