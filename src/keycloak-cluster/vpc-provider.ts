import * as ec2 from '@aws-cdk/aws-ec2';
import * as cdk from '@aws-cdk/core';

export interface IVpcInfoProvider {
  bind(scope: cdk.Construct): IVpcInfo;
}

export interface IVpcInfo {
  readonly vpc: ec2.IVpc;
  readonly rdsSubnets?: ec2.SubnetSelection;
  readonly taskSubnets?: ec2.SubnetSelection;
}

export abstract class VpcProvider {
  static fromExistingVpc(vpc: ec2.IVpc): IVpcInfoProvider {
    return {
      bind: () => ({ vpc }),
    };
  }

  static vpc(): IVpcInfoProvider {
    return new DefaultVpcNetworkProvider();
  }
}

export class DefaultVpcNetworkProvider implements IVpcInfoProvider {
  bind(scope: cdk.Construct): IVpcInfo {
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