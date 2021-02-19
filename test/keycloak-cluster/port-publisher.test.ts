import { expect as expectCDK, haveResourceLike } from '@aws-cdk/assert';
import * as acm from '@aws-cdk/aws-certificatemanager';
import * as ec2 from '@aws-cdk/aws-ec2';
import * as ecs from '@aws-cdk/aws-ecs';
import * as elbv2 from '@aws-cdk/aws-elasticloadbalancingv2';
import * as cdk from '@aws-cdk/core';
import { PortPublisher } from '../../src';

describe('port publisher', () => {
  test('none publishes nothing', () => {
    const testStack = new TestStack();

    // WHEN
    PortPublisher.none()._publishContainerPort(testStack, {
      containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
      containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
      containerPortProtocol: elbv2.Protocol.HTTP,
      service: testStack.service,
      vpc: testStack.service.cluster.vpc,
    });

    expectCDK(testStack).notTo(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup'));
  });

  describe('addTarget', () => {
    test('adds a target to an existing load balancer', () => {
      const testStack = new TestStack();

      const alb = new elbv2.ApplicationLoadBalancer(testStack, 'NewLoadBalancer', {
        vpc: testStack.service.cluster.vpc,
      });

      const listener = alb.addListener('HTTP', {
        protocol: elbv2.ApplicationProtocol.HTTP,
      });

      // WHEN
      PortPublisher.addTarget({
        listener,
      })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTP,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      // THEN
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Protocol: 'HTTP',
      }));
    });

    test('adds a target to an imported load balancer', () => {
      const testStack = new TestStack();

      const listener = elbv2.ApplicationListener.fromApplicationListenerAttributes(testStack, 'Listener', {
        listenerArn: 'arn:alb:fakeid',
        securityGroup: ec2.SecurityGroup.fromSecurityGroupId(testStack, 'ListenerSG', 'sg-fakeid'),
      });

      // WHEN
      PortPublisher.addTarget({
        listener,
        conditions: [elbv2.ListenerCondition.hostHeaders(['id.example.com'])],
        priority: 1000,
      })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTP,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      // THEN
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Protocol: 'HTTP',
      }));
    });
  });

  describe('httpAlb', () => {
    test('httpAlb publishes internal HTTP', () => {
      const testStack = new TestStack();

      // WHEN
      PortPublisher.httpAlb()._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTP,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'HTTP',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Protocol: 'HTTP',
      }));
    });

    test('httpAlb publishes internal HTTPS as HTTP', () => {
      const testStack = new TestStack();

      // WHEN
      PortPublisher.httpAlb()._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTPS,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'HTTP',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Protocol: 'HTTPS',
      }));
    });
  });

  describe('httpsAlb', () => {
    test('httpsAlb publishes internal HTTP as HTTPS', () => {
      const testStack = new TestStack();

      // WHEN
      PortPublisher.httpsAlb({
        certificates: [testStack.certificate],
      })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTP,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'HTTPS',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Protocol: 'HTTP',
      }));
    });

    test('httpsAlb publishes internal HTTPS', () => {
      const testStack = new TestStack();

      // WHEN
      PortPublisher.httpsAlb({
        certificates: [testStack.certificate],
      })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTPS,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
      }));
      expectCDK(testStack).notTo(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'HTTP',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'HTTPS',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Protocol: 'HTTPS',
      }));
    });

    test('upgrades http to https', () => {
      const testStack = new TestStack();

      // WHEN
      PortPublisher.httpsAlb({
        certificates: [testStack.certificate],
        upgradeHttp: true,
      })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTPS,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'application',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'HTTP',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'HTTPS',
      }));
    });
  });

  test('reuses the load balancer for http and https', () => {
    const testStack = new TestStack();

    // WHEN
    const props = {
      containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
      containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
      containerPortProtocol: elbv2.Protocol.HTTPS,
      service: testStack.service,
      vpc: testStack.service.cluster.vpc,
    };

    PortPublisher.httpAlb()._publishContainerPort(testStack, props);
    PortPublisher.httpsAlb({
      certificates: [testStack.certificate],
    })._publishContainerPort(testStack, props);

    expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
      Protocol: 'HTTP',
    }));
    expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
      Protocol: 'HTTPS',
    }));
  });

  describe('nlb', () => {
    test('publishes internal HTTP as TCP', () => {
      const testStack = new TestStack();

      // WHEN
      PortPublisher.nlb({ port: 81 })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTP,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Type: 'network',
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'TCP',
        Port: 81,
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::TargetGroup', {
        Protocol: 'TCP',
      }));
    });

    test('reuses the load balancer for multiple publishes', () => {
      const testStack = new TestStack();

      // WHEN
      PortPublisher.nlb({ port: 81 })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTP,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });
      PortPublisher.nlb({ port: 82 })._publishContainerPort(testStack, {
        containerName: testStack.service.taskDefinition.defaultContainer!.containerName,
        containerPort: testStack.service.taskDefinition.defaultContainer!.containerPort,
        containerPortProtocol: elbv2.Protocol.HTTP,
        service: testStack.service,
        vpc: testStack.service.cluster.vpc,
      });

      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'TCP',
        Port: 81,
      }));
      expectCDK(testStack).to(haveResourceLike('AWS::ElasticLoadBalancingV2::Listener', {
        Protocol: 'TCP',
        Port: 82,
      }));
    });
  });
});

class TestStack extends cdk.Stack {
  public readonly service: ecs.FargateService;
  public readonly certificate: acm.Certificate;

  constructor(scope?: cdk.Construct, id?: string) {
    super(scope, id);

    this.certificate = new acm.Certificate(this, 'Certificate', {
      domainName: 'asdf',
    });

    const cluster = new ecs.Cluster(this, 'Cluster');
    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      cpu: 256,
      memoryLimitMiB: 512,
    });

    const mainContainer = taskDefinition.addContainer('Main', {
      image: ecs.ContainerImage.fromRegistry('nginx'),
    });

    mainContainer.addPortMappings({ containerPort: 80 });
    mainContainer.addPortMappings({ containerPort: 8080 });

    this.service = new ecs.FargateService(this, 'Service', {
      cluster: cluster,
      taskDefinition: taskDefinition,
    });
  }
}