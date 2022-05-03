import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

/**
 * Provides VpcInfo
 */
export interface IVpcInfoProvider {
  /**
   * Binds resources to the parent scope and provides VpcInfo.
   * @internal
   */
  _provideVpcInfo(scope: Construct): VpcInfo;
}

/**
 * Information about the VPC other providers may opt to use to host their
 * resources.
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
   * @deprecated use `fromVpc` instead
   */
  static fromExistingVpc(vpc: ec2.IVpc): IVpcInfoProvider {
    return VpcProvider.fromVpc(vpc);
  }

  /**
   * Provides an already-existing vpc
   */
  static fromVpc(vpc: ec2.IVpc): IVpcInfoProvider {
    return new FromVpcProvider({ vpc });
  }

  /**
   * Provides a VPC with a public subnet and private subnet config.
   */
  static ingressAndPrivateVpc(): IVpcInfoProvider {
    return new IngressAndPrivateVpcProvider();
  }
}

/**
 * Props for `FromVpcProvider`
 */
export interface FromVpcProviderProps {
  /**
   * The VPC
   */
  readonly vpc: ec2.IVpc;
}

/**
 * Directly provides the given VPC.
 */
export class FromVpcProvider implements IVpcInfoProvider {
  constructor(private readonly props: FromVpcProviderProps) {}

  /**
   * @internal
   */
  _provideVpcInfo(_scope: Construct): VpcInfo {
    return {
      vpc: this.props.vpc,
    };
  }
}

/**
 * Provides a VPC with both private and public subnets.
 */
export class IngressAndPrivateVpcProvider implements IVpcInfoProvider {
  /**
   * @internal
   */
  _provideVpcInfo(scope: Construct): VpcInfo {
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