import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';

/**
 * Provides VpcInfo
 */
export interface IVpcInfoProvider {
  /**
   * Binds resources to the parent scope and provides VpcInfo.
   * @internal
   */
  _bind(scope: cdk.Construct): VpcInfo;
}

/**
 * Information about the VPC other providers may opt to privde their resources
 * in.
 */
export interface VpcInfo {
  /**
   * The VPC
   */
  readonly vpc: ec2.IVpc;
}

export abstract class VpcProvider {
  /**
   * Provides an already-existing vpc
   */
  static fromExistingVpc(vpc: ec2.IVpc): IVpcInfoProvider {
    return {
      _bind: () => ({ vpc }),
    };
  }

  /**
   * Provides a VPC with a public subnet and private subnet config.
   */
  static ingressAndPrivateVpc(): IVpcInfoProvider {
    return new IngressAndPrivateVpcProvider();
  }
}

/**
 * Provides a VPC with both private and public subnets.
 */
export class IngressAndPrivateVpcProvider implements IVpcInfoProvider {
  /**
   * @internal
   */
  _bind(scope: cdk.Construct): VpcInfo {
    const vpc = new ec2.Vpc(scope, 'Vpc', {
      subnetConfiguration: [
        {
          name: 'ingress',
          cidrMask: 24,
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          name: 'private',
          cidrMask: 21,
          subnetType: ec2.SubnetType.PRIVATE,
        },
      ],
    });

    return {
      vpc,
    };
  }
}